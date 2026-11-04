'use client'
import { signOut, useSession } from 'next-auth/react'

interface HeaderProps {
  onLoginClick: () => void,
  onRegisterClick?:()=> void
}

export default function Header({
  onLoginClick,
  onRegisterClick,
}: HeaderProps) {
    const { data: session, status } = useSession();
    const isLoading = status === 'loading'
    const isLoggedIn = status === 'authenticated'

    const firstName =
        session?.user?.name?.trim() || 'név nélküli felhasználó'

    const handleLogout = async () => {
        try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
            method: 'POST',

        })

        if (!response.ok) {
            throw new Error('Kijelentkezés sikertelen')
        }
        await signOut({
        callbackUrl: '/login',
        })
        } catch (error) {
        console.error('Logout hiba:', error)
        }
  }



  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-2 font-bold text-gray-900">
        <span>Kajai</span>
        <img src="/Kajai.webp" alt="Kajai logó" className="h-6 w-6" />
      </div>
      {isLoading && <div className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-gray-200" />}
      {!isLoading && isLoggedIn && (
        <span className="hidden min-w-0 truncate text-sm text-gray-700 sm:block">
          Ödvözlöm, <span className="font-semibold">{firstName}!</span>
        </span>
      )}
      <div className="flex shrink-0 gap-2">
        {!isLoggedIn && (
          <button
            type="button"
            onClick={onRegisterClick}
            className="rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 sm:px-5"
          >
            Regisztráció
          </button>
        )}

        <button
          type="button"
          onClick={isLoggedIn ? handleLogout : onLoginClick}
          className="rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 sm:px-5"
        >
          {isLoggedIn ? 'kijentkezés' : 'Bejelentkezés'}
        </button>
      </div>
    </header>
  )
}