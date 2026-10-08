'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface ChangePasswordModalProps {
isOpen: boolean
onClose: () => void
}

export default function ChangePasswordModal({
isOpen,
onClose,
}: ChangePasswordModalProps) {
const { data: session, status } = useSession()

const [currentPassword, setCurrentPassword] = useState('')
const [newPassword, setNewPassword] = useState('')
const [confirmPassword, setConfirmPassword] = useState('')
const [error, setError] = useState('')
const [success, setSuccess] = useState('')

if (!isOpen) return null

const isLoading = status === 'loading'
const isLoggedIn = status === 'authenticated' && !!session

const isGoogleLogin = session?.user?.loginProvider === 'google'

const handleClose = () => {
setCurrentPassword('')
setNewPassword('')
setConfirmPassword('')
setError('')
setSuccess('')
onClose()
}

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
event.preventDefault()

setError('')
setSuccess('')

if (!isLoggedIn) {
  setError('A jelszó módosításához be kell jelentkezned.')
  return
}

if (isGoogleLogin) {
  setError(
    'Google-fiókkal történt bejelentkezés esetén itt nem módosítható jelszó. a felhasználóadatokat a Google kezeli'
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
  setError('A jelszó megerősítése nem egyezik az új jelszóval.')
  return
}

if (newPassword.length < 8) {
  setError('Az új jelszónak legalább 8 karakter hosszúnak kell lennie.')
  return
}

if (!/\d/.test(newPassword)) {
      setError(
        'A jelszónak legalább egy számot kell tartalmaznia.',
      )
      return
    }

/*
 * A backend endpoint még nincs kész.
 *
 * Ide kerül majd a POST kérés, amely:
 * - ellenőrzi a jelenlegi jelszót
 * - létrehozza a jelszóváltoztatási kérelmet
 * - emailben elküldi a megerősítő linket
 */

setSuccess(
  'A jelszómódosítási kérés elkészült. A megerősítéshez ellenőrizd az emailjeidet.'
)


}

return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title" >
<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
<div className="mb-6 flex items-center justify-between">
<div>
<h2 id="change-password-title" className="text-xl font-semibold text-gray-900" >
Jelszó módosítása
</h2>

        <p className="mt-1 text-sm text-gray-500">
          A módosításhoz add meg a jelenlegi jelszavad.
        </p>
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        aria-label="Bezárás"
      >
        ×
      </button>
    </div>

    {isLoading && (
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        Bejelentkezési állapot ellenőrzése...
      </div>
    )}

    {!isLoading && !isLoggedIn && (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        A jelszó módosításához be kell jelentkezned.
      </div>
    )}

    {!isLoading && isLoggedIn && isGoogleLogin && (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">
          Jelszó módosítása nem lehetséges
        </p>

        <p className="mt-1">
          Google-fiókkal jelentkeztél be. Ennél a bejelentkezési módnál
          nincs KajAI-jelszó, amit itt módosítani lehetne.
        </p>
      </div>
    )}

    {!isLoading && isLoggedIn && !isGoogleLogin && (
      <form onSubmit={handleSubmit} className="space-y-4">
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
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            placeholder="Addja meg jelenlegi jelszavát"
          />
        </div>

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
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            placeholder="Addja meg új jelszavát"
          />

          <p className="mt-1 text-xs text-gray-500">
            Legalább 8 karakter.
          </p>
        </div>

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
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            placeholder="új jelszó megismétlése"
          />
        </div>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            role="status"
          >
            {success}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Mégse
          </button>

          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            Jelszó módosítása
          </button>
        </div>
      </form>
    )}

    {!isLoading && isLoggedIn && isGoogleLogin && (
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Bezárás
        </button>
      </div>
    )}

    {!isLoading && !isLoggedIn && (
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Bezárás
        </button>
      </div>
    )}
  </div>
</div>


)
}