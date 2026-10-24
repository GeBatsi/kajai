'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()

  const token = searchParams.get('id')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validateEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const validatePassword = (value: string) => {
    return value.length >= 8 && /\d/.test(value)
  }

  const handleSubmit = async ( event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')
    setSuccess('')
    const trimmedEmail = email.trim()

    if (!token) {
      setError('Hiányzik a jelszó-visszaállító token.')
      return
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Kérjük, adj meg egy érvényes email címet.')
      return
    }

    if (!validatePassword(password)) {
      setError(
        'A jelszónak legalább egy számot kell tartalmaznia.',
      )
      return
    }
    if (password !== passwordAgain) {
      setError('A két jelszó nem egyezik.')
      return
    }

    if (password.length < 8) {
      setError('A jelszónak legalább 8 karakter hosszúnak kell lennie.')
      return
    }

    setIsLoading(true)

    const backEndUrl =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

    try {
      const response = await fetch(
        `${backEndUrl}/api/auth/resetpassword`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            token,
          }),
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        setError(
          message || 'Sikertelen jelszó módosítás. Kérjük, próbáld újra.',
        )

        return
      }

      setSuccess(
        data?.message || 'Jelszómódosítás sikeres.',
      )

      setEmail('')
      setPassword('')
      setPasswordAgain('')
    } catch {
      setError(
        'Nem sikerült kapcsolódni a szerverhez. Kérjük, próbáld újra.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header
        onLoginClick={() => {
          window.location.href = '/login'
        }}
        onRegisterClick={() => {
          window.location.href = '/login'
        }}
      />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">

          {/* Fejléc */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Új jelszó beállítása
            </h1>

            <p className="text-sm leading-6 text-gray-500">
              Addja meg a regisztrációhoz használt email címet,
              majd adjon meg új jelszót.
            </p>
          </div>

          {/* Hibaüzenet */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
            >
              {error}
            </div>
          )}

          {/* Sikeres módosítás */}
          {success && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm leading-5 text-green-700"
            >
              {success}
            </div>
          )}

          {!success && (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="reset-password-email"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Email cím
                </label>

                <input
                  id="reset-password-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="adja meg az email címét"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />
              </div>

              {/* Új jelszó */}
              <div>
                <label
                  htmlFor="reset-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Új jelszó
                </label>

                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Adja meg az új jelszót"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />

                <p className="mt-1.5 text-xs text-gray-400">
                  A jeszó legalább 8 karakter hosszú kell hogy legyen.
                </p>
              </div>

              {/* Új jelszó ismét */}
              <div>
                <label
                  htmlFor="reset-password-again"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Új jelszó ismét
                </label>

                <input
                  id="reset-password-again"
                  type="password"
                  value={passwordAgain}
                  onChange={(event) =>
                    setPasswordAgain(event.target.value)
                  }
                  placeholder="Adja meg újra az új jelszót"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />
              </div>

              {/* Küldés */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading
                  ? 'Jelszó módosítása...'
                  : 'Új jelszó beállítása'}
              </button>
            </form>
          )}

          {/* Siker után login */}
          {success && (
            <Link
              href="/login"
              className="mt-5 block w-full rounded-lg bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Bejelentkezés
            </Link>
          )}

          {/* Vissza */}
          {!success && (
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
              >
                ← Vissza a bejelentkezéshez
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  )
}