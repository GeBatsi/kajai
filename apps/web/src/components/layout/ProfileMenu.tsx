'use client'

import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

export default function ProfileMenu() {
  const backendurl=process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"; 
  const { data: session } = useSession()

  const [isOpen, setIsOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isPasswordRequestLoading, setIsPasswordRequestLoading] = useState(false)
  const [passwordRequestError, setPasswordRequestError] = useState('')

  const firstName = session?.user?.name?.trim() || 'név nélküli felhasználó'

  const handleLogout = async () => {
    try {
       
      const response = await fetch( `${backendurl}/api/auth/logout`, { method: 'POST' })

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

  const handleChangePassword = async () => {
    setIsOpen(false)
    setPasswordRequestError('')
    setIsPasswordRequestLoading(true)

    try {
      const response = await fetch( `${backendurl}/api/auth/request-password-change`, { method: 'POST', credentials: 'include' })
      const data = await response.json()

      if (!response.ok) {
        setPasswordRequestError( data?.message || 'A jelszómódosító email küldése sikertelen.' )

        setIsPasswordModalOpen(true)
        return
      }

      setIsPasswordModalOpen(true)
    } catch (error) {
      console.error(
        'Jelszómódosítási email hiba:',
        error
      )

      setPasswordRequestError(
        'Nem sikerült elküldeni a jelszómódosító emailt.'
      )

      setIsPasswordModalOpen(true)
    } finally {
      setIsPasswordRequestLoading(false)
    }
  }

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false)
    setPasswordRequestError('')
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setIsOpen((previous) => !previous)
          }
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          Saját profil
        </button>

        {isOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
            role="menu"
          >
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={isPasswordRequestLoading}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              role="menuitem"
            >
              

              {isPasswordRequestLoading
                ? 'Email küldése...'
                : 'Jelszó módosítása'}
            </button>

            {/* Kijelentkezés */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center border-t border-gray-100 px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50"
              role="menuitem"
            >
             Kijelentkezés
            </button>
          </div>
        )}
      </div>

      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-change-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {!passwordRequestError ? (
              <>
                <div className="mb-5">
                  <h2
                    id="password-change-title"
                    className="text-xl font-semibold text-gray-900"
                  >
                    Jelszócsere!
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    A további teendőkről email-t küldtünk a
                    megadott email címére.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
                >
                  OK
                </button>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Sikertelen kérés
                  </h2>

                  <div
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    role="alert"
                  >
                    {passwordRequestError}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
                >
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}