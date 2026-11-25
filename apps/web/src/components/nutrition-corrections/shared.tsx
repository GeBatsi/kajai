'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card } from '@kajai/ui'
import Header from '@/components/layout/Header'
import { correctionAccess } from '@/lib/correction-nutrition'
import { correctionKeys, correctionError, correctionStatus } from '@/lib/nutrition-corrections-api'
import type { Correction } from '@/lib/nutrition-corrections-api'
export const statusLabels = { PENDING: 'Függőben', APPROVED: 'Jóváhagyva', REJECTED: 'Elutasítva' }
export function StatusBadge({ status }: { status: Correction['status'] }) {
  return (
    <Badge
      variant={
        status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'destructive' : 'outline'
      }
    >
      {statusLabels[status]}
    </Badge>
  )
}
export function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '—'
}
export function useCorrectionSession(moderator = false) {
  const s = useSession()
  return {
    ...s,
    actorId: s.data?.user.id ?? '',
    allowed: s.status === 'authenticated' && correctionAccess(s.data?.user, moderator),
  }
}
export function CorrectionPrivacyGuard() {
  const { data, status } = useSession()
  const cache = useQueryClient()
  const id = data?.user.id ?? ''
  const role = data?.user.role
  const banned = data?.user.isBanned
  const allowed = correctionAccess(data?.user)
  useEffect(() => {
    if (status !== 'authenticated' || !allowed) {
      void cache.cancelQueries({ queryKey: correctionKeys.private })
      cache.removeQueries({ queryKey: correctionKeys.private })
    }
    return () => {
      if (id) {
        void cache.cancelQueries({ queryKey: correctionKeys.scope(id) })
        cache.removeQueries({ queryKey: correctionKeys.scope(id) })
      }
    }
  }, [id, role, banned, status, cache, allowed])
  return null
}
export function CorrectionShell({
  children,
  moderator = false,
}: {
  children: React.ReactNode
  moderator?: boolean
}) {
  const s = useCorrectionSession(moderator)
  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <Header onLoginClick={() => {}} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 pb-24 sm:px-6">
        <nav
          aria-label="Tápérték-javítás navigáció"
          className="flex flex-wrap gap-4 text-sm text-primary"
        >
          <Link href="/nutrition-corrections/new">Javítás javaslata</Link>
          <Link href="/nutrition-corrections/mine">Saját javaslataim</Link>
          {correctionAccess(s.data?.user, true) && (
            <Link href="/moderator/nutrition-corrections">Javaslatok moderálása</Link>
          )}
        </nav>
        {s.allowed ? (
          <div key={s.actorId + ':' + s.data?.user.role}>{children}</div>
        ) : (
          <Card className="p-6" role="status">
            {s.status === 'loading' ? (
              'Jogosultság ellenőrzése…'
            ) : (
              <Link href="/login">
                Aktív, megfelelő jogosultságú munkamenet szükséges. Bejelentkezés
              </Link>
            )}
          </Card>
        )}
      </main>
    </div>
  )
}
export function useCorrectionAction(moderator = false) {
  const s = useCorrectionSession(moderator)
  const busy = useRef(false)
  const mounted = useRef(true)
  const identity = useRef('')
  identity.current = s.allowed ? s.actorId + ':' + s.data?.user.role : ''
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const m = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), retry: false })
  return {
    pending: m.isPending,
    error: m.error,
    reset: m.reset,
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (!identity.current || busy.current) return
      busy.current = true
      const owner = identity.current
      m.reset()
      try {
        const result = await m.mutateAsync(fn)
        if (mounted.current && identity.current === owner) return result as T
      } catch (e) {
        if ([401, 403].includes(correctionStatus(e) ?? 0)) void s.update().catch(() => {})
      } finally {
        busy.current = false
      }
    },
  }
}
export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  const { update } = useSession()
  const status = correctionStatus(error)
  useEffect(() => {
    if (status === 401 || status === 403) void update().catch(() => {})
  }, [status, update])
  return (
    <div
      role="alert"
      className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
    >
      <p>{correctionError(error)}</p>
      {status === 401 ? (
        <Link href="/login">Bejelentkezés</Link>
      ) : (
        retry &&
        status !== 403 &&
        status !== 404 && (
          <Button variant="outline" onClick={retry}>
            Adatok frissítése
          </Button>
        )
      )}
    </div>
  )
}
export function Loading() {
  return (
    <Card role="status" className="p-6">
      Adatok betöltése…
    </Card>
  )
}
export function useDebounced(value: string) {
  const [debounced, set] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => set(value.trim()), 300)
    return () => clearTimeout(timer)
  }, [value])
  return debounced
}
