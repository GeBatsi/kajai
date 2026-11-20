'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, Input, Label, Select } from '@kajai/ui'
import { adminUserKeys, adminUsersApi, ADMIN_ROLES, type UsersFilter, type AdminUser } from '@/lib/admin-users-api'
import { AccessState, AdminHeading, ApiError, formatAdminDate, LoadingCard, UserBadges, useAdminSession } from './admin-shared'

const initialFilters: UsersFilter = { search: '', role: '', status: '', page: 1, limit: 20 }

export function AdminUsersList() {
  const { allowed, actorId, status } = useAdminSession()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<UsersFilter>(initialFilters)
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => current.search === search.trim() ? current : { ...current, search: search.trim(), page: 1 }), 300)
    return () => clearTimeout(timer)
  }, [search])
  const query = useQuery({
    queryKey: adminUserKeys.list(actorId, filters), queryFn: ({ signal }) => adminUsersApi.list(filters, signal),
    enabled: allowed, retry: false, staleTime: 15000,
  })
  useEffect(() => {
    if (query.data && filters.page > Math.max(1, query.data.meta.totalPages)) {
      setFilters((current) => ({ ...current, page: Math.max(1, query.data.meta.totalPages) }))
    }
  }, [query.data, filters.page])
  if (!allowed) return <AccessState loading={status === 'loading'} />
  const filtered = !!(filters.search || filters.role || filters.status)
  const searching = search.trim() !== filters.search
  const rows = query.data?.data ?? []
  const meta = query.data?.meta
  return <>
    <AdminHeading title="Felhasználók" description="Fiókok, szerepkörök és hozzáférések kezelése egy helyen."
      action={<Button asChild><Link href="/admin/users/new">Új felhasználó</Link></Button>} />
    <Card className="mb-5 border border-border p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,2fr)_1fr_1fr_auto]">
        <div className="space-y-2"><Label htmlFor="users-search">Keresés név vagy email alapján</Label><Input id="users-search" type="search" maxLength={200} value={search} placeholder="Név vagy email…" onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="users-role">Szerepkör</Label><Select id="users-role" value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value as UsersFilter['role'], page: 1 }))}><option value="">Összes szerepkör</option>{ADMIN_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</Select></div>
        <div className="space-y-2"><Label htmlFor="users-status">Hozzáférés</Label><Select id="users-status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as UsersFilter['status'], page: 1 }))}><option value="">Összes állapot</option><option value="active">Aktív</option><option value="banned">Tiltott</option></Select></div>
        <div className="space-y-2"><Label htmlFor="users-limit">Oldalméret</Label><Select id="users-limit" value={filters.limit} onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value) as UsersFilter['limit'], page: 1 }))}>{[20, 50, 100].map((limit) => <option key={limit} value={limit}>{limit} / oldal</option>)}</Select></div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Az aktív státusz tiltásmentes fiókot jelent; nem online jelenlétet vagy megerősített emailt.</p>
    </Card>
    <div className="mb-4 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <span>{searching ? 'Keresés előkészítése…' : query.isFetching ? 'Lista frissítése…' : meta ? `${meta.total} felhasználó` : 'Felhasználók lekérése…'}</span>
      {filtered && <Button variant="link" onClick={() => { setSearch(''); setFilters(initialFilters) }}>Szűrők törlése</Button>}
    </div>
    {query.isError ? <ApiError error={query.error} retry={() => { void query.refetch() }} />
      : query.isPending ? <LoadingCard />
      : rows.length === 0 ? <Card className="border border-border p-10 text-center"><h2 className="font-heading text-xl">{filtered ? 'Nincs találat' : 'Még nincs felhasználó'}</h2><p className="mt-3 text-muted-foreground">{filtered ? 'Próbálj más keresést, vagy töröld a szűrőket.' : 'Az új fiókok itt fognak megjelenni.'}</p></Card>
      : <>
        <Card className="hidden overflow-hidden border border-border md:block"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm" aria-busy={query.isFetching}>
          <caption className="sr-only">Adminisztrátori felhasználólista</caption>
          <thead className="bg-muted/60 text-muted-foreground"><tr>{['Felhasználó', 'Szerepkör', 'Hozzáférés', 'Email', 'Regisztráció', 'Művelet'].map((title) => <th key={title} scope="col" className="px-5 py-4 font-semibold">{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{rows.map((user) => <tr key={user.id} className="hover:bg-accent/30"><td className="max-w-[250px] px-5 py-5"><p className="break-words font-semibold">{user.name || 'Névtelen felhasználó'}</p><p className="mt-1 break-all text-muted-foreground">{user.email}</p></td>
            <td className="px-5 py-5"><Badge variant={user.role === 'ADMIN' ? 'primary' : 'outline'} className="text-sm">{user.role}</Badge></td>
            <td className="px-5 py-5"><Badge variant={user.bannedAt ? 'destructive' : 'success'} className="text-sm">{user.bannedAt ? 'Tiltott' : 'Aktív'}</Badge></td>
            <td className="px-5 py-5">{user.isVerified ? 'Megerősítve' : 'Nincs megerősítve'}</td><td className="px-5 py-5 text-muted-foreground"><time dateTime={user.createdAt}>{formatAdminDate(user.createdAt)}</time></td><td className="px-5 py-5"><DetailsLink user={user} /></td></tr>)}</tbody>
        </table></div></Card>
        <div className="grid gap-4 md:hidden">{rows.map((user) => <Card key={user.id} className="space-y-4 border border-border p-5"><div><h2 className="break-words text-lg font-semibold">{user.name || 'Névtelen felhasználó'}</h2><p className="mt-1 break-all text-muted-foreground">{user.email}</p></div><UserBadges {...user} /><p className="text-sm text-muted-foreground">Regisztráció: <time dateTime={user.createdAt}>{formatAdminDate(user.createdAt)}</time></p><DetailsLink user={user} /></Card>)}</div>
      </>}
    {meta && !query.isError && <nav aria-label="Felhasználólista lapozása" className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{meta.page}. oldal / {Math.max(1, meta.totalPages)} · Összesen {meta.total} találat</p><div className="flex gap-2">
        <Button variant="outline" disabled={query.isFetching || searching || filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Előző</Button>
        <Button variant="outline" disabled={query.isFetching || searching || filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Következő</Button>
      </div>
    </nav>}
  </>
}

function DetailsLink({ user }: { user: AdminUser }) {
  return <Button asChild variant="outline" size="sm"><Link href={`/admin/users/${encodeURIComponent(user.id)}`} aria-label={`Részletek: ${user.email}`}>Részletek</Link></Button>
}
