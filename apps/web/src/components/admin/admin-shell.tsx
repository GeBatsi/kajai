'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@kajai/ui'
import Header from '@/components/layout/Header'
import { adminUserKeys } from '@/lib/admin-users-api'
import { AccessState, useAdminSession } from './admin-shared'

const NoticeContext = createContext<(message: string) => void>(() => {})
export const useAdminNotice = () => useContext(NoticeContext)

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { allowed, actorId, status } = useAdminSession()
  const cache = useQueryClient()
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setNotice('')
    if (!allowed) cache.removeQueries({ queryKey: adminUserKeys.all })
    return () => { cache.removeQueries({ queryKey: adminUserKeys.scope(actorId) }) }
  }, [allowed, actorId, cache])
  return <NoticeContext.Provider value={setNotice}>
    <div className="min-h-screen bg-background font-body text-foreground">
      <Header onLoginClick={() => {}} />
      {allowed ? <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-9 lg:py-9">
        <aside><nav aria-label="Admin navigáció" className="flex flex-wrap gap-2 rounded-card border border-border bg-card p-3 lg:sticky lg:top-6 lg:flex-col">
          <Link href="/admin/users" className="rounded-full bg-accent px-4 py-3 font-semibold text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Felhasználók</Link>
          <Link href="/" className="rounded-full px-4 py-3 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Vissza a KajAI-ba</Link>
        </nav><p className="mt-4 hidden px-4 text-sm text-muted-foreground lg:block">KajAI · Admin Dashboard</p></aside>
        <main id="admin-content" className="min-w-0 pb-16">
          {notice && <div role="status" className="mb-6 flex items-start justify-between gap-3 rounded-md border border-primary/30 bg-accent p-4 text-accent-foreground"><p>{notice}</p><Button variant="ghost" size="sm" aria-label="Értesítés bezárása" onClick={() => setNotice('')}>Bezárás</Button></div>}
          {children}
        </main>
      </div> : <AccessState loading={status === 'loading'} />}
    </div>
  </NoticeContext.Provider>
}
