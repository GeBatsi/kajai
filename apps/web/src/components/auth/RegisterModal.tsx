'use client'

import { useEffect, useState } from 'react'

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginClick?: () => void
}

export default function RegisterModal({
  isOpen,
  onClose,
  onLoginClick,
}: RegisterModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isLoading, onClose])

  if (!isOpen) {
    return null
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPassword('')
    setPasswordConfirm('')
    setError('')
    setIsSuccess(false)
  }

  const handleClose = () => {
    if (isLoading) return

    resetForm()
    onClose()
  }

  const handleLoginClick = () => {
    if (isLoading) return

    resetForm()
    onClose()

    onLoginClick?.()
  }

  const handleRegister = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')

    // Jelszó megerősítése
    if (password !== passwordConfirm) {
      setError('A két jelszó nem egyezik.')
      return
    }

    // Minimum 8 karakter
    if (password.length < 8) {
      setError(
        'A jelszónak minimum 8 karakter hosszúnak kell lennie.',
      )
      return
    }

    // Legalább egy szám
    if (!/\d/.test(password)) {
      setError(
        'A jelszónak legalább egy számot kell tartalmaznia.',
      )
      return
    }

    setIsLoading(true)

    try {
      const body: {
        email: string
        password: string
        name?: string
      } = {
        email: email.trim(),
        password,
      }

      // A nevet csak akkor küldjük el,
      // ha a felhasználó ténylegesen megadta.
      if (name.trim()) {
        body.name = name.trim()
      }
      const backEndUrl= process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
      const response = await fetch(
        `${backEndUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Sikertelen regisztráció.'

        setError(message)
        return
      }

      setIsSuccess(true)
    } catch {
      setError(
        'Nem sikerült kapcsolódni a szerverhez.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Bezárás */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          aria-label="Bezárás"
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>

        {!isSuccess ? (
          <>
            <h2
              id="register-modal-title"
              className="mb-2 pr-8 text-2xl font-bold text-gray-900"
            >
              Regisztráció
            </h2>

            <p className="mb-6 text-sm text-gray-500">
              Hozd létre a saját fiókodat.
            </p>

            {/* Hibaüzenet */}
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleRegister}
              className="flex flex-col gap-4"
            >
              {/* Név - opcionális */}
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Név
                  <span className="ml-1 font-normal text-gray-400">
                    (opcionális)
                  </span>
                </label>

                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Péter"
                  autoComplete="name"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="register-email"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>

                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="email@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />
              </div>

              {/* Jelszó */}
              <div>
                <label
                  htmlFor="register-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Jelszó
                </label>

                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Legalább 8 karakter, 1 szám"
                  autoComplete="new-password"
                  disabled={isLoading}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />

                <p className="mt-1.5 text-xs text-gray-400">
                  Legalább 8 karakter és legalább 1 szám.
                </p>
              </div>

              {/* Jelszó megerősítése */}
              <div>
                <label
                  htmlFor="register-password-confirm"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Jelszó megerősítése
                </label>

                <input
                  id="register-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) =>
                    setPasswordConfirm(event.target.value)
                  }
                  placeholder="Írd be újra a jelszót"
                  autoComplete="new-password"
                  disabled={isLoading}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
                />
              </div>

              {/* Regisztráció */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading
                  ? 'Regisztráció...'
                  : 'Regisztráció'}
              </button>
            </form>

            {/* Login link */}
            <div className="mt-5 text-center text-sm text-gray-500">
              Már van fiókod?{' '}
              <button
                type="button"
                onClick={handleLoginClick}
                disabled={isLoading}
                className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600 disabled:opacity-50"
              >
                Bejelentkezés
              </button>
            </div>
          </>
        ) : (
          /* Sikeres regisztráció */
          <div className="py-6 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-7 w-7 text-green-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12l4 4L19 6"
                />
              </svg>
            </div>

            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              Sikeres regisztráció
            </h2>

            <p className="mb-6 text-sm leading-6 text-gray-600">
              A regisztráció sikerült.
              <br />
              Küldtünk egy megerősítő emailt a megadott
              címre.
              <br />
              <br />
              Kérjük, erősítsd meg az email címedet a
              bejelentkezés előtt.
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Rendben
            </button>
          </div>
        )}
      </div>
    </div>
  )
}