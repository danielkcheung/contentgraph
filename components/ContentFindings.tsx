'use client'

import { useState, useRef } from 'react'
import { INTEGRATION_KEY, NODE_OBS_COLORS, clampTooltipLeft, clampTooltipTop } from '@/lib/utils'
import type { ContentContext, ObservedMap } from '@/lib/types'

const INT_LABEL: Record<string, string> = {
  well_integrated:     'Well integrated',
  weakly_integrated:   'Weakly integrated',
  underexplained:      'Underexplained',
  naming_inconsistent: 'Naming inconsistent',
}

// ─── Dot ─────────────────────────────────────────────────────────────────────

function IntDot({ state }: { state: string }) {
  const key = INTEGRATION_KEY[state] ?? 'weak'
  const c = NODE_OBS_COLORS[key]
  return (
    <span
      className="inline-block shrink-0 rounded-full border"
      style={{ width: 8, height: 8, background: c.bg, borderColor: c.border }}
    />
  )
}

// ─── Definition tooltip ───────────────────────────────────────────────────────

interface TooltipState { x: number; y: number; conceptId: string }

const TOOLTIP_W = 260
const TOOLTIP_H = 80

function DefinitionTooltip({ sentence, state }: { sentence: string; state: string }) {
  const key = INTEGRATION_KEY[state] ?? 'weak'
  const c = NODE_OBS_COLORS[key]
  return (
    <div
      className="rounded-xl border shadow-xl p-3 w-64 text-xs space-y-1.5"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)' }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: c.border }}
      >
        Defined in content
      </div>
      <p className="leading-snug italic" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
        "{sentence}"
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  context: ContentContext
  map: ObservedMap
}

