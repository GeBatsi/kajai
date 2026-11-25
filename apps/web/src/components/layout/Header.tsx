'use client'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { canAccessAdmin } from '@/lib/admin-permissions'

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

    // The NextAuth cookie belongs to the web origin; logout must work without the API.
    const handleLogout = () => signOut({ callbackUrl: '/login' })



  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 font-body text-foreground sm:px-6">
      <Link href="/" className="flex shrink-0 items-center gap-2 font-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label="KajAI főoldal">
        <span>KajAI</span>
        <Image src="/Kajai.webp" alt="Kajai logó" width={24} height={24} className="h-6 w-6" />
      </Link>
      {isLoading && <div className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-muted" />}
      {!isLoading && isLoggedIn && (
        <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
          Üdvözlöm, <span className="font-semibold">{firstName}!</span>
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {isLoggedIn && !!session?.user.id && !session.user.isBanned && ['USER','MODERATOR','ADMIN'].includes(session.user.role) && <nav aria-label="Javítások" className="flex flex-wrap items-center gap-3 text-sm text-primary"><Link href="/nutrition-corrections/new">Tápérték-javítás javaslata</Link><Link href="/nutrition-corrections/mine">Saját javaslataim</Link>{['MODERATOR','ADMIN'].includes(session.user.role)&&<Link href="/moderator/nutrition-corrections">Javaslatok moderálása</Link>}</nav>}
        {isLoggedIn && canAccessAdmin(session?.user) && <Link href="/admin" className="rounded-full bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-5">Admin Dashboard</Link>}
        {!isLoggedIn && (
          <button
            type="button"
            onClick={onRegisterClick}
            className="rounded-full bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-5"
          >
            Regisztráció
          </button>
        )}

        <button
          type="button"
          onClick={isLoggedIn ? handleLogout : onLoginClick}
          className="rounded-full bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-5"
        >
          {isLoggedIn ? 'Kijelentkezés' : 'Bejelentkezés'}
        </button>
      </div>
    </header>
  )
}
