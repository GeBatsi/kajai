'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EditableFood, foodApiError } from './food-api'
import FoodForm from './food-form'

export default function FoodEditor({ apiBaseUrl, foodId }: { apiBaseUrl: string; foodId: string }) {
  const [food, setFood] = useState<EditableFood | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFood(null)
    setError(null)
    async function loadFood() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/foods/${encodeURIComponent(foodId)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(await foodApiError(response, 'Az alapanyag betöltése sikertelen.'))
        }
        const data: EditableFood = await response.json()
        if (data.type !== 'BASIC') throw new Error('Ezen az oldalon csak alapanyag szerkeszthető.')
        if (!controller.signal.aborted) setFood(data)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Az alapanyag betöltése sikertelen.')
        }
      }
    }
    void loadFood()
    return () => controller.abort()
  }, [apiBaseUrl, foodId, attempt])

  if (food && food.id === foodId) {
    return (
      <FoodForm
        key={food.id}
        apiBaseUrl={apiBaseUrl}
        initialFood={food}
        backHref="/moderator/foods/edit"
        title="Alapanyag szerkesztés"
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/moderator/foods/edit"
          className="mb-6 inline-block text-sm text-slate-500 hover:text-slate-700"
        >
          ← Vissza az alapanyagokhoz
        </Link>
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-bold text-slate-900">Alapanyag szerkesztés</h1>
          {error ? (
            <div role="alert" className="text-sm text-red-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="mt-4 font-semibold underline"
              >
                Újrapróbálás
              </button>
            </div>
          ) : (
            <p role="status" className="text-sm text-slate-500">
              Alapanyag betöltése...
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
