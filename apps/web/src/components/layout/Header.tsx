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
        const response = await fetch(`http://localhost:3001/api/auth/logout`, {
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
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="font-bold text-gray-900 flex w-20 gap-3 items-center">
        <div>Kajai</div>
        <img src="/Kajai.webp" alt="Kajai logó" className='text-sm font-extralight '/>
      </div>
      {isLoading && <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200" />}
      {!isLoading && (isLoggedIn ?  <span className="text-sm text-gray-700">
              Ödvözlöm, <span className="font-semibold">{firstName}!</span>
            </span>:""
            )}
      <div className='flex gap-2'>
      {!isLoggedIn && <button   type="button" onClick={onRegisterClick} 
      className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700">
        Regisztráció
      </button> }   

      <button
        type="button"
        onClick={isLoggedIn? handleLogout : onLoginClick}
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
      >
        {isLoggedIn ? "kijentkezés" : "Bejelentkezés"}
      </button>
      </div>
    </header>
  )
}