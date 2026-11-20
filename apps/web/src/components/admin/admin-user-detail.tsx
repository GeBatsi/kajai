'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Label, Select } from '@kajai/ui'
import { ADMIN_ROLES, adminUserKeys, adminUsersApi, type AdminRole, type AdminUser, type UserSummary } from '@/lib/admin-users-api'
import { AccessState, AdminHeading, ApiError, formatAdminDate, LoadingCard, UserBadges, useAdminAction, useAdminSession } from './admin-shared'
import { useAdminNotice } from './admin-shell'
import { UserActionDialog, type UserAction } from './user-action-dialog'

export function AdminUserDetail({ id }: { id: string }) {
  const { allowed, actorId, status } = useAdminSession()
  const query = useQuery({ queryKey: adminUserKeys.detail(actorId, id), queryFn: ({ signal }) => adminUsersApi.detail(id, signal), enabled: allowed, retry: false })
  if (!allowed) return <AccessState loading={status === 'loading'} />
  if (query.isError) return <><BackLink /><ApiError error={query.error} retry={() => { void query.refetch() }} /></>
  if (query.isPending) return <LoadingCard label="Felhasználó betöltése…" />
  return <UserDetailContent key={id} user={query.data} actorId={actorId} />
}

function BackLink() { return <Button asChild variant="link" className="mb-6"><Link href="/admin/users">Vissza a felhasználókhoz</Link></Button> }

export function UserDetailContent({ user, actorId }: { user: AdminUser; actorId: string }) {
  const cache = useQueryClient()
  const router = useRouter()
  const notify = useAdminNotice()
  const operation = useAdminAction()
  const [action, setAction] = useState<UserAction | null>(null)
  const [roleDraft, setRoleDraft] = useState<{ userId: string; from: AdminUser['role']; value: AdminRole } | null>(null)
  const draft = roleDraft?.userId === user.id ? roleDraft : null
  const role = draft?.value ?? (user.role === 'GUEST' ? 'USER' : user.role)
  const roleStale = draft !== null && draft.from !== user.role && role !== user.role
  const roleConfirmation = useRef<{ userId: string; from: AdminUser['role']; to: AdminRole } | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const self = actorId === user.id
  useEffect(() => {
    setRoleDraft((previous) => previous && (previous.userId !== user.id || previous.value === user.role) ? null : previous)
    // A changed source role invalidates an already opened confirmation.
    if (action === 'role' && !operation.pending && roleConfirmation.current?.from !== user.role) setAction(null)
  }, [user.id, user.role, action, operation.pending])
  const refresh = () => Promise.allSettled([cache.invalidateQueries({ queryKey: adminUserKeys.scope(actorId) })])
  function open(kind: UserAction, element: HTMLElement) {
    if (kind === 'role') {
      if (self || role === user.role) return
      roleConfirmation.current = { userId: user.id, from: user.role, to: role }
    }
    operation.reset(); trigger.current = element; setAction(kind)
  }
  async function confirm(reason: string) {
    if (!action || (self && action !== 'unban') || (action === 'role' && role === user.role)) return
    if (action === 'role' && (roleConfirmation.current?.userId !== user.id || roleConfirmation.current.from !== user.role || roleConfirmation.current.to !== role)) {
      setAction(null)
      return
    }
    await operation.run(async () => {
      if (action === 'delete') {
        await adminUsersApi.remove(user.id)
        cache.removeQueries({ queryKey: adminUserKeys.detail(actorId, user.id), exact: true })
        await refresh()
        notify('A felhasználó végleges törlése sikeres. Az auditnaplók megmaradtak.')
        router.replace('/admin/users')
      } else {
        const result = action === 'role' ? await adminUsersApi.role(user.id, role)
          : action === 'ban' ? await adminUsersApi.ban(user.id, reason) : await adminUsersApi.unban(user.id)
        if (action === 'role') setRoleDraft(null)
        cache.setQueryData(adminUserKeys.detail(actorId, user.id), result)
        await refresh()
        notify(action === 'role' ? 'A szerepkör módosítása sikeres.' : action === 'ban' ? 'A felhasználó tiltása sikeres.' : 'A tiltás visszavonása sikeres.')
      }
      setAction(null)
    })
  }
  return <>
    <BackLink />
    <AdminHeading title={user.name || 'Névtelen felhasználó'} description={user.email} />
    <h2 ref={heading} tabIndex={-1} className="sr-only">Felhasználói adatok és műveletek</h2>
    <Card className="mb-6 border border-border p-5 sm:p-7"><UserBadges {...user} /><dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
      <Datum label="Email" value={user.email} /><Datum label="Felhasználói azonosító" value={user.id} />
      <Datum label="Regisztráció" value={formatAdminDate(user.createdAt)} /><Datum label="Utolsó módosítás" value={formatAdminDate(user.updatedAt)} />
      {user.bannedAt && <><Datum label="Tiltás időpontja" value={formatAdminDate(user.bannedAt)} /><Datum label="Tiltás indoka" value={user.banReason || 'Nincs megadva'} /></>}
    </dl></Card>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <BasicUserForm key={`${user.id}:${user.updatedAt}`} user={user} actorId={actorId} />
      <Card className="space-y-6 border border-border p-5 sm:p-7"><div><h2 className="font-heading text-xl">Jogosultság és hozzáférés</h2><p className="mt-2 text-sm text-muted-foreground">Minden változtatást a szerver ellenőriz és auditál.</p></div>
        {self && <p className="rounded-md bg-accent p-3 text-sm text-accent-foreground">Ez a saját adminfiókod. A szerepkörváltás, tiltás és törlés itt nem engedélyezett.</p>}
        <div className="space-y-3"><Label htmlFor="user-role">Szerepkör</Label><Select id="user-role" value={role} disabled={self || operation.pending} onChange={(event) => {
          const value = event.target.value as AdminRole
          setRoleDraft(value === user.role ? null : { userId: user.id, from: user.role, value })
        }}>{ADMIN_ROLES.map((value) => <option key={value}>{value}</option>)}</Select>
          {roleStale && <div role="alert" className="space-y-2 rounded-md border border-border bg-accent p-3 text-sm text-accent-foreground"><p>A szerepkört időközben módosították. Jelenlegi szerepkör: <strong>{user.role}</strong>. A nem mentett választásod: <strong>{role}</strong>. Ellenőrizd, majd erősítsd meg újra a módosítást.</p><Button variant="outline" disabled={operation.pending} onClick={() => { setRoleDraft(null); setAction(null) }}>Aktuális szerepkör átvétele</Button></div>}
          <Button variant="outline" disabled={self || role === user.role || operation.pending} onClick={(event) => open('role', event.currentTarget)}>Szerepkör módosítása</Button></div>
        <div className="border-t border-border pt-5"><h3 className="mb-3 font-semibold">Hozzáférés</h3><Button variant={user.bannedAt ? 'outline' : 'destructive'} disabled={self || operation.pending} onClick={(event) => open(user.bannedAt ? 'unban' : 'ban', event.currentTarget)}>{user.bannedAt ? 'Tiltás visszavonása' : 'Felhasználó tiltása'}</Button></div>
        <div className="border-t border-destructive/30 pt-5"><h3 className="font-semibold text-destructive">Végleges törlés</h3><p className="my-3 text-sm text-muted-foreground">A fiók és kapcsolódó személyes adatai véglegesen törlődnek.</p><Button variant="destructive" disabled={self || operation.pending} onClick={(event) => open('delete', event.currentTarget)}>Felhasználó törlése</Button></div>
      </Card>
    </div>
    {action && <UserActionDialog key={`${user.id}:${action}`} user={user} action={action} role={role} pending={operation.pending} error={operation.error} onClose={() => setAction(null)} onConfirm={confirm} returnFocus={() => restoreAdminFocus(trigger.current, heading.current)} />}
  </>
}

