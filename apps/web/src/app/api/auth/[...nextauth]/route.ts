import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { getAuthOptions } from '@/lib/auth'

type Ctx = { params: Promise<{ nextauth: string[] }> }

const handlerPromise = getAuthOptions().then((opts) => NextAuth(opts))

export async function GET(req: NextRequest, ctx: Ctx) {
  const handler = await handlerPromise
  return (handler as (req: NextRequest, ctx: Ctx) => Promise<Response>)(req, ctx)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const handler = await handlerPromise
  return (handler as (req: NextRequest, ctx: Ctx) => Promise<Response>)(req, ctx)
}
