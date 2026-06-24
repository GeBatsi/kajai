import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
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
