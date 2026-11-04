'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { foodApiError } from './food-api'
import { FoodHistoryData, HistoryEntry, HistoryValues, historyChanges } from './food-history-data'

const actionLabels: Record<string, string> = {
  CREATE: 'Létrehozás',
  INSERT: 'Létrehozás',
  UPDATE: 'Módosítás',
  DELETE: 'Törlés',
  RESTORE: 'Visszaállítás',
}
const dateText = (value: string) => new Date(value).toLocaleString('hu-HU')

function Changes({
  before,
  after,
  includeImage = true,
}: {
  before: HistoryValues | null
  after: HistoryValues | null
  includeImage?: boolean
}) {
  const changes = historyChanges(before, after, includeImage)
  if (!changes.length)
    return <p className="text-sm text-slate-600">Nincs eltérés a megjelenített adatokban.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">Az adatok változásai</caption>
        <thead>
          <tr>
            <th className="p-2" scope="col">
              Mező
            </th>
            <th className="p-2" scope="col">
              Korábbi / jelenlegi
            </th>
            <th className="p-2" scope="col">
              Új / kiválasztott
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((row) => (
            <tr key={row.key} className="border-t border-slate-200">
              <th scope="row" className="break-words p-2 font-medium">
                {row.label}
              </th>
              <td className="break-words p-2">{row.before}</td>
              <td className="break-words p-2">{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function FoodHistory({
  apiBaseUrl,
  foodId,
}: {
  apiBaseUrl: string
  foodId: string
}) {
  const [data, setData] = useState<FoodHistoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selected, setSelected] = useState<{
    entry: HistoryEntry
    side: 'before' | 'after'
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const request = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const preview = useRef<HTMLDivElement>(null)
  const base = `${apiBaseUrl}/api/foods/${encodeURIComponent(foodId)}`

  useEffect(() => {
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setLoading(true)
    setSelected(null)
    setData(null)
    async function load() {
      try {
        const response = await fetch(`${base}/history`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error(await foodApiError(response, 'Az előzmények betöltése sikertelen.'))
        const result: FoodHistoryData = await response.json()
        if (!controller.signal.aborted) setData(result)
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Az előzmények betöltése sikertelen.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => {
      controller.abort()
      request.current?.abort()
    }
  }, [base, attempt])

  useEffect(() => {
    if (selected) preview.current?.focus()
  }, [selected])

  const more = async () => {
    if (!data?.nextCursor || loading || lock.current) return
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await fetch(
        `${base}/history?cursor=${encodeURIComponent(data.nextCursor)}`,
        {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        },
      )
      if (!response.ok)
        throw new Error(await foodApiError(response, 'A további előzmények betöltése sikertelen.'))
      const result: FoodHistoryData = await response.json()
      if (!controller.signal.aborted) {
        // Keep the original comparison version; a later write must require a fresh preview.
        setData((prev) =>
          prev
            ? {
                ...prev,
                entries: [
                  ...prev.entries,
                  ...result.entries.filter((row) => !prev.entries.some((old) => old.id === row.id)),
                ],
                nextCursor: result.nextCursor,
              }
            : prev,
        )
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'A betöltés sikertelen.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const restore = async () => {
    if (!selected || !data?.current || loading || lock.current) return
    lock.current = true
    setRestoring(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`${base}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: selected.entry.id,
          side: selected.side,
          expectedUpdatedAt: data.current.updatedAt,
          expectedLatestAuditId: data.current.latestAuditId,
        }),
      })
      if (!response.ok) {
        const message = await foodApiError(response, 'A visszaállítás sikertelen.')
        if (response.status === 409 || response.status === 404) {
          setSelected(null)
          setAttempt((value) => value + 1)
        }
        throw new Error(message)
      }
      setSuccess('Az alapanyag adatai visszaállítva. A művelet új előzményként szerepel.')
      setSelected(null)
      setAttempt((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A visszaállítás sikertelen.')
    } finally {
      lock.current = false
      setRestoring(false)
    }
  }

  const target = selected ? selected.entry[selected.side] : null
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/moderator/foods/${encodeURIComponent(foodId)}/edit`}
          className="text-sm text-slate-600 underline"
        >
          Vissza a szerkesztéshez
        </Link>
        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold">Alapanyag előzményei</h1>
          {data?.current?.values.name && <p className="font-medium">{data.current.values.name}</p>}
          <p className="text-sm text-slate-600">
            A név, kategória, tápértékek és allergének korábbi állapota állítható vissza. A kép
            változatlan marad.
          </p>
          {data && !data.current && (
            <p role="status" className="text-amber-800">
              Az alapanyag törölve lett. Az előzmények megtekinthetők, de a törölt alapanyag
              visszaállítása nem elérhető.
            </p>
          )}
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-green-700">
              {success}
            </p>
          )}
          <button
            type="button"
            disabled={loading || restoring}
            onClick={() => {
              setError(null)
              setAttempt((value) => value + 1)
            }}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
          >
            Előzmények frissítése
          </button>
          {loading && <p role="status">Előzmények betöltése…</p>}
          {target && data?.current && (
            <div
              ref={preview}
              tabIndex={-1}
              role="region"
              aria-label="Visszaállítás előnézete"
              className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-4"
            >
              <h2 className="text-xl font-semibold">Visszaállítás előnézete</h2>
              <p>
                {dateText(selected!.entry.createdAt)} —{' '}
                {selected!.side === 'before' ? 'művelet előtti' : 'művelet utáni'} adatok
              </p>
              <Changes before={data.current.values} after={target.values} includeImage={false} />
              <p className="text-sm">
                A visszaállítás a fenti adatok teljes korábbi állapotát menti, beleértve az üres
                értékeket is.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={
                    restoring ||
                    loading ||
                    !target.canRestore ||
                    !historyChanges(data.current.values, target.values, false).length
                  }
                  onClick={() => void restore()}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
                >
                  {restoring ? 'Visszaállítás…' : 'Visszaállítás megerősítése'}
                </button>
                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => setSelected(null)}
                  className="rounded-xl border px-4 py-2"
                >
                  Mégse
                </button>
              </div>
            </div>
          )}
          {data && !data.entries.length && <p>Még nincs naplózott előzmény.</p>}
          <ol className="space-y-4">
            {data?.entries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold">
                  {actionLabels[entry.action] ?? entry.action} —{' '}
                  <time dateTime={entry.createdAt}>{dateText(entry.createdAt)}</time>
                </p>
                <p className="mb-3 text-sm text-slate-600">{entry.actor?.name ?? 'Rendszer'}</p>
                {entry.restoreSource && (
                  <p className="mb-3 text-sm">
                    Visszaállítás forrása:{' '}
                    {entry.restoreSource.createdAt
                      ? dateText(entry.restoreSource.createdAt)
                      : 'korábbi előzmény'}{' '}
                    ({entry.restoreSource.side === 'before' ? 'művelet előtti' : 'művelet utáni'}{' '}
                    adatok).
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer font-medium">Változások megtekintése</summary>
                  <Changes
                    before={entry.before?.values ?? null}
                    after={entry.after?.values ?? null}
                  />
                </details>
                <div className="mt-4 flex flex-wrap gap-3">
                  {(['before', 'after'] as const).map((side) => {
                    const state = entry[side]
                    if (!state) return null
                    return (
                      <div key={side}>
                        <button
                          type="button"
                          disabled={
                            restoring || loading || !state.canRestore || !data?.current?.canRestore
                          }
                          className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                          onClick={() => {
                            setSelected({ entry, side })
                            setError(null)
                            setSuccess(null)
                          }}
                        >
                          {side === 'before'
                            ? 'Művelet előtti adatok visszaállítása'
                            : 'Művelet utáni adatok visszaállítása'}
                        </button>
                        {state.reason && (
                          <p className="mt-1 max-w-md text-sm text-amber-800">{state.reason}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ol>
          {data?.nextCursor && (
            <button
              type="button"
              disabled={loading || restoring}
              onClick={() => void more()}
              className="rounded-xl border px-4 py-2"
            >
              További előzmények
            </button>
          )}
        </section>
      </div>
    </main>
  )
}
