import { AsyncLocalStorage } from 'node:async_hooks'

// Apple sends the user's name only on the very first authorization, as a `user` JSON field of
// the form_post callback body (never in the ID token). NextAuth v4 drops that field, so the
// route handler reads it and exposes it to the Apple provider's profile() for this request only.
export const appleFirstLoginName = new AsyncLocalStorage<string | null>()

const MAX_NAME_LENGTH = 100

export function parseAppleUserName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const name = (parsed as { name?: { firstName?: unknown; lastName?: unknown } } | null)?.name
  if (!name || typeof name !== 'object') return null
  // Hungarian name order: family name first.
  const full = [name.lastName, name.firstName]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, MAX_NAME_LENGTH)
  return full || null
}

export async function appleUserNameFromCallback(req: Request): Promise<string | null> {
  const form = await req
    .clone()
    .formData()
    .catch(() => null)
  return parseAppleUserName(form?.get('user'))
}
