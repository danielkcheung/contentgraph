'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import ContentInspector from '@/components/ContentInspector'
import ContentFindings from '@/components/ContentFindings'
import WritingGuidancePanel from '@/components/WritingGuidancePanel'
import Nav from '@/components/Nav'
import { useAnalysis } from '@/hooks/useAnalysis'
import { slugify, stripQuotes } from '@/lib/utils'
import type { WritingGuidance, ExplanationFramework } from '@/lib/types'

const ObservedGraph = dynamic(() => import('@/components/ObservedGraph'), { ssr: false })
const ExplanationGraph = dynamic(() => import('@/components/ExplanationGraph'), { ssr: false })

// ─── Guidance export ─────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function buildGuidanceMarkdown(guidance: WritingGuidance, framework?: ExplanationFramework): string {
  const anchor = framework?.concepts.find(c => c.isAnchor)?.label ?? 'Content'
  const lines: string[] = []

  lines.push(`# Writing Guidance — ${anchor}`, '')

  if (guidance.summary) {
    lines.push(guidance.summary, '')
  }

  const tableSections = [
    { title: 'What to Add',                     col: 'Instruction',        items: guidance.toAdd },
    { title: 'What to Clarify',                 col: 'Instruction',        items: guidance.toClarify },
    { title: 'Relationships to Make Explicit',  col: 'Connection to state', items: guidance.toMakeExplicit },
  ]

  for (const { title, col, items } of tableSections) {
    if (!items.length) continue
    lines.push(`## ${title}`, '')
    lines.push(`| ${col} | Example phrasing |`)
    lines.push('|---|---|')
    for (const item of items) {
      lines.push(`| ${esc(item.instruction)} | "${esc(stripQuotes(item.example))}" |`)
    }
    lines.push('')
  }

  if (guidance.sentenceGuidance.length) {
    lines.push('## How to Structure Your Writing', '')
    for (const sg of guidance.sentenceGuidance) {
      lines.push(`### ${sg.concepts.join(' → ')}`, '')
      lines.push(sg.guidance)
      if (sg.example) lines.push('', `> "${stripQuotes(sg.example)}"`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── API key ─────────────────────────────────────────────────────────────────

function useApiKey() {
  const [apiKey, setApiKeyState] = useState('')
  const [keySet, setKeySet] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('anthropic_api_key')
    if (stored) { setApiKeyState(stored); setKeySet(true) }
  }, [])

  const saveKey = useCallback((key: string) => {
    sessionStorage.setItem('anthropic_api_key', key)
    setApiKeyState(key); setKeySet(true)
  }, [])

  const clearKey = useCallback(() => {
    sessionStorage.removeItem('anthropic_api_key')
    setApiKeyState(''); setKeySet(false)
  }, [])

  return { apiKey, keySet, saveKey, clearKey }
}

// ─── Extracted graph tooltip ─────────────────────────────────────────────────

function ExtractedGraphHeading() {
  const [show, setShow] = useState(false)
  return (
    <div
      className="relative inline-flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Extracted Graph</span>
      <svg
        className="w-3.5 h-3.5"
        style={{ color: 'var(--text-dim)' }}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx={12} cy={12} r={10} />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
      </svg>
      {show && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            top: 'calc(100% + 8px)',
            left: 0,
            width: 300,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-solid)',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,.45)',
          }}
        >
          <p className="font-semibold mb-2" style={{ fontSize: 11, color: 'var(--text)' }}>
            What is the Extracted Graph?
          </p>
          <p className="leading-relaxed mb-2.5" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            This graph maps only what is actually present in your content — entities, processes, and ideas that were mentioned, and the relationships between them that could be identified.
          </p>
          <p className="leading-relaxed mb-2.5" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Node size reflects how often a concept is mentioned. Colour shows how well it is integrated into the explanation.
          </p>
          <div className="space-y-1.5">
            <p className="font-semibold" style={{ fontSize: 10, color: 'var(--text-muted)' }}>What to look for:</p>
            <p style={{ fontSize: 10, color: 'var(--text-dim)' }} className="leading-relaxed">
              Solid lines = explicit relationships stated in the text. Dashed lines = implied connections the model inferred. Hover any node to see evidence from your content.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Proposed graph tooltip ───────────────────────────────────────────────────

function ProposedGraphHeading() {
  const [show, setShow] = useState(false)
  return (
    <div
      className="relative inline-flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Proposed Graph</span>
      <svg
        className="w-3.5 h-3.5"
        style={{ color: 'var(--text-dim)' }}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx={12} cy={12} r={10} />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
      </svg>
      {show && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            top: 'calc(100% + 8px)',
            left: 0,
            width: 300,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-solid)',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,.45)',
          }}
        >
          <p className="font-semibold mb-2" style={{ fontSize: 11, color: 'var(--text)' }}>
            What is the Proposed Graph?
          </p>
          <p className="leading-relaxed mb-2.5" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            This graph shows the complete set of entities and relationships that should be addressed for thorough coverage of this topic. It is built from the topic itself, not just what&apos;s already in your content.
          </p>
          <div className="space-y-1.5 mb-2.5">
            <div className="flex items-center gap-2" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--node-fw-observed-bg)', border: '1px solid var(--node-fw-observed-border)' }} />
              <span><strong style={{ color: 'var(--text-muted)' }}>In content</strong> — concept already addressed in your article</span>
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--node-fw-inferred-bg)', border: '1px solid var(--node-fw-inferred-border)' }} />
              <span><strong style={{ color: 'var(--text-muted)' }}>Inferred</strong> — needed for this topic and audience, missing from content</span>
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--node-fw-optional-bg)', border: '1px solid var(--node-fw-optional-border)' }} />
              <span><strong style={{ color: 'var(--text-muted)' }}>Optional</strong> — enriches depth, not required for basic understanding</span>
            </div>
          </div>
          <p className="leading-relaxed" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            The more of these entities you cover with explicit relationships, the stronger the semantic signal your content sends.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function StatusBar({ stage }: { stage?: string }) {
  if (!stage) return null
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
      <span className="inline-block w-3 h-3 border-2 border-[var(--border-solid)] border-t-[var(--text-muted)] rounded-full animate-spin" />
      {stage}
    </div>
  )
}

