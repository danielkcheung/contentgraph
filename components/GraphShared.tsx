// Shared primitives used by both graph components

export function TooltipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-dim)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export function GraphToolbar({ onExport, onFullscreen, onResetView }: { onExport: () => void; onFullscreen: () => void; onResetView: () => void }) {
  return (
    <div className="absolute top-2 right-2 flex gap-1 z-10">
      <button
        onClick={onResetView}
        title="Reset view"
        className="flex items-center justify-center w-7 h-7 rounded border transition-colors"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)', color: 'var(--text-dim)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4" />
        </svg>
      </button>
      <button
        onClick={onExport}
        title="Export PNG"
        className="flex items-center justify-center w-7 h-7 rounded border transition-colors"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)', color: 'var(--text-dim)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
      <button
        onClick={onFullscreen}
        title="Fullscreen"
        className="flex items-center justify-center w-7 h-7 rounded border transition-colors"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-solid)', color: 'var(--text-dim)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
    </div>
  )
}
