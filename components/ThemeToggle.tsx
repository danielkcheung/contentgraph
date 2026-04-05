'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle({ className }: { className?: string }) {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.classList.contains('light'))
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    if (next) {
      document.documentElement.classList.add('light')
      localStorage.setItem('site_theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('site_theme', 'dark')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {light ? '☾ Dark' : '☀ Light'}
    </button>
  )
}