// ─── Locked right panel ───────────────────────────────────────────────────────

function LockedFrameworkPanel({ onGenerate, loading }: { onGenerate: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <div className="w-10 h-10 rounded-full border border-[var(--border-solid)] flex items-center justify-center">
        <svg className="w-5 h-5 text-[var(--text-dim)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
        Review the Extracted Graph first. When ready, generate the Proposed Graph and writing guidance.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-[var(--text)] text-[var(--bg)] hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {loading ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
            Generating…
          </>
        ) : 'Generate →'}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { apiKey, keySet, saveKey, clearKey } = useApiKey()
  const [keyInput, setKeyInput] = useState('')
  const [content, setContent] = useState('')
  const [inputType, setInputType] = useState<'text' | 'html'>('html')

  const { phase, data, error, currentStage, analyzePhase1, analyzePhase2, reset } = useAnalysis()
  const [hoveredConceptId, setHoveredConceptId] = useState<string>()
  const [inputExpanded, setInputExpanded] = useState(true)
  const [graphVisible, setGraphVisible] = useState(false)
  const graphTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleReset = useCallback(() => {
    clearTimeout(graphTimerRef.current)
    reset()
    setHoveredConceptId(undefined)
    setInputExpanded(true)
    setGraphVisible(false)
  }, [reset])

  const handleAnalyze = useCallback(() => {
    if (!content.trim() || !keySet) return
    setHoveredConceptId(undefined)
    analyzePhase1(content, inputType, apiKey)
  }, [content, inputType, apiKey, keySet, analyzePhase1])

  const handleGenerate = useCallback(() => {
    if (!keySet) return
    analyzePhase2(apiKey)
  }, [apiKey, keySet, analyzePhase2])

  const handleConceptHover = useCallback((nodeId: string | undefined) => {
    setHoveredConceptId(nodeId)
  }, [])

  const hoveredConcept = data.explanationFramework?.concepts.find(c => c.id === hoveredConceptId)

  const isPhase1Running = phase === 'phase1'
  const isPhase2Running = phase === 'phase2'
  const isRunning = isPhase1Running || isPhase2Running
  const phase1Done = phase === 'phase1_done' || phase === 'phase2' || phase === 'done'

  // Collapse input once observed map arrives
  useEffect(() => {
    if (phase1Done) setInputExpanded(false)
  }, [phase1Done])

  // Show graph 800ms after findings panel appears
  useEffect(() => {
    if (data.observedMap && !graphVisible) {
      clearTimeout(graphTimerRef.current)
      graphTimerRef.current = setTimeout(() => setGraphVisible(true), 800)
    }
  }, [data.observedMap]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Nav showReset={phase !== 'idle'} onReset={handleReset} />
      <div className="min-h-screen bg-[var(--bg)]" style={{ fontSize: 16, lineHeight: 'normal' }}>

        {/* Narrow column — header, input, findings */}
        <div className="max-w-2xl mx-auto px-6 pt-10 pb-0 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">ContentGraph</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Find the concept gaps that make good explanations hard to retrieve
              </p>
            </div>
          </div>

          {/* API key entry */}
          <div>
            {!keySet ? (
              <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] p-4">
                <div className="text-sm font-medium text-[var(--text)] mb-2">Anthropic API key</div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="sk-ant-…"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && keyInput.trim()) saveKey(keyInput.trim()) }}
                    className="flex-1 text-sm border border-[var(--border-solid)] bg-[var(--surface-2)] text-[var(--text)] rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-[var(--text-dim)] placeholder:text-[var(--text-dim)]"
                  />
                  <button
                    onClick={() => { if (keyInput.trim()) saveKey(keyInput.trim()) }}
                    disabled={!keyInput.trim()}
                    className="px-4 py-2 text-sm font-medium bg-[var(--text)] text-[var(--bg)] rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
                  >
                    Set key
                  </button>
                </div>
                <p className="text-xs text-[var(--text-dim)] mt-1.5">Stored in sessionStorage only — cleared when you close the tab.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                API key set
                <button onClick={clearKey} className="underline hover:text-[var(--text-muted)] ml-1">Clear</button>
              </div>
            )}
          </div>

          {/* Input panel — collapsible */}
          <div>
            {phase1Done && !inputExpanded ? (
              <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Content analyzed</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="text-xs text-[var(--text-muted)] border border-[var(--border-solid)] rounded-lg px-3 py-1.5 hover:border-[var(--border-hover)] transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setInputExpanded(true)}
                    className="text-xs text-[var(--text-muted)] border border-[var(--border-solid)] rounded-lg px-3 py-1.5 hover:border-[var(--border-hover)] transition-colors"
                  >
                    Edit input
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-[var(--text)]">Input type</div>
                  <div className="flex rounded-lg border border-[var(--border-solid)] overflow-hidden text-sm">
                    {(['html', 'text'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setInputType(t)}
                        className={`px-3 py-1.5 font-medium transition-colors ${
                          inputType === t
                            ? 'bg-[var(--text)] text-[var(--bg)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={inputType === 'html'
                    ? 'Paste page source here. (View > Developer > View Source → Select All → Copy)'
                    : 'Paste plain text content here…'}
                  rows={8}
                  className="w-full text-sm border border-[var(--border-solid)] bg-[var(--surface-2)] text-[var(--text)] rounded-lg px-3 py-2.5 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[var(--text-dim)] placeholder:text-[var(--text-dim)]"
                />

                <div className="flex items-center justify-between">
                  <StatusBar stage={currentStage} />
                  <div className="flex gap-2">
                    {phase !== 'idle' && (
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] border border-[var(--border-solid)] rounded-lg hover:border-[var(--border-hover)] transition-colors"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={handleAnalyze}
                      disabled={!content.trim() || !keySet || isRunning || phase1Done}
                      className="px-5 py-2 text-sm font-medium bg-[var(--text)] text-[var(--bg)] rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
                    >
                      {isPhase1Running ? 'Analyzing…' : 'Analyze'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {phase === 'error' && error && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Content inspector */}
          {data.extractedContent && (
            <ContentInspector content={data.extractedContent} />
          )}

          {/* Findings panel */}
          {data.observedMap && data.contentContext && (
            <div className="animate-fade-in-up">
              <ContentFindings context={data.contentContext} map={data.observedMap} />
            </div>
          )}

          {/* Loading indicator while phase 1 is running */}
          {isPhase1Running && !data.observedMap && (
            <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] px-4 py-8 flex items-center justify-center gap-2 text-sm text-[var(--text-dim)]">
              <span className="inline-block w-3 h-3 border-2 border-[var(--border-solid)] border-t-[var(--text-dim)] rounded-full animate-spin" />
              Mapping content…
            </div>
          )}

        </div>

        {/* Wide column — graphs */}
        {graphVisible && data.observedMap && (
          <div className="max-w-5xl mx-auto px-6 mt-6 space-y-4 animate-fade-in-up">

            {/* Extracted graph */}
            <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-solid)]">
                <ExtractedGraphHeading />
              </div>
              <div style={{ height: 480 }}>
                <ObservedGraph
                  key={data.observedMap.concepts.find(c => c.isAnchor)?.id ?? data.observedMap.concepts.length}
                  map={data.observedMap}
                />
              </div>
            </div>

            {/* Proposed graph */}
            <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] overflow-visible">
              <div className="px-4 py-3 border-b border-[var(--border-solid)]">
                <ProposedGraphHeading />
              </div>
              <div style={{ height: 540 }} className="overflow-hidden rounded-b-xl">
                {data.explanationFramework ? (
                  <ExplanationGraph
                    key={data.explanationFramework.concepts.find(c => c.isAnchor)?.id ?? data.explanationFramework.concepts.length}
                    framework={data.explanationFramework}
                    guidance={data.writingGuidance}
                    onNodeHover={handleConceptHover}
                  />
                ) : (
                  <LockedFrameworkPanel onGenerate={handleGenerate} loading={isPhase2Running} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Narrow column — writing guidance */}
        {!!data.observedMap && (
          <div className="max-w-2xl mx-auto px-6 mt-6 pb-10">
            <div className="rounded-xl border border-[var(--border-solid)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-semibold text-[var(--text)]">Writing Guidance</div>
                {data.writingGuidance && (
                  <button
                    onClick={() => {
                      const md = buildGuidanceMarkdown(data.writingGuidance!, data.explanationFramework)
                      const anchor = data.explanationFramework?.concepts.find(c => c.isAnchor)?.label ?? 'content'
                      const topic = slugify(anchor)
                      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
                      downloadMarkdown(md, `${date}-${topic}-guidance.md`)
                    }}
                    title="Export as Markdown"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors"
                    style={{ borderColor: 'var(--border-solid)', color: 'var(--text-dim)', background: 'var(--surface-2)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export .md
                  </button>
                )}
              </div>
              {data.writingGuidance ? (
                <WritingGuidancePanel
                  guidance={data.writingGuidance}
                  highlightedConcept={hoveredConcept?.label}
                  framework={data.explanationFramework}
                />
              ) : isPhase2Running ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <span className="inline-block w-5 h-5 border-2 border-[var(--border-solid)] border-t-[var(--text-muted)] rounded-full animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Generating writing guidance…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center opacity-50">
                  <svg className="w-7 h-7 text-[var(--text-dim)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
                    Writing guidance will appear here after you generate the Proposed Graph above.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
