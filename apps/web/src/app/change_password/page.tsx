'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Header from '@/components/layout/Header'

export default function ChangePasswordPage() {
  const searchParams = useSearchParams()

  const token = searchParams.get('token')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!token) {
      setError(
        'A jelszó módosításához szükséges hivatkozás hiányzik vagy érvénytelen.'
      )
      return
    }

    if (!currentPassword) {
      setError('A jelenlegi jelszó megadása kötelező.')
      return
    }

    if (!newPassword) {
      setError('Az új jelszó megadása kötelező.')
      return
    }

    if (!confirmPassword) {
      setError('Az új jelszó megerősítése kötelező.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError(
        'A jelszó megerősítése nem egyezik az új jelszóval.'
      )
      return
    }

    if (newPassword.length < 8) {
      setError(
        'Az új jelszónak legalább 8 karakter hosszúnak kell lennie.'
      )
      return
    }

    if (!/\d/.test(newPassword)) {
      setError(
        'A jelszónak legalább egy számot kell tartalmaznia.'
      )
      return
    }

    if (currentPassword === newPassword) {
      setError(
        'Az új jelszó nem lehet azonos a jelenlegi jelszóval.'
      )
      return
    }

    try {
      setIsLoading(true)
      const backendurl=process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const url=`${backendurl}/api/auth/changepassword`
      console.log("URL: ",url)
      const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            currentPassword,
            newPassword,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(
          data?.message ||
            'A jelszó módosítása nem sikerült.'
        )
        return
      }

      setSuccess(
        'A jelszavad sikeresen megváltozott.'
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error(error)

      setError(
        'Hiba történt a jelszó módosítása közben.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
    <Header
            onLoginClick={() => { window.location.href = '/login'}}
            onRegisterClick={() => { window.location.href = '/login'}}
          />
    
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              Jelszó módosítása
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              A jelszó módosításához add meg a jelenlegi
              és az új jelszavadat.
            </p>
          </div>

          {!token && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              A jelszó módosításához szükséges hivatkozás
              hiányzik vagy érvénytelen.
            </div>
          )}

          {token && !success && (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* Jelenlegi jelszó */}
              <div>
                <label
                  htmlFor="current-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Jelenlegi jelszó
                </label>

                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
                  placeholder="Add meg a jelenlegi jelszavad"
                />
              </div>

              {/* Új jelszó */}
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Új jelszó
                </label>

                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
                  placeholder="Add meg az új jelszavad"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Legalább 8 karakter és legalább egy szám.
                </p>
              </div>

              {/* Új jelszó megerősítése */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Új jelszó megerősítése
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
                  placeholder="Írd be újra az új jelszavad"
                />
              </div>

              {/* Hiba */}
              {error && (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Küldés */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading
                  ? 'Jelszó módosítása...'
                  : 'Jelszó módosítása'}
              </button>

            </form>
          )}

          {success && (
            <div className="space-y-4">

              <div
                className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
                role="status"
              >
                {success}
              </div>

              <a
                href="/login"
                className="block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-gray-700"
              >
                Bejelentkezés
              </a>

            </div>
          )}

        </div>
      </div>
    </main>
    </>
  )
}