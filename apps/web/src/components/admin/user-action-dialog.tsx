'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from '@kajai/ui'
import { type AdminRole, type AdminUser } from '@/lib/admin-users-api'
import { ApiError } from './admin-shared'

export type UserAction = 'role' | 'ban' | 'unban' | 'delete'
const titles: Record<UserAction, string> = { role: 'Szerepkör módosítása', ban: 'Felhasználó tiltása', unban: 'Tiltás visszavonása', delete: 'Végleges felhasználótörlés' }

export function UserActionDialog({ user, action, role, pending, error, onClose, onConfirm, returnFocus }: {
  user: AdminUser; action: UserAction; role: AdminRole; pending: boolean; error: unknown
  onClose: () => void; onConfirm: (reason: string) => Promise<void>; returnFocus: () => void
}) {
  const [reason, setReason] = useState('')
  const [email, setEmail] = useState('')
  const content = useRef<HTMLDivElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (pending) content.current?.focus()
    else if (error) feedback.current?.focus()
  }, [pending, error])
  const valid = action === 'delete' ? email === user.email
    : action === 'ban' ? reason.trim().length >= 1 && reason.trim().length <= 500
      : action !== 'role' || role !== user.role
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
    <DialogContent ref={content} aria-busy={pending} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus() }}
      onEscapeKeyDown={(event) => { if (pending) event.preventDefault() }} onPointerDownOutside={(event) => { if (pending) event.preventDefault() }}>
      <DialogHeader><DialogTitle>{titles[action]}</DialogTitle><DialogDescription>{user.name || 'Névtelen felhasználó'} · {user.email}</DialogDescription></DialogHeader>
      {action === 'role' && <div className="space-y-3"><p><strong>{user.role}</strong> helyett <strong>{role}</strong> szerepkört kap.</p><p className="text-sm text-muted-foreground">A hozzáférési jogosultságok a következő védett kéréskor megváltoznak.</p>{role === 'ADMIN' && <p className="rounded-md border border-secondary bg-secondary/15 p-3 font-semibold">Az ADMIN szerepkör teljes adminisztrátori hozzáférést biztosít.</p>}</div>}
      {action === 'ban' && <div className="space-y-3"><p className="text-sm text-muted-foreground">A felhasználó elveszíti hozzáférését a védett funkciókhoz. Az adatai megmaradnak.</p><Label htmlFor="ban-reason">Tiltás indoka (kötelező)</Label><Textarea id="ban-reason" value={reason} maxLength={500} disabled={pending} aria-describedby="ban-hint" onChange={(event) => setReason(event.target.value)} /><p id="ban-hint" className="text-sm text-muted-foreground">{reason.trim().length} / 500 karakter. Csak a szükséges moderációs indokot add meg.</p></div>}
      {action === 'unban' && <p>A felhasználó ismét hozzáférhet a szerepkörének megfelelő funkciókhoz. A szerepköre és korábbi adatai megmaradnak.</p>}
      {action === 'delete' && <div className="space-y-4"><p className="font-semibold text-destructive">Ez a művelet nem vonható vissza.</p><p>A fiók, a profil, a saját receptek, az étkezési naplók és a kapcsolódó személyes adatok véglegesen törlődnek. Az auditnaplók megmaradnak.</p><p className="text-sm text-muted-foreground">Külső recepthivatkozás esetén a szerver megtagadja a törlést.</p><div className="space-y-2"><Label htmlFor="delete-email">Írd be pontosan a törlendő fiók email címét</Label><Input id="delete-email" value={email} autoComplete="off" spellCheck={false} disabled={pending} onChange={(event) => setEmail(event.target.value)} /></div></div>}
      {error != null && <div ref={feedback} tabIndex={-1} className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><ApiError error={error} /></div>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Mégse</Button><Button variant={action === 'ban' || action === 'delete' ? 'destructive' : 'primary'} disabled={!valid || pending} aria-busy={pending} onClick={() => { if (valid && !pending) void onConfirm(reason.trim()) }}>{pending ? 'Feldolgozás…' : action === 'delete' ? 'Végleges törlés' : action === 'role' ? 'Módosítás megerősítése' : titles[action]}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
