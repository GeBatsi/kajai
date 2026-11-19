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
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/moderator/foods/edit"
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Vissza az alapanyagokhoz
        </Link>
        <div className="rounded-3xl bg-card p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-bold text-foreground">Alapanyag szerkesztés</h1>
          {error ? (
            <div role="alert" className="text-sm text-destructive">
              <p>{error}</p>
              <Link
                href={`/moderator/foods/${encodeURIComponent(foodId)}/history`}
                className="mt-4 block underline"
              >
                Előzmények megtekintése
              </Link>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="mt-4 font-semibold underline"
              >
                Újrapróbálás
              </button>
            </div>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              Alapanyag betöltése...
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
