'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'

export default function ForgotPasswordPage() {
const [email, setEmail] = useState('')
const [error, setError] = useState('')
const [success, setSuccess] = useState('')
const [isLoading, setIsLoading] = useState(false)

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()

  setError('')
  setSuccess('')
  setIsLoading(true)

  const backEndUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

  try {
    const response = await fetch(
      `${backEndUrl}/api/auth/forgotpassword`,
      {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email.trim(),
        }),
      },
    )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    setError( data?.message || 'Nem sikerült elküldeni a jelszó-visszaállító emailt.')
    return
  }

  setSuccess(
    data?.message ||
      'Emailt küldtünk a további teendőkről.',
  )

  setEmail('')
} catch { setError(
    'Nem sikerült kapcsolódni a szerverhez. Kérjük, próbáld újra.',)
} finally { setIsLoading(false)}


}

return (
<>
<Header
        onLoginClick={() => { window.location.href = '/login'}}
        onRegisterClick={() => { window.location.href = '/login'}}
      />
<main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
<div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
{/* Fejléc */}
<div className="mb-8 text-center">
<h1 className="mb-2 text-2xl font-bold text-gray-900">
Elfelejtett jelszó
</h1>

      <p className="text-sm leading-6 text-gray-500">
        Addja meg a regisztrációhoz használt email címedet,
        és elküldjük a jelszava megváltoztatásához szükséges
        további teendőket. Ha Google bejentkezést használ, akkor a jelszót ott kell módosítani, 
        ez a felület csak az itt regisztrált email címek esetén működik!
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

    {/* Sikeres küldés */}
    {success && (
      <div
        role="status"
        className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm leading-5 text-green-700"
      >
        {success}
      </div>
    )}

    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      <div>
        <label
          htmlFor="forgot-password-email"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Email cím
        </label>

        <input
          id="forgot-password-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="adja meg az email címét"
          autoComplete="email"
          autoFocus
          required
          disabled={isLoading || !!success}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100"
        />
      </div>

      {!success && (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Email küldése...' : 'Jelszó-visszaállító email küldése'}
        </button>
      )}
    </form>

    {/* Vissza a loginhoz */}
    <div className="mt-6 text-center">
      <Link href="/login"
        className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
      >
        ← Vissza a bejelentkezéshez
      </Link>
    </div>
  </div>
</main></>

)
}