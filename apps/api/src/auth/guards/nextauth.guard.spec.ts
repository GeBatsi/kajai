import assert from 'node:assert/strict'
import { hkdfSync } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mock, test } from 'node:test'
import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Role } from '@kajai/db'
import { EncryptJWT, SignJWT } from 'jose'
import { PrismaService } from '../../prisma/prisma.service'
import { RequestWithUser } from '../types/request-user.type'
import { NextAuthGuard } from './nextauth.guard'

// Use the web app's installed encoder to verify the actual NextAuth v4 contract.
const { encode } = createRequire(resolve(__dirname, '../../../../web/package.json'))(
  'next-auth/jwt',
) as {
  encode: (params: {
    token: Record<string, unknown>
    secret: string
    maxAge?: number
  }) => Promise<string>
}
const secret = 'unit-test-session-secret-not-for-production'
const origin = 'http://localhost:4000'
const session = (
  token: Record<string, unknown> = { userId: 'real-user', role: 'ADMIN' },
  maxAge = 3600,
) => encode({ token, secret, maxAge })

function setup(cookies: unknown = {}, method = 'GET', requestOrigin?: string) {
  const findUnique = mock.fn<(...args: unknown[]) => Promise<{ id: string; role: Role } | null>>(
    async () => ({ id: 'real-user', role: Role.USER }),
  )
  const values: Record<string, string | undefined> = {
    NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: origin,
  }
  const config = { get: (name: string) => values[name] } as ConfigService
  const guard = new NextAuthGuard({ user: { findUnique } } as unknown as PrismaService, config)
  const request = {
    method,
    cookies,
    headers: {
      'x-user-id': 'forged-user',
      'x-user-role': 'ADMIN',
      ...(requestOrigin ? { origin: requestOrigin } : {}),
    },
    user: { id: 'untrusted-prior-user', role: Role.ADMIN },
  } as unknown as RequestWithUser
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext
  return { guard, context, request, findUnique, values }
}

test('real NextAuth cookie uses the verified ID and current database role, ignoring headers and token role', async () => {
  const { guard, context, request, findUnique } = setup({ 'kajai-session': await session() })
  assert.equal(await guard.canActivate(context), true)
  assert.deepEqual(request.user, { id: 'real-user', role: Role.USER })
  assert.deepEqual(findUnique.mock.calls[0].arguments, [
    { where: { id: 'real-user' }, select: { id: true, role: true } },
  ])
})

test('role changes take effect on the next request with the same session cookie', async () => {
  const { guard, context, request, findUnique } = setup({ 'kajai-session': await session() })
  findUnique.mock.mockImplementationOnce(async () => ({ id: 'real-user', role: Role.ADMIN }))
  await guard.canActivate(context)
  assert.equal(request.user?.role, Role.ADMIN)
  await guard.canActivate(context)
  assert.equal(request.user?.role, Role.USER)
  assert.equal(findUnique.mock.callCount(), 2)
})

for (const [description, cookies] of [
  ['no cookie', undefined],
  ['empty cookie', { 'kajai-session': '' }],
  ['non-string cookie', { 'kajai-session': { userId: 'forged-user' } }],
  ['malformed token', { 'kajai-session': 'fake.token.signature' }],
  ['unrelated cookie prefix', { 'kajai-session-other': 'fake' }],
  ['missing first chunk', { 'kajai-session.1': 'fake' }],
  ['missing middle chunk', { 'kajai-session.0': 'fake', 'kajai-session.2': 'fake' }],
  ['non-numeric chunk', { 'kajai-session.bad': 'fake' }],
  ['mixed complete cookie and chunks', { 'kajai-session': 'fake', 'kajai-session.0': 'fake' }],
] as const) {
  test(`${description} returns 401 even with forged ADMIN headers`, async () => {
    const { guard, context, request, findUnique } = setup(cookies)
    await assert.rejects(guard.canActivate(context), UnauthorizedException)
    assert.equal(request.user, undefined)
    assert.equal(findUnique.mock.callCount(), 0)
  })
}

test('split cookies are joined numerically even with more than ten chunks', async () => {
  const token = await session()
  const size = Math.ceil(token.length / 12)
  const chunks: Record<string, string> = {}
  for (let index = 0; index * size < token.length; index++) {
    chunks[`kajai-session.${index}`] = token.slice(index * size, (index + 1) * size)
  }
  const { guard, context } = setup(Object.fromEntries(Object.entries(chunks).reverse()))
  assert.equal(await guard.canActivate(context), true)
})

for (const [description, makeToken] of [
  ['expired token', () => session(undefined, -60)],
  ['wrong secret', () => encode({ token: { userId: 'real-user' }, secret: 'wrong-secret' })],
  ['missing user ID', () => session({ role: 'ADMIN' })],
  ['non-string user ID', () => session({ userId: { id: 'real-user' } })],
  ['empty user ID', () => session({ userId: '  ' })],
  [
    'modified encrypted payload',
    async () => {
      const parts = (await session()).split('.')
      parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)
      return parts.join('.')
    },
  ],
  [
    'signed JWT instead of encrypted session',
    () =>
      new SignJWT({ userId: 'real-user' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret)),
  ],
  [
    'missing expiration',
    () =>
      new EncryptJWT({ userId: 'real-user' })
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .setIssuedAt()
        .encrypt(
          new Uint8Array(
            hkdfSync('sha256', secret, '', 'NextAuth.js Generated Encryption Key', 32),
          ),
        ),
  ],
] as const) {
  test(`${description} is rejected before database access`, async () => {
    const { guard, context, findUnique } = setup({ 'kajai-session': await makeToken() })
    await assert.rejects(guard.canActivate(context), UnauthorizedException)
    assert.equal(findUnique.mock.callCount(), 0)
  })
}

test('a deleted user cannot reuse a still-valid session', async () => {
  const { guard, context, request, findUnique } = setup({ 'kajai-session': await session() })
  findUnique.mock.mockImplementation(async () => null)
  await assert.rejects(guard.canActivate(context), UnauthorizedException)
  assert.equal(request.user, undefined)
})

test('database outages are not disguised as invalid login', async () => {
  const { guard, context, findUnique } = setup({ 'kajai-session': await session() })
  const error = new Error('Database unavailable')
  findUnique.mock.mockImplementation(async () => {
    throw error
  })
  await assert.rejects(guard.canActivate(context), (actual) => actual === error)
})

test('missing secret fails closed as a configuration error', async () => {
  const { guard, context, findUnique, values } = setup({ 'kajai-session': await session() })
  delete values.NEXTAUTH_SECRET
  await assert.rejects(guard.canActivate(context), InternalServerErrorException)
  assert.equal(findUnique.mock.callCount(), 0)
})

for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
  test(`${method} accepts the configured frontend Origin`, async () => {
    const { guard, context } = setup({ 'kajai-session': await session() }, method, origin)
    assert.equal(await guard.canActivate(context), true)
  })
  for (const requestOrigin of [
    undefined,
    'null',
    'https://attacker.example',
    `${origin}.attacker.example`,
  ]) {
    test(`${method} rejects missing or untrusted Origin: ${requestOrigin}`, async () => {
      const { guard, context, findUnique } = setup(
        { 'kajai-session': await session() },
        method,
        requestOrigin,
      )
      await assert.rejects(guard.canActivate(context), ForbiddenException)
      assert.equal(findUnique.mock.callCount(), 0)
    })
  }
}
