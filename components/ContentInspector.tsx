'use client'

import { useState } from 'react'
import type { ExtractedContent } from '@/lib/types'

interface Props { content: ExtractedContent }

export default function ContentInspector({ content }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-[var(--border-solid)] rounded-xl bg-[var(--surface)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>Extracted content</span>
          <span className="text-xs text-[var(--text-dim)] font-normal">
            {content.diagnostics.sentenceCount} sentences · {content.diagnostics.characterCount.toLocaleString()} chars ·{' '}
            via <span className="font-mono">&lt;{content.diagnostics.method}&gt;</span>
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-dim)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--border-solid)]">
          {content.diagnostics.warning && (
            <div className="mx-4 mt-3 px-3 py-2 bg-amber-950/30 border border-amber-900/40 rounded-lg text-xs text-amber-400">
              {content.diagnostics.warning}
            </div>
          )}
          <div className="p-4 max-h-64 overflow-y-auto">
            <pre className="text-xs text-[var(--text-muted)] whitespace-pre-wrap font-mono leading-relaxed">
              {content.text}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
