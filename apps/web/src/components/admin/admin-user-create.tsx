'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Label, Select } from '@kajai/ui'
import { ADMIN_ROLES, adminUserKeys, adminUsersApi, type AdminRole, type UserSummary } from '@/lib/admin-users-api'
import { AccessState, AdminHeading, ApiError, useAdminAction, useAdminSession } from './admin-shared'

export function AdminUserCreate() {
  const { allowed, actorId, status } = useAdminSession()
  const cache = useQueryClient()
  const action = useAdminAction()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<AdminRole>('USER')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState('')
  const [created, setCreated] = useState<UserSummary | null>(null)
  if (!allowed) return <AccessState loading={status === 'loading'} />
  return <>
    <Button asChild variant="link" className="mb-6"><Link href="/admin/users">Vissza a felhasználókhoz</Link></Button>
    <AdminHeading title="Új felhasználó" description="Új fiók létrehozása a kiválasztott szerepkörrel." />
    {created ? <Card className="max-w-2xl space-y-4 border border-primary/30 p-6" role="status"><h2 className="font-heading text-xl">A felhasználó létrejött</h2><p className="break-all font-semibold">{created.email}</p><p>Szerepkör: {created.role}. Email: {created.isVerified ? 'megerősítve' : 'nincs megerősítve'}.</p><p className="text-muted-foreground">A létrehozás nem küld meghívó emailt, és nem aktiválja automatikusan a fiókot. Az aktiválás külön folyamatot igényelhet.</p><Button asChild><Link href={`/admin/users/${encodeURIComponent(created.id)}`}>Felhasználó megnyitása</Link></Button></Card>
      : <Card className="max-w-2xl border border-border p-5 sm:p-7"><form className="space-y-5" onSubmit={(event) => {
        event.preventDefault()
        if (!email.trim() || (password && (password.length < 8 || !/[0-9]/.test(password)))) { setValidation('Érvényes emailt és legalább 8 karakteres, számot is tartalmazó jelszót adj meg. A jelszó elhagyható.'); return }
        setValidation('')
        void action.run(async () => {
          const result = await adminUsersApi.create({ email: email.trim(), ...(name.trim() ? { name: name.trim() } : {}), role, ...(password ? { password } : {}) })
          setPassword('')
          setCreated(result)
          await Promise.allSettled([cache.invalidateQueries({ queryKey: adminUserKeys.scope(actorId) })])
        })
      }}>
        <div className="space-y-2"><Label htmlFor="new-user-email">Email (kötelező)</Label><Input id="new-user-email" type="email" required autoComplete="off" value={email} disabled={action.pending} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="new-user-name">Név (opcionális)</Label><Input id="new-user-name" autoComplete="off" value={name} disabled={action.pending} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="new-user-role">Szerepkör</Label><Select id="new-user-role" value={role} disabled={action.pending} onChange={(event) => setRole(event.target.value as AdminRole)}>{ADMIN_ROLES.map((value) => <option key={value}>{value}</option>)}</Select>{role === 'ADMIN' && <p className="rounded-md border border-secondary bg-secondary/15 p-3 font-semibold">Az ADMIN szerepkör teljes adminisztrátori hozzáférést biztosít.</p>}</div>
        <div className="space-y-2"><Label htmlFor="new-user-password">Jelszó (opcionális)</Label><Input id="new-user-password" type="password" autoComplete="new-password" minLength={8} pattern=".*[0-9].*" value={password} disabled={action.pending} onChange={(event) => setPassword(event.target.value)} /><p className="text-sm text-muted-foreground">Ha megadod: legalább 8 karakter, legalább egy szám. Jelszó nélkül nem használható a jelszavas belépés.</p></div>
        <p className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">A fiók alapértelmezetten nem verifikált. A létrehozás nem indít email-meghívást vagy automatikus aktiválást.</p>
        {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}{action.error && <ApiError error={action.error} />}
        <Button type="submit" disabled={action.pending} aria-busy={action.pending}>{action.pending ? 'Létrehozás…' : 'Felhasználó létrehozása'}</Button>
      </form></Card>}
  </>
}
