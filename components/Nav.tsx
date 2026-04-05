'use client'

import ThemeToggle from './ThemeToggle'

interface NavProps {
  showReset?: boolean
  onReset?: () => void
}

export default function Nav({ showReset, onReset }: NavProps) {
  return (
    <header className="nav" role="banner">
      <div className="nav-inner">
        <span className="nav-brand">ContentGraph</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle className="nav-theme-toggle" />
          {showReset && onReset && (
            <button
              type="button"
              className="nav-cta"
              onClick={onReset}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
