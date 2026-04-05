'use client'

import type { WritingGuidance, WritingGuidanceItem, ExplanationFramework } from '@/lib/types'
import { BASIS_KEY, stripQuotes } from '@/lib/utils'

interface Props {
  guidance: WritingGuidance
  highlightedConcept?: string
  framework?: ExplanationFramework
}

// ─── Table section ────────────────────────────────────────────────────────────

function GuidanceTable({
  title,
  description,
  firstColHeader,
  items,
}: {
  title: string
  description: string
  firstColHeader: string
  items: WritingGuidanceItem[]
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <div
        className="text-[10px] font-bold uppercase tracking-[0.07em]"
        style={{ color: 'var(--text-dim)' }}
      >
        {title}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        {description}
      </p>
      <table className="w-full text-sm mt-3" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              className="text-left pb-2 text-[11px] font-semibold"
              style={{
                color: 'var(--text-dim)',
                borderBottom: '1px solid var(--border-solid)',
                width: '50%',
                paddingRight: 24,
              }}
            >
              {firstColHeader}
            </th>
            <th
              className="text-left pb-2 text-[11px] font-semibold"
              style={{
                color: 'var(--text-dim)',
                borderBottom: '1px solid var(--border-solid)',
              }}
            >
              Example phrasing
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td
                className="align-top leading-relaxed"
                style={{
                  color: 'var(--text-muted)',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border-solid)' : undefined,
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingRight: 24,
                  width: '50%',
                }}
              >
                {item.instruction}
              </td>
              <td
                className="align-top leading-relaxed italic"
                style={{
                  color: 'var(--text-dim)',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border-solid)' : undefined,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              >
                &ldquo;{stripQuotes(item.example)}&rdquo;
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Sentence guidance ────────────────────────────────────────────────────────

// Mini node circle matching the Proposed Graph visual language
function ConceptNode({
  label,
  basisKey,
  highlighted,
}: {
  label: string
  basisKey: string
  highlighted: boolean
}) {
  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ minWidth: 52, maxWidth: 72 }}
    >
      <div
        className="rounded-full border-2 flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          background: highlighted
            ? `var(--node-fw-${basisKey}-border)`
            : `var(--node-fw-${basisKey}-bg)`,
          borderColor: `var(--node-fw-${basisKey}-border)`,
          transition: 'background 0.15s',
          boxShadow: highlighted ? `0 0 0 3px var(--node-fw-${basisKey}-border)33` : 'none',
        }}
      />
      <span
        className="text-center leading-tight"
        style={{ fontSize: 9, color: 'var(--text-muted)', wordBreak: 'break-word' }}
      >
        {label}
      </span>
    </div>
  )
}

function SentenceGuidanceSection({
  guidance,
  highlightedConcept,
  framework,
}: {
  guidance: WritingGuidance['sentenceGuidance']
  highlightedConcept?: string
  framework?: ExplanationFramework
}) {
  if (guidance.length === 0) return null

  const hl = highlightedConcept?.toLowerCase()

  // Build label → basisKey lookup from framework
  const basisMap = new Map<string, string>()
  framework?.concepts.forEach(c => {
    basisMap.set(c.label.toLowerCase(), BASIS_KEY[c.basis] ?? 'inferred')
  })

  return (
    <div className="space-y-2">
      <div
        className="text-[10px] font-bold uppercase tracking-[0.07em]"
        style={{ color: 'var(--text-dim)' }}
      >
        How to structure your writing
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        Each card groups related concepts that should be explained together or in sequence. Use the guidance as a structural prompt — not a template, but a starting point for how to connect these ideas in your own words.
      </p>
      <div className="space-y-2 pt-1">
        {guidance.map((sg, i) => {
          const isHighlighted = hl
            ? sg.concepts.some(c => c.toLowerCase() === hl)
            : false
          return (
            <div
              key={i}
              className="rounded-xl border p-4 space-y-3"
              style={{
                borderColor: isHighlighted ? 'rgba(59,130,246,0.4)' : 'var(--border-solid)',
                background: isHighlighted ? 'rgba(59,130,246,0.05)' : 'var(--surface)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div className="flex flex-wrap items-start gap-2">
                {sg.concepts.map((c, j) => {
                  const basisKey = basisMap.get(c.toLowerCase()) ?? 'inferred'
                  return (
                    <div key={j} className="flex items-start gap-2">
                      {j > 0 && (
                        <span className="mt-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>→</span>
                      )}
                      <ConceptNode
                        label={c}
                        basisKey={basisKey}
                        highlighted={hl === c.toLowerCase()}
                      />
                    </div>
                  )
                })}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {sg.guidance}
              </p>
              {sg.example && (
                <p
                  className="text-xs leading-relaxed italic"
                  style={{
                    color: 'var(--text-dim)',
                    padding: '7px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-solid)',
                    borderRadius: 8,
                  }}
                >
                  &ldquo;{stripQuotes(sg.example)}&rdquo;
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function WritingGuidancePanel({ guidance, highlightedConcept, framework }: Props) {
  return (
    <div className="space-y-8">
      {guidance.summary && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {guidance.summary}
        </p>
      )}
      <GuidanceTable
        title="What to add"
        description="Concepts missing or underdeveloped in your current content."
        firstColHeader="Instruction"
        items={guidance.toAdd}
      />
      <GuidanceTable
        title="What to clarify"
        description="Concepts already present but explained in a way that may confuse or mislead."
        firstColHeader="Instruction"
        items={guidance.toClarify}
      />
      <GuidanceTable
        title="Relationships to make explicit"
        description="Connections between concepts that are implied or assumed but never directly stated."
        firstColHeader="Connection to state"
        items={guidance.toMakeExplicit}
      />
      <SentenceGuidanceSection
        guidance={guidance.sentenceGuidance}
        highlightedConcept={highlightedConcept}
        framework={framework}
      />
    </div>
  )
}
