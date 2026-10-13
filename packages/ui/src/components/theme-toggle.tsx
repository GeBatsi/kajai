'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ThemeToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** Az aktuálisan megjelenített téma. */
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
}

/**
 * Világos/sötét mód kapcsoló. Szándékosan nem tud a next-themes-ről: az app adja
 * át az aktuális témát, így Storybookban és más appban is használható.
 */
const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ theme, onThemeChange, className, ...props }, ref) => {
    const isDark = theme === 'dark'
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Sötét mód"
        title={isDark ? 'Váltás világos módra' : 'Váltás sötét módra'}
        onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          className,
        )}
        {...props}
      >
        {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
      </button>
    )
  },
)
ThemeToggle.displayName = 'ThemeToggle'

export { ThemeToggle }
