interface MacroDonutChartProps {
  proteinG: number
  carbsG: number
  fatG: number
}

const MACRO_KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const
// Témafüggő színek a tokens.css-ből, így sötét módban is kontrasztosak maradnak.
const COLORS = {
  protein: 'rgb(var(--primary))',
  carbs: 'rgb(var(--secondary))',
  fat: 'rgb(var(--destructive))',
} as const
const TRACK_COLOR = 'rgb(var(--muted))'

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
    <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-sm">
      <p className="mb-4 text-sm font-medium text-muted-foreground">Makróeloszlás</p>
      {/* Szűk képernyőn a jelmagyarázat a diagram alá törik, nem lóg ki a kártyából. */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
        <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90 sm:h-28 sm:w-28">
          <circle cx="50" cy="50" r={RADIUS} fill="none" style={{ stroke: TRACK_COLOR }} strokeWidth={STROKE} />
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
                style={{ stroke: seg.color }}
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
            <p className="text-sm text-muted-foreground">Még nincs kiszámított makróadat.</p>
          )}
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                {seg.label}
              </span>
              <span className="whitespace-nowrap font-medium tabular-nums text-foreground">{Math.round(seg.grams)} g</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
