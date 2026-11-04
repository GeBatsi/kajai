interface MacroDonutChartProps {
  proteinG: number
  carbsG: number
  fatG: number
}

const MACRO_KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const
const COLORS = { protein: '#3d5a80', carbs: '#e0a44f', fat: '#b3261e' } as const

const RADIUS = 42
const STROKE = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function MacroDonutChart({ proteinG, carbsG, fatG }: MacroDonutChartProps) {
  const proteinKcal = proteinG * MACRO_KCAL_PER_G.protein
  const carbsKcal = carbsG * MACRO_KCAL_PER_G.carbs
  const fatKcal = fatG * MACRO_KCAL_PER_G.fat
  const totalKcal = proteinKcal + carbsKcal + fatKcal

  const segments =
    totalKcal > 0
      ? [
          { key: 'protein', label: 'Fehérje', grams: proteinG, kcal: proteinKcal, color: COLORS.protein },
          { key: 'carbs', label: 'Szénhidrát', grams: carbsG, kcal: carbsKcal, color: COLORS.carbs },
          { key: 'fat', label: 'Zsír', grams: fatG, kcal: fatKcal, color: COLORS.fat },
        ]
      : []

  let offset = 0

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-medium text-gray-600">Makróeloszlás</p>
      {/* Szűk képernyőn a jelmagyarázat a diagram alá törik, nem lóg ki a kártyából. */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
        <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90 sm:h-28 sm:w-28">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#f1efe9" strokeWidth={STROKE} />
          {segments.map((seg) => {
            const length = (seg.kcal / totalKcal) * CIRCUMFERENCE
            const dashArray = `${length} ${CIRCUMFERENCE - length}`
            const dashOffset = -offset
            offset += length
            return (
              <circle
                key={seg.key}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dasharray] duration-500 ease-out"
              />
            )
          })}
        </svg>
        <div className="flex min-w-[9rem] flex-1 flex-col gap-2.5">
          {segments.length === 0 && (
            <p className="text-sm text-gray-400">Még nincs kiszámított makróadat.</p>
          )}
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                {seg.label}
              </span>
              <span className="whitespace-nowrap font-medium tabular-nums text-gray-900">{Math.round(seg.grams)} g</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
