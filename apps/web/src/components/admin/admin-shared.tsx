'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Badge, Button, Card } from '@kajai/ui'
import { canAccessAdmin } from '@/lib/admin-permissions'
import { adminErrorMessage, adminErrorStatus } from '@/lib/admin-users-api'

export function useAdminSession() {
  const { data: session, status, update } = useSession()
  return { session, status, update, actorId: session?.user.id ?? '', allowed: status === 'authenticated' && canAccessAdmin(session?.user) }
}

export function useAdminAction() {
  const { allowed, update } = useAdminSession()
  const busy = useRef(false)
  const mutation = useMutation({ mutationFn: (operation: () => Promise<void>) => operation(), retry: false })
  return {
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    async run(operation: () => Promise<void>): Promise<boolean> {
      if (!allowed || busy.current) return false
      busy.current = true
      mutation.reset()
      try { await mutation.mutateAsync(operation); return true }
      catch (error) {
        if ([401, 403].includes(adminErrorStatus(error) ?? 0)) void update().catch(() => {})
        return false
      } finally { busy.current = false }
    },
  }
}

export function AccessState({ loading = false }: { loading?: boolean }) {
  return <div role="status" className="p-8 text-center text-muted-foreground">
    {loading ? 'Jogosultság ellenőrzése…' : <><p>Az adminfelülethez aktív adminisztrátori munkamenet szükséges.</p><Button asChild variant="link"><Link href="/login">Bejelentkezés</Link></Button></>}
  </div>
}

export function ApiError({ error, retry }: { error: unknown; retry?: () => void }) {
  const { update } = useAdminSession()
  const status = adminErrorStatus(error)
  useEffect(() => {
    if (status === 401 || status === 403) void update().catch(() => {})
  }, [status, update])
  return <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
    <p>{adminErrorMessage(error)}</p>
    {status === 401 ? <Button asChild variant="outline"><Link href="/login">Bejelentkezés</Link></Button>
      : retry && status !== 403 && status !== 404 && <Button variant="outline" onClick={retry}>Újrapróbálás</Button>}
  </div>
}

export function UserBadges({ role, bannedAt, isVerified }: { role: string; bannedAt: string | null; isVerified: boolean }) {
  return <div className="flex flex-wrap gap-2">
    <Badge variant={role === 'ADMIN' ? 'primary' : 'outline'} className="text-sm">{role}</Badge>
    <Badge variant={bannedAt ? 'destructive' : 'success'} className="text-sm">{bannedAt ? 'Tiltott' : 'Aktív'}</Badge>
    <Badge variant="neutral" className="text-sm">{isVerified ? 'Email megerősítve' : 'Email nincs megerősítve'}</Badge>
  </div>
}

export function formatAdminDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Ismeretlen' : new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Budapest' }).format(date)
}

export function AdminHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Adminisztráció</p><h1 className="font-heading text-3xl sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{description}</p></div>{action}
  </div>
}

export function LoadingCard({ label = 'Adatok betöltése…' }: { label?: string }) {
  return <Card className="border border-border p-8" role="status" aria-live="polite"><p className="animate-pulse text-muted-foreground">{label}</p></Card>
}
