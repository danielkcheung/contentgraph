'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { BASIS_KEY, clampTooltipLeft, clampTooltipTop, computeSVOs, slugify } from '@/lib/utils'
import type { ExplanationFramework, RecommendedConcept, WritingGuidance } from '@/lib/types'
import { GraphToolbar, TooltipRow } from './GraphShared'

// ─── Colours ──────────────────────────────────────────────────────────────────

const FW_COLORS: Record<string, { fill: string; stroke: string }> = {
  observed: { fill: 'var(--node-fw-observed-bg)', stroke: 'var(--node-fw-observed-border)' },
  inferred: { fill: 'var(--node-fw-inferred-bg)', stroke: 'var(--node-fw-inferred-border)' },
  optional: { fill: 'var(--node-fw-optional-bg)', stroke: 'var(--node-fw-optional-border)' },
}

const BASIS_EDGE_COLOR: Record<string, string> = {
  observed_in_text:       'var(--node-fw-observed-border)',
  strong_topic_inference: 'var(--node-fw-inferred-border)',
  optional_enrichment:    'var(--node-fw-optional-border)',
}

function nodeColor(c: RecommendedConcept) {
  return FW_COLORS[BASIS_KEY[c.basis] ?? 'inferred']
}

function nodeRadius(c: RecommendedConcept): number {
  if (c.isAnchor) return 24
  return { essential: 19, important: 14, useful: 9 }[c.priority] ?? 14
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const BASIS_LABEL: Record<string, string> = {
  observed_in_text:       'In content',
  strong_topic_inference: 'Inferred',
  optional_enrichment:    'Optional',
}

const ALREADY_PRESENT_COLOR: Record<string, { bg: string; text: string }> = {
  yes:     { bg: 'rgba(255,209,54,0.15)',  text: '#ffd136' },
  partial: { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  no:      { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const TOOLTIP_W = 256
const TOOLTIP_H = 180

function FrameworkTooltip({
  concept,
  svos,
  relatedGuidance,
}: {
  concept: RecommendedConcept
  svos: string[]
  relatedGuidance?: string
}) {
  const ap = ALREADY_PRESENT_COLOR[concept.alreadyPresent] ?? ALREADY_PRESENT_COLOR.no
  return (
    <div
      className="rounded-xl border shadow-xl p-3 w-64 text-xs space-y-2.5"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)' }}
    >
      {/* Name + coverage badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold leading-tight" style={{ color: 'var(--text)' }}>{concept.label}</span>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: ap.bg, color: ap.text }}
        >
          {concept.alreadyPresent === 'yes' ? 'Covered' : concept.alreadyPresent === 'partial' ? 'Partial' : 'Not covered'}
        </span>
      </div>

      {/* Role */}
      {concept.explanatoryRole && (
        <TooltipRow label="Role in explanation">
          <p style={{ color: 'var(--text-muted)', fontSize: 10 }} className="leading-snug">
            {concept.explanatoryRole}
          </p>
        </TooltipRow>
      )}

      {/* Why it matters */}
      {concept.whyItMatters && (
        <TooltipRow label="Why it matters">
          <p style={{ color: 'var(--text-muted)', fontSize: 10 }} className="leading-snug">
            {concept.whyItMatters}
          </p>
        </TooltipRow>
      )}

      {/* Relationships */}
      {svos.length > 0 && (
        <TooltipRow label="Relationships">
          <div className="space-y-1 mt-0.5">
            {svos.slice(0, 3).map((svo, i) => (
              <p key={i} className="leading-snug font-mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>{svo}</p>
            ))}
          </div>
        </TooltipRow>
      )}

      {/* Writing guidance */}
      {relatedGuidance && (
        <TooltipRow label="Writing guidance">
          <div className="rounded-lg p-2 border mt-0.5" style={{ background: 'var(--surface)', borderColor: 'var(--border-solid)' }}>
            <p className="italic leading-snug" style={{ color: 'var(--text-dim)', fontSize: 10 }}>"{relatedGuidance}"</p>
          </div>
        </TooltipRow>
      )}
    </div>
  )
}

// ─── D3 sim types ─────────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  data: RecommendedConcept
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string
  label: string
  basis: string
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  framework: ExplanationFramework
  guidance?: WritingGuidance
  onNodeHover: (nodeId: string | undefined) => void
}

export default function ExplanationGraph({ framework, guidance, onNodeHover }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const isDragging = useRef(false)
  const nodesRef = useRef<SimNode[]>([])
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tooltipConcept = tooltip ? framework.concepts.find(c => c.id === tooltip.id) : undefined
  const tooltipSVOs = tooltipConcept ? computeSVOs(tooltipConcept.id, framework.concepts, framework.relationships) : []
  const relatedGuidance = tooltipConcept
    ? guidance?.sentenceGuidance.find(g =>
        g.concepts.some(c => c.toLowerCase() === tooltipConcept.label.toLowerCase()),
      )?.guidance
    : undefined

  const containerW = containerRef.current?.clientWidth ?? 600
  const tooltipLeft = tooltip ? clampTooltipLeft(tooltip.x, TOOLTIP_W, containerW) : 0
  const tooltipTop = tooltip ? clampTooltipTop(tooltip.y, TOOLTIP_H) : 0

  const handleExport = useCallback(() => {
    const svgEl = svgRef.current
    const nodes = nodesRef.current
    if (!svgEl || !nodes.length) return

    const pad = 40
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    nodes.forEach(n => {
      const r = nodeRadius(n.data) + 24
      x0 = Math.min(x0, (n.x ?? 0) - r)
      y0 = Math.min(y0, (n.y ?? 0) - r)
      x1 = Math.max(x1, (n.x ?? 0) + r)
      y1 = Math.max(y1, (n.y ?? 0) + r)
    })
    const W = Math.ceil(x1 - x0 + pad * 2)
    const H = Math.ceil(y1 - y0 + pad * 2)
    const scale = 2

    const cs = getComputedStyle(document.documentElement)
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(W))
    clone.setAttribute('height', String(H))

    clone.getElementById('fw-bg')?.remove()

    const containerG = Array.from(clone.children).find(el => el.tagName === 'g') as SVGGElement | undefined
    containerG?.setAttribute('transform', `translate(${pad - x0},${pad - y0})`)

    let markup = new XMLSerializer().serializeToString(clone)
    markup = markup.replace(/var\(--([^)]+)\)/g, (_, name) =>
      cs.getPropertyValue(`--${name.trim()}`).trim() || '#888888'
    )

    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale, scale)

    const blob = new Blob([markup], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H)
      URL.revokeObjectURL(url)
      const anchor = nodes.find(n => n.data.isAnchor)
      const topic = slugify(anchor?.data.label ?? 'graph')
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `${date}-${topic}-2.png`
      a.click()
    }
    img.src = url
  }, [])

  const fitToView = useCallback(() => {
    const svgEl = svgRef.current
    const wrap = containerRef.current
    const zoom = zoomRef.current
    const nodes = nodesRef.current
    if (!svgEl || !wrap || !zoom || !nodes.length) return
    requestAnimationFrame(() => {
      const W = wrap.clientWidth
      const H = wrap.clientHeight
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      nodes.forEach(n => {
        const r = nodeRadius(n.data)
        x0 = Math.min(x0, (n.x ?? 0) - r)
        y0 = Math.min(y0, (n.y ?? 0) - r)
        x1 = Math.max(x1, (n.x ?? 0) + r)
        y1 = Math.max(y1, (n.y ?? 0) + r)
      })
      const pad = 64
      const s = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0), 2.5)
      const tx = (W - (x1 - x0) * s) / 2 - x0 * s
      const ty = (H - (y1 - y0) * s) / 2 - y0 * s
      d3.select(svgEl).transition().duration(400).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(s),
      )
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('fullscreenchange', fitToView)
    return () => document.removeEventListener('fullscreenchange', fitToView)
  }, [fitToView])

  useEffect(() => {
    const svgEl = svgRef.current
    const wrap = containerRef.current
    if (!svgEl || !wrap) return

    if (simRef.current) { simRef.current.stop(); simRef.current = null }

    const W = wrap.clientWidth
    const H = wrap.clientHeight

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const defs = svg.append('defs')
    defs.append('pattern')
      .attr('id', 'fw-dot-grid')
      .attr('width', 24).attr('height', 24)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('circle').attr('cx', 12).attr('cy', 12).attr('r', 1).attr('fill', 'var(--canvas-dot)')

    const bases = ['observed_in_text', 'strong_topic_inference', 'optional_enrichment'] as const
    bases.forEach(basis => {
      defs.append('marker')
        .attr('id', `fw-arrow-${basis}`)
        .attr('viewBox', '0 -4 10 8').attr('refX', 10).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', BASIS_EDGE_COLOR[basis])
    })

    svg.append('rect').attr('id', 'fw-bg').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#fw-dot-grid)')

    const container = svg.append('g')

    const nodes: SimNode[] = framework.concepts.map(c => ({ id: c.id, data: c }))
    nodesRef.current = nodes
    const links: SimLink[] = framework.relationships.map(r => ({
      id: r.id, source: r.source, target: r.target, label: r.label, basis: r.basis,
    }))

    const anchor = nodes.find(n => n.data.isAnchor)
    if (anchor) { anchor.fx = W / 2; anchor.fy = H / 2 }
    nodes.filter(n => !n.data.isAnchor).forEach((n, i, arr) => {
      const angle = (2 * Math.PI * i) / arr.length - Math.PI / 2
      const r = Math.min(W, H) * 0.27
      n.x = W / 2 + r * Math.cos(angle)
      n.y = H / 2 + r * Math.sin(angle)
    })

    const sim = d3.forceSimulation<SimNode, SimLink>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id)
        .distance(d => d.basis === 'optional_enrichment' ? 130 : d.basis === 'strong_topic_inference' ? 110 : 90)
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(d => d.data.isAnchor ? -500 : -180))
      .force('collision', d3.forceCollide<SimNode>().radius(d => nodeRadius(d.data) + 14))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.04))
      .alphaDecay(0.025)

    simRef.current = sim

    const linkGroup = container.append('g')

    const linkEl = linkGroup.selectAll<SVGPathElement, SimLink>('path').data(links).join('path')
      .attr('fill', 'none')
      .attr('stroke', d => BASIS_EDGE_COLOR[d.basis] ?? BASIS_EDGE_COLOR.optional_enrichment)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', d => d.basis === 'optional_enrichment' ? 0.5 : 1)
      .attr('stroke-dasharray', d => d.basis === 'optional_enrichment' ? '4 3' : null)
      .attr('marker-end', d => `url(#fw-arrow-${d.basis})`)

    const linkLabelBg = linkGroup.selectAll<SVGRectElement, SimLink>('rect').data(links).join('rect')
      .attr('height', 12).attr('rx', 3)
      .attr('fill', 'var(--canvas-bg)').attr('fill-opacity', 0.9)

    const linkLabelEl = linkGroup.selectAll<SVGTextElement, SimLink>('text').data(links).join('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-size', 9).attr('fill', 'var(--text-dim)')
      .attr('pointer-events', 'none').attr('user-select', 'none')
      .text(d => d.label)

    linkLabelEl.each(function(d) { (d as SimLink & { _lw: number })._lw = (this as SVGTextElement).getComputedTextLength() + 8 })
    linkLabelBg.attr('width', d => (d as SimLink & { _lw: number })._lw ?? 40)

    const nodeGroup = container.append('g')

    const nodeEl = nodeGroup.selectAll<SVGGElement, SimNode>('g').data(nodes).join('g')
      .style('cursor', 'grab')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            isDragging.current = true
            clearTimeout(hideTimer.current)
            setTooltip(null)
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            isDragging.current = false
            if (!event.active) sim.alphaTarget(0)
            if (!d.data.isAnchor) { d.fx = null; d.fy = null }
          })
      )
      .on('mouseenter', function(event, d) {
        if (isDragging.current) return
        clearTimeout(hideTimer.current)
        const rect = wrap.getBoundingClientRect()
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, id: d.id })
        onNodeHover(d.id)
      })
      .on('mousemove', function(event) {
        if (isDragging.current) return
        const rect = wrap.getBoundingClientRect()
        setTooltip(t => t ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top } : t)
      })
      .on('mouseleave', () => {
        hideTimer.current = setTimeout(() => {
          setTooltip(null)
          onNodeHover(undefined)
        }, 250)
      })

    nodeEl.append('circle')
      .attr('r', d => nodeRadius(d.data))
      .attr('fill', d => nodeColor(d.data).fill)
      .attr('stroke', d => nodeColor(d.data).stroke)
      .attr('stroke-width', 2)

    nodeEl.filter(d => d.data.isAnchor).append('circle')
      .attr('r', d => nodeRadius(d.data) + 4)
      .attr('fill', 'none').attr('stroke', 'var(--border-hover)').attr('stroke-width', 1.5)

    nodeEl.append('text')
      .text(d => d.data.label)
      .attr('text-anchor', 'middle').attr('font-size', 10)
      .attr('fill', 'var(--text-muted)').attr('pointer-events', 'none').attr('user-select', 'none')
      .each(function(d) { d3.select(this).attr('dy', nodeRadius(d.data) + 6) })

    sim.on('tick', () => {
      linkEl.attr('d', d => {
        const s = d.source as SimNode; const t = d.target as SimNode
        const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0
        if (!s.x || !t.x) return ''
        const dx = tx - sx, dy = ty - sy
        const dist = Math.hypot(dx, dy)
        if (dist < 1) return ''
        const nx = dx / dist, ny = dy / dist
        const tr = nodeRadius((d.target as SimNode).data) + 8
        const ex = tx - nx * tr, ey = ty - ny * tr
        const mx = (sx + tx) / 2 - ny * 14, my = (sy + ty) / 2 + nx * 14
        return `M${sx},${sy} Q${mx},${my} ${ex},${ey}`
      })

      linkLabelEl
        .attr('x', d => { const s = d.source as SimNode; const t = d.target as SimNode; return ((s.x ?? 0) + (t.x ?? 0)) / 2 - ((t.y ?? 0) - (s.y ?? 0)) * 0.08 })
        .attr('y', d => { const s = d.source as SimNode; const t = d.target as SimNode; return ((s.y ?? 0) + (t.y ?? 0)) / 2 + ((t.x ?? 0) - (s.x ?? 0)) * 0.08 })

      linkLabelBg
        .attr('x', d => { const s = d.source as SimNode; const t = d.target as SimNode; const lw = (d as SimLink & { _lw: number })._lw ?? 40; return ((s.x ?? 0) + (t.x ?? 0)) / 2 - ((t.y ?? 0) - (s.y ?? 0)) * 0.08 - lw / 2 })
        .attr('y', d => { const s = d.source as SimNode; const t = d.target as SimNode; return ((s.y ?? 0) + (t.y ?? 0)) / 2 + ((t.x ?? 0) - (s.x ?? 0)) * 0.08 - 6 })

      nodeEl.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', e => container.attr('transform', e.transform.toString()))
    svg.call(zoom)
    zoomRef.current = zoom

    return () => { sim.stop() }
  }, [framework]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 relative"
        onMouseLeave={() => { clearTimeout(hideTimer.current); setTooltip(null); onNodeHover(undefined) }}
      >
        <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <GraphToolbar onExport={handleExport} onFullscreen={handleFullscreen} onResetView={fitToView} />

        {tooltipConcept && tooltip && (
          <div className="absolute pointer-events-none z-50" style={{ left: tooltipLeft, top: tooltipTop }}>
            <FrameworkTooltip concept={tooltipConcept} svos={tooltipSVOs} relatedGuidance={relatedGuidance} />
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t flex gap-x-4 gap-y-1 flex-wrap" style={{ borderColor: 'var(--border-solid)' }}>
        {(['observed_in_text', 'strong_topic_inference', 'optional_enrichment'] as const).map(basis => {
          const key = BASIS_KEY[basis]
          const c = FW_COLORS[key]
          return (
            <span key={basis} className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full border" style={{ background: c.fill, borderColor: c.stroke }} />
              {BASIS_LABEL[basis]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
