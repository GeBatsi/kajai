'use client'

import { useEffect, useState } from 'react'

interface CalorieProgressBarProps {
  dailyKcal: number
  consumedKcal?: number
}

export function CalorieProgressBar({ dailyKcal, consumedKcal = 0 }: CalorieProgressBarProps) {
  const targetPct = Math.min(100, Math.round((consumedKcal / dailyKcal) * 100))
  const remaining = Math.max(0, dailyKcal - consumedKcal)

  // A sáv 0-ról indul, majd az első render után a tényleges értékre animál –
  // enélkül a böngésző nem futtatná le a CSS width átmenetet a kezdeti állapotból.
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPct(targetPct))
    return () => cancelAnimationFrame(raf)
  }, [targetPct])

  return (
    <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium text-muted-foreground">Napi kalóriakeret</p>
        <p className="text-sm text-muted-foreground">
          {consumedKcal} / {dailyKcal} kcal
        </p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{remaining} kcal maradt ma</p>
    </div>
  )
}