export default function ContentFindings({ context, map }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const anchor = map.concepts.find(c => c.isAnchor)

  // Signal card counts
  const entityCount = map.concepts.length
  const relCount = map.relationships.length
  const explicitCount = map.relationships.filter(r => r.isExplicit).length
  const impliedCount = relCount - explicitCount

  const intCounts = map.concepts.reduce<Record<string, number>>((acc, c) => {
    acc[c.integrationState] = (acc[c.integrationState] ?? 0) + 1
    return acc
  }, {})
  const wellCount = intCounts['well_integrated'] ?? 0
  const needCount = entityCount - wellCount

  // SVO rows: each relationship becomes subject → verb → object
  const conceptMap = new Map(map.concepts.map(c => [c.id, c]))
  const svoRows = map.relationships.map(r => ({
    rel: r,
    subject: conceptMap.get(r.source),
    object: conceptMap.get(r.target),
  })).filter(row => row.subject && row.object)

  // Tooltip handlers
  const handleSubjectEnter = (e: React.MouseEvent, conceptId: string) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      conceptId,
    })
  }

  const handleSubjectLeave = () => setTooltip(null)

  const tooltipConcept = tooltip ? conceptMap.get(tooltip.conceptId) : undefined
  const containerW = containerRef.current?.clientWidth ?? 600
  const tooltipLeft = tooltip ? clampTooltipLeft(tooltip.x, TOOLTIP_W, containerW) : 0
  const tooltipTop = tooltip ? clampTooltipTop(tooltip.y, TOOLTIP_H) : 0

  return (
    <div
      ref={containerRef}
      className="rounded-xl border overflow-hidden relative"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-solid)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-solid)' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Content Analysis
        </span>
        <span
          className="text-[10px] rounded-full px-2.5 py-0.5 border"
          style={{
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            borderColor: 'var(--border-solid)',
          }}
        >
          {entityCount} entities · {relCount} relationships
        </span>
      </div>

      <div className="p-4 space-y-4">

        {/* Narrative */}
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          This content centres on{' '}
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {context.primaryAnchor}
          </span>
          {anchor?.explanatoryRole ? ` — ${anchor.explanatoryRole.replace(/^the main subject,?\s*/i, '')}` : ''}.
          {' '}Written for{' '}
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {context.inferredAudience}
          </span>
          {' '}as {context.inferredFormat === 'overview' || context.inferredFormat === 'article' ? 'an' : 'a'}{' '}
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {context.inferredFormat}
          </span>
          {' '}at{' '}
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {context.inferredDepth}
          </span>
          {' '}depth.
        </p>

        {/* Signal cards */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-lg border p-3 space-y-1"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)' }}
          >
            <div
              className="text-[20px] font-bold leading-none tracking-tight"
              style={{ color: 'var(--node-obs-integrated-border)' }}
            >
              {entityCount}
            </div>
            <div className="text-[9px] uppercase tracking-[0.07em]" style={{ color: 'var(--text-dim)' }}>
              Entities
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Anchor: {context.primaryAnchor}
            </div>
          </div>

          <div
            className="rounded-lg border p-3 space-y-1"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)' }}
          >
            <div
              className="text-[20px] font-bold leading-none tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {relCount}
            </div>
            <div className="text-[9px] uppercase tracking-[0.07em]" style={{ color: 'var(--text-dim)' }}>
              Relationships
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {explicitCount} explicit · {impliedCount} implied
            </div>
          </div>

          <div
            className="rounded-lg border p-3 space-y-1"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)' }}
          >
            <div
              className="text-[20px] font-bold leading-none tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {wellCount}
            </div>
            <div className="text-[9px] uppercase tracking-[0.07em]" style={{ color: 'var(--text-dim)' }}>
              Well integrated
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {needCount} need attention
            </div>
          </div>
        </div>

        {/* SVO table */}
        {svoRows.length > 0 && (
          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {(['Subject', 'Relationship', 'Object'] as const).map(h => (
                    <th
                      key={h}
                      className="text-left pb-2 border-b"
                      style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: 'var(--text-dim)',
                        fontWeight: 500,
                        borderColor: 'var(--border-solid)',
                        width: h === 'Relationship' ? '30%' : '35%',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {svoRows.map(({ rel, subject, object }) => (
                  <tr
                    key={rel.id}
                    style={{ borderBottom: '1px solid var(--surface-2)' }}
                  >
                    {/* Subject — hoverable */}
                    <td className="py-[5px] pr-2">
                      <span
                        className="inline-flex items-center gap-1.5 cursor-default rounded px-1 -mx-1 transition-colors"
                        style={{ fontSize: 10, color: 'var(--text-muted)' }}
                        onMouseEnter={e => handleSubjectEnter(e, subject!.id)}
                        onMouseLeave={handleSubjectLeave}
                        onMouseMove={e => {
                          const container = containerRef.current
                          if (!container) return
                          const rect = container.getBoundingClientRect()
                          setTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : t)
                        }}
                      >
                        <IntDot state={subject!.integrationState} />
                        {subject!.label}
                      </span>
                    </td>

                    {/* Verb */}
                    <td
                      className="py-[5px] pr-2 italic"
                      style={{ fontSize: 10, color: 'var(--text-dim)' }}
                    >
                      {rel.label}
                      {!rel.isExplicit && (
                        <span
                          className="ml-1 not-italic"
                          style={{ fontSize: 8, color: 'var(--text-dim)', opacity: 0.7 }}
                          title="Implied relationship"
                        >
                          ~
                        </span>
                      )}
                    </td>

                    {/* Object */}
                    <td className="py-[5px]">
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ fontSize: 10, color: 'var(--text-muted)' }}
                      >
                        <IntDot state={object!.integrationState} />
                        {object!.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Integration legend */}
        <div
          className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t"
          style={{ borderColor: 'var(--border-solid)' }}
        >
          {Object.entries(intCounts).map(([state, count]) => {
            const key = INTEGRATION_KEY[state]
            if (!key) return null
            const c = NODE_OBS_COLORS[key]
            return (
              <span
                key={state}
                className="inline-flex items-center gap-1"
                style={{ fontSize: 10, color: 'var(--text-dim)' }}
              >
                <span
                  className="inline-block rounded-full border"
                  style={{ width: 8, height: 8, background: c.bg, borderColor: c.border }}
                />
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                {' '}{INT_LABEL[state]}
              </span>
            )
          })}
          <span
            className="inline-flex items-center gap-1 ml-auto"
            style={{ fontSize: 10, color: 'var(--text-dim)' }}
          >
            <span className="inline-block w-3 border-t border-dashed" style={{ borderColor: 'var(--text-dim)' }} />
            Implied relationship
          </span>
        </div>
      </div>

      {/* Definition tooltip */}
      {tooltipConcept && tooltip && (
        <div
          className="absolute pointer-events-none z-50"
          style={{ left: tooltipLeft, top: tooltipTop }}
        >
          <DefinitionTooltip
            sentence={tooltipConcept.definitionSentence}
            state={tooltipConcept.integrationState}
          />
        </div>
      )}
    </div>
  )
}