export function restoreAdminFocus(trigger: HTMLElement | null, fallback: HTMLElement | null) {
  if (trigger?.isConnected && !trigger.matches(':disabled,[aria-disabled="true"]')) trigger.focus()
  else fallback?.focus()
}

function Datum({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value}</dd></div> }

export function BasicUserForm({ user, actorId }: { user: AdminUser; actorId: string }) {
  const [name, setName] = useState(user.name ?? '')
  const [image, setImage] = useState(user.image ?? '')
  const [validation, setValidation] = useState('')
  const action = useAdminAction()
  const cache = useQueryClient()
  const notify = useAdminNotice()
  return <Card className="border border-border p-5 sm:p-7"><h2 className="mb-5 font-heading text-xl">Alapadatok szerkesztése</h2><form className="space-y-4" onSubmit={(event) => {
    event.preventDefault()
    if (image.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(image.trim()).protocol)) throw new Error() }
      catch { setValidation('Adj meg érvényes http vagy https kép-URL-t.'); return }
    }
    setValidation('')
    void action.run(async () => {
      const result: UserSummary = await adminUsersApi.edit(user.id, { name: name.trim() || null, image: image.trim() || null })
      cache.setQueryData<AdminUser>(adminUserKeys.detail(actorId, user.id), (previous) => previous ? { ...previous, ...result } : undefined)
      await Promise.allSettled([cache.invalidateQueries({ queryKey: adminUserKeys.scope(actorId) })])
      notify('Az alapadatok mentése sikeres.')
    })
  }}>
    <div className="space-y-2"><Label htmlFor="edit-user-name">Név</Label><Input id="edit-user-name" value={name} disabled={action.pending} onChange={(event) => setName(event.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="edit-user-image">Profilkép URL-je</Label><Input id="edit-user-image" type="url" value={image} disabled={action.pending} placeholder="https://…" onChange={(event) => setImage(event.target.value)} /><p className="text-sm text-muted-foreground">Meglévő kép hivatkozása. Az üres mező eltávolítja a hivatkozást.</p></div>
    {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}{action.error && <ApiError error={action.error} />}
    <Button type="submit" disabled={action.pending} aria-busy={action.pending}>{action.pending ? 'Mentés…' : 'Alapadatok mentése'}</Button>
  </form></Card>
}
