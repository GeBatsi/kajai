'use client'
import { useEffect, useRef, useState } from 'react'
import {
  nutrientLabels,
  nutrients,
  nutritionDisplay,
  normalizeNutrition,
} from '@/lib/correction-nutrition'
export function Comparison({
  original,
  proposed,
  current,
  currentState,
}: {
  original: unknown
  proposed: unknown
  current?: unknown
  currentState?: 'loading' | 'unverified'
}) {
  const region = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const element = region.current
    if (!element) return
    const measure = () =>
      setOverflow(window.innerWidth < 768 && element.scrollWidth > element.clientWidth + 1)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    const table = element.querySelector('table')
    if (table) observer?.observe(table)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [original, proposed, current, currentState])
  function changed(key: (typeof nutrients)[number]) {
    try {
      const a = normalizeNutrition(original),
        b = normalizeNutrition(proposed)
      return a[key] !== b[key]
    } catch {
      return true
    }
  }
  return (
    <div className="min-w-0">
      {overflow && (
        <p className="mb-2 text-sm text-muted-foreground md:hidden">
          Húzd oldalra a további adatok megtekintéséhez.
        </p>
      )}
      <div
        ref={region}
        tabIndex={0}
        role="region"
        aria-label="Tápértékek, vízszintesen görgethető összehasonlítás"
        className="overflow-x-auto rounded-md border border-border"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Tápértékek összehasonlítása 100 g vagy 100 ml mennyiségre
          </caption>
          <thead className="bg-muted">
            <tr>
              <th className="p-3">Tápérték</th>
              <th className="p-3">{current === undefined ? 'Jelenlegi' : 'Beküldéskori'}</th>
              <th className="p-3">Javasolt</th>
              {current !== undefined && <th className="p-3">Jelenlegi</th>}
            </tr>
          </thead>
          <tbody>
            {nutrients.map((k) => (
              <tr
                key={k}
                className={
                  changed(k)
                    ? 'border-t border-border bg-accent/50 font-medium'
                    : 'border-t border-border'
                }
              >
                <th scope="row" className="p-3">
                  {nutrientLabels[k]}
                  {changed(k) && <span className="block text-xs text-primary">Módosítva</span>}
                </th>
                <td className="p-3">{nutritionDisplay(original, k)}</td>
                <td className="p-3">{nutritionDisplay(proposed, k)}</td>
                {current !== undefined && (
                  <td className="p-3">
                    {currentState
                      ? currentState === 'loading'
                        ? 'Frissítés…'
                        : 'Nem ellenőrzött'
                      : nutritionDisplay(current, k)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
