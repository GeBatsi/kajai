'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState,useRef } from 'react'
import { signIn } from 'next-auth/react'

type VerifyState = 'loading' | 'success' | 'error'

function VerifyPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('id')

  const [state, setState] = useState<VerifyState>('loading')

  const hasVerified = useRef(false)

  async function verifyToken(token: string) {
    try {
      const result = await signIn('email-verification', {
        token,
        redirect: false,
      })

      if (!result || result.error) {
        setState('error')
        return
      }
      setState('success')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
  if (!token) {
    setState('error')
    return
  }

  if (hasVerified.current) {
    return
  }

  hasVerified.current = true

  verifyToken(token)
}, [token])

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-8 w-8 animate-spin text-gray-700"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                className="opacity-25"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                className="opacity-90"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className="mb-3 text-2xl font-bold text-gray-900">
            Email cím ellenőrzése
          </h1>

          <p className="text-sm leading-6 text-gray-500">
            Ellenőrizzük a megerősítő linket...
          </p>
        </div>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
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
          </div>

          <h1 className="mb-3 text-2xl font-bold text-gray-900">
            Sikertelen megerősítés
          </h1>

          <p className="mb-6 text-sm leading-6 text-gray-500">
            A megerősítő link érvénytelen vagy hiányzik.
            <br />
            Regisztráljon újra.
          </p>

          <a
            href="/"
            className="block w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Vissza a főoldalra
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
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

        <h1 className="mb-3 text-2xl font-bold text-gray-900">
          Email cím megerősítve
        </h1>

        <p className="mb-7 text-sm leading-6 text-gray-600">
          Az email címed sikeresen megerősítetted.
          <br />
          Most már bejelentkezhetsz a fiókodba.
        </p>

        <a
          href="/"
          className="block w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Bejelentkezés
        </a>
      </div>
    </main>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="text-sm text-gray-500">
            Betöltés...
          </div>
        </main>
      }
    >
      <VerifyPageContent />
    </Suspense>
  )
}