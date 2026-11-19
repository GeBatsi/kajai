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
<main className="flex min-h-screen items-center justify-center bg-background px-4">
<div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-md">
{/* Fejléc */}
<div className="mb-8 text-center">
<h1 className="mb-2 text-2xl font-bold text-foreground">
Elfelejtett jelszó
</h1>

      <p className="text-sm leading-6 text-muted-foreground">
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
        className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-5 text-destructive"
      >
        {error}
      </div>
    )}

    {/* Sikeres küldés */}
    {success && (
      <div
        role="status"
        className="mb-5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm leading-5 text-success"
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
          className="mb-1.5 block text-sm font-medium text-foreground"
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
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:bg-muted"
        />
      </div>

      {!success && (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Email küldése...' : 'Jelszó-visszaállító email küldése'}
        </button>
      )}
    </form>

    {/* Vissza a loginhoz */}
    <div className="mt-6 text-center">
      <Link href="/login"
        className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        ← Vissza a bejelentkezéshez
      </Link>
    </div>
  </div>
</main></>

)
}