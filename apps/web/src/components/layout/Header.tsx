'use client'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { canAccessAdmin } from '@/lib/admin-permissions'
import { canAccessRecipeBook, isRecipeBookPath } from '@/lib/recipe-book-navigation'

interface HeaderProps {
  onLoginClick: () => void
  onRegisterClick?: () => void
}

export default function Header({ onLoginClick, onRegisterClick }: HeaderProps) {
  const { data: session, status } = useSession()
  const isLoading = status === 'loading'
  const isLoggedIn = status === 'authenticated'
  const pathname = usePathname()
  const adminActive = pathname === '/admin' || pathname?.startsWith('/admin/')
  const recipeBookActive = isRecipeBookPath(pathname)
  const navigationClass = (active: boolean) =>
    `rounded-full border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5 ${active ? 'border-primary/40 bg-accent text-accent-foreground' : 'border-border text-foreground hover:bg-muted'}`

  const firstName = session?.user?.name?.trim() || 'név nélküli felhasználó'

  // The NextAuth cookie belongs to the web origin; logout must work without the API.
  const handleLogout = () => signOut({ callbackUrl: '/login' })

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 font-body text-foreground sm:px-6">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 font-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="KajAI főoldal"
      >
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
        {isLoggedIn && canAccessRecipeBook(session?.user) && (
          <nav aria-label="Fő navigáció" className="flex flex-wrap items-center gap-2">
            {canAccessAdmin(session?.user) && (
              <Link
                href="/admin"
                aria-current={adminActive ? 'location' : undefined}
                className={navigationClass(!!adminActive)}
              >
                Admin Dashboard
              </Link>
            )}
            <Link
              href="/recipe-book"
              aria-current={
                recipeBookActive ? (pathname === '/recipe-book' ? 'page' : 'location') : undefined
              }
              className={navigationClass(recipeBookActive)}
            >
              Receptkönyv
            </Link>
          </nav>
        )}
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
