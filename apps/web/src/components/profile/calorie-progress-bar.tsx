interface CalorieProgressBarProps {
  dailyKcal: number
  consumedKcal?: number
}

export function CalorieProgressBar({ dailyKcal, consumedKcal = 0 }: CalorieProgressBarProps) {
  const pct = Math.min(100, Math.round((consumedKcal / dailyKcal) * 100))
  const remaining = Math.max(0, dailyKcal - consumedKcal)

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-600">Napi kalóriakeret</p>
        <p className="text-sm text-gray-400">
          {consumedKcal} / {dailyKcal} kcal
        </p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gray-900 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-400">{remaining} kcal maradt ma</p>
    </div>
  )
}
