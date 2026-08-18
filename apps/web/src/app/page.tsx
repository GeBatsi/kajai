'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const isLoggedIn = status === 'authenticated'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </main>
    )
  }

  if (!session) return null

  return (<>
  <Header onLoginClick={() => setIsLoginModalOpen(!isLoggedIn)}/>
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">KajAI</h1>
      <div className="flex flex-col items-center gap-2 text-center">
        {session.user.image && (
          <img
            src={session.user.image}
            alt="Profilkép"
            className="h-16 w-16 rounded-full"
          />
        )}
        <p className="font-medium">{session.user.name}</p>
        <p className="text-sm text-gray-500">{session.user.email}</p>
        <p className="text-xs text-gray-400">Szerepkör: {session.user.role}</p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Kijelentkezés
      </button>
    </main>
    </>
  )
}
