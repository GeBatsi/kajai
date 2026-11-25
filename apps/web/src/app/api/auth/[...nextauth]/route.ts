import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { getAuthOptions } from '@/lib/auth'
import { appleFirstLoginName, appleUserNameFromCallback } from '@/lib/apple-signin'

type Ctx = { params: Promise<{ nextauth: string[] }> }

const handlerPromise = getAuthOptions().then((opts) => NextAuth(opts))

export async function GET(req: NextRequest, ctx: Ctx) {
  const handler = await handlerPromise
  return (handler as (req: NextRequest, ctx: Ctx) => Promise<Response>)(req, ctx)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const handler = await handlerPromise
  const { nextauth } = await ctx.params
  const appleName =
    nextauth.join('/') === 'callback/apple' ? await appleUserNameFromCallback(req) : null
  return appleFirstLoginName.run(appleName, () =>
    (handler as (req: NextRequest, ctx: Ctx) => Promise<Response>)(req, ctx),
  )
}
