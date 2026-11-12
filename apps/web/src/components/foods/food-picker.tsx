'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EditableFood, foodApiError } from './food-api'

export default function FoodPicker({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<EditableFood[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ type: 'BASIC', search: search.trim() })
        const response = await fetch(`${apiBaseUrl}/api/foods?${query}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(await foodApiError(response, 'Az alapanyagok betöltése sikertelen.'))
        }
        const data: EditableFood[] = await response.json()
        if (!controller.signal.aborted) setFoods(data)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Az alapanyagok betöltése sikertelen.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [apiBaseUrl, search, attempt])

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-6 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Vissza
        </Link>
        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Alapanyag szerkesztés</h1>
          <p className="mt-3 text-sm text-slate-600">
            Keresd meg és válaszd ki a módosítandó alapanyagot.
          </p>
          <label htmlFor="food-search" className="mb-2 mt-6 block text-sm text-slate-600">
            Keresés név vagy kategória alapján
          </label>
          <input
            id="food-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setIsLoading(true)
            }}
            placeholder="Pl. csirkemell vagy hús"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
          />
          <div className="mt-6" aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <p className="text-sm text-slate-500">Alapanyagok betöltése...</p>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="mt-3 font-semibold underline"
                >
                  Újrapróbálás
                </button>
              </div>
            ) : foods.length === 0 ? (
              <p className="text-sm text-slate-500">Nincs a keresésnek megfelelő alapanyag.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {foods.map((food) => (
                  <li key={food.id}>
                    <Link
                      href={`/moderator/foods/${encodeURIComponent(food.id)}/edit`}
                      className="flex items-center justify-between gap-4 rounded-xl px-3 py-4 transition hover:bg-slate-50 focus-visible:outline-slate-500"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium text-slate-900">{food.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {food.category || 'Nincs kategória'}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-slate-700">
                        Szerkesztés →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!isLoading && !error && foods.length === 50 && (
            <p className="mt-4 text-sm text-slate-500">
              Az első 50 találat látható. Pontosítsd a keresést további alapanyagokhoz.
            </p>
          )}
          <Link
            href="/moderator/foods/new"
            className="mt-8 inline-block text-sm font-medium text-slate-700 underline"
          >
            Új alapanyag létrehozása
          </Link>
        </section>
      </div>
    </main>
  )
}
