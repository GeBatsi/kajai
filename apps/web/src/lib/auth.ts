import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import { SignJWT, importPKCS8 } from 'jose'
import { prisma } from './prisma'

async function getAppleClientSecret(): Promise<string> {
  const privateKey = await importPKCS8(
    process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    'ES256',
  )
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setAudience('https://appleid.apple.com')
    .setSubject(process.env.APPLE_ID!)
    .setIssuedAt()
    .setExpirationTime('180d')
    .sign(privateKey)
}

let _appleSecret: string | null = null

async function resolveAppleSecret(): Promise<string | null> {
  if (_appleSecret) return _appleSecret
  if (process.env.APPLE_SECRET) return process.env.APPLE_SECRET
  if (process.env.APPLE_PRIVATE_KEY && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
    _appleSecret = await getAppleClientSecret()
    return _appleSecret
  }
  return null
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const appleSecret = process.env.APPLE_ID ? await resolveAppleSecret() : null

  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
      ...(process.env.APPLE_ID && appleSecret
        ? [AppleProvider({ clientId: process.env.APPLE_ID, clientSecret: appleSecret })]
        : []),
    ],
    session: { strategy: 'jwt' },
    cookies: {
      sessionToken: {
        name: 'kajai-session',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },
    callbacks: {
      async jwt({ token, user, account }) {
        if (user?.email && account) {
          const dbUser = await prisma.user.upsert({
            where: { email: user.email },
            create: {
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
            },
            update: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
            select: { id: true, role: true },
          })
          await prisma.userProfile.upsert({
            where: { userId: dbUser.id },
            create: { userId: dbUser.id },
            update: {},
          })
          token.userId = dbUser.id
          token.role = dbUser.role
        }
        return token
      },
      async session({ session, token }) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        return session
      },
    },
    pages: { signIn: '/login' },
  }
}
