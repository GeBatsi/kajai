'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ThemeToggle } from '@kajai/ui'

/** A közös ThemeToggle bekötve a next-themes-be. */
export function AppThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  // A téma csak a kliensen ismert – addig nem renderelünk, hogy ne legyen hydration eltérés.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <ThemeToggle
      className={className}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      onThemeChange={setTheme}
    />
  )
}
