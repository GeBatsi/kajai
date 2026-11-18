import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { Controller, Get, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Role, type User } from '@kajai/db'
import cookieParser from 'cookie-parser'
import * as bcrypt from 'bcrypt'
import { AuthModule } from './auth.module'
import { MinRole } from './decorators/min-role.decorator'
import { Roles } from './decorators/roles.decorator'
import { PrismaModule } from '../prisma/prisma.module'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { MailTokenService } from '../mail-token/mail-token.service'
import { TokenService } from '../token/token.service'
import { UsersService } from '../users/users.service'
import { hasMinRole } from './role-hierarchy'

const { encode } = createRequire(resolve(__dirname, '../../../web/package.json'))('next-auth/jwt') as {
  encode: (params: { token: Record<string, unknown>; secret: string }) => Promise<string>
}

@Controller('rbac-test')
class RbacTestController {
  @Get('default')
  defaultProtected() { return { ok: true } }

  @Get('user')
  @MinRole(Role.USER)
  user() { return { ok: true } }

  @Get('moderator')
  @MinRole(Role.MODERATOR)
  moderator() { return { ok: true } }

  @Get('exact-user')
  @Roles(Role.USER)
  exactUser() { return { ok: true } }

  @Get('both')
  @Roles(Role.USER)
  @MinRole(Role.MODERATOR)
  both() { return { ok: true } }
}

test('typed role hierarchy excludes guests and fails closed for unknown runtime roles', () => {
  for (const role of Object.values(Role)) {
    assert.equal(hasMinRole(role, Role.USER), role !== Role.GUEST)
    assert.equal(hasMinRole(role, Role.MODERATOR), role === Role.MODERATOR || role === Role.ADMIN)
    assert.equal(hasMinRole(role, Role.ADMIN), role === Role.ADMIN)
  }
  assert.equal(hasMinRole('UNKNOWN' as Role, Role.USER), false)
})

test('production AuthModule globally protects Users CRUD and preserves auth/profile flows over HTTP', async (t) => {
  const secret = 'rbac-test-secret-not-for-production'
  const origin = 'http://localhost:4000'
  const password = 'StrongPassword123'
  const passwordHash = await bcrypt.hash(password, 4)
  const users = new Map<string, User>()
  const makeUser = (id: string, email: string): User => ({
    id, email, password: passwordHash, role: Role.USER, name: 'Test user', image: null,
    isVerified: true, bannedAt: null, banReason: null, createdAt: new Date(), updatedAt: new Date(),
  })
  const caller = makeUser('caller', 'caller@example.com')
  users.set(caller.id, caller)
  users.set('target', makeUser('target', 'target@example.com'))
  let authReads = 0
  let mutations = 0
  let mailSent = 0
  const tokens = new Map<string, { id: string; userId: string; createdAt: Date; type: string }>()
  const project = (user: User | undefined, select?: Record<string, boolean>) =>
    user ? select ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, user[key as keyof User]])) : { ...user } : null
  const prisma = {
    user: {
      findUnique: async ({ where, select }: { where: { id?: string; email?: string }; select?: Record<string, boolean> }) => {
        if (select?.bannedAt) authReads++
        return project(where.id ? users.get(where.id) : [...users.values()].find((u) => u.email === where.email), select)
      },
      findMany: async ({ select }: { select: Record<string, boolean> }) => [...users.values()].map((u) => project(u, select)),
      create: async ({ data, select }: { data: Partial<User> & { email: string }; select: Record<string, boolean> }) => {
        mutations++
        const user = { ...makeUser(`created-${mutations}`, data.email), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), isVerified: false }
        users.set(user.id, user)
        return project(user, select)
      },
      update: async ({ where, data, select }: { where: { id: string }; data: Partial<User>; select: Record<string, boolean> }) => {
        mutations++
        const user = users.get(where.id)!
        Object.assign(user, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)))
        return project(user, select)
      },
      delete: async ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) => {
        mutations++
        const result = project(users.get(where.id), select)
        users.delete(where.id)
        return result
      },
    },
    userProfile: {
      findUnique: async ({ where }: { where: { userId: string } }) => ({
        userId: where.userId, gender: null, dateOfBirth: null, heightCm: null, weightKg: null,
        bodyFatPct: null, activityLevel: 'SEDENTARY', goalType: 'MAINTENANCE',
      }),
      update: async ({ where, data }: { where: { userId: string }; data: object }) => ({ ...where, ...data }),
    },
  }
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ NEXTAUTH_SECRET: secret, NEXTAUTH_URL: origin })] }),
      PrismaModule, AuthModule,
    ],
    controllers: [RbacTestController],
  })
    .overrideProvider(PrismaService).useValue(prisma)
    .overrideProvider(MailService).useValue({
      sendVerificationEmail: async () => { mailSent++ },
      sendNewPasswordEmail: async () => { mailSent++ },
    })
    .overrideProvider(MailTokenService).useValue({
      create: async (userId: string, token: string, type: string) => { tokens.set(token, { id: token, userId, createdAt: new Date(), type }) },
      findByToken: async (token: string) => tokens.get(token),
      delete: async (token: string) => { tokens.delete(token) },
    })
    .overrideProvider(TokenService).useValue({ generateToken: () => 'legacy-verification-token' })
    .compile()
  const app = module.createNestApplication({ logger: false })
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  await app.listen(0, '127.0.0.1')
  t.after(() => app.close())
  const base = `${await app.getUrl()}/api`
  const cookie = `kajai-session=${await encode({ token: { userId: caller.id, role: 'ADMIN' }, secret })}`
  const request = (path: string, method = 'GET', body?: unknown, sessionCookie: string | null = cookie) => fetch(`${base}${path}`, {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json', 'x-user-role': 'ADMIN', ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const noSecrets = (body: unknown) => {
    if (body && typeof body === 'object') {
      assert.ok(!Object.hasOwn(body, 'password') && !Object.hasOwn(body, 'banReason'))
      Object.values(body).forEach(noSecrets)
    }
    assert.ok(!JSON.stringify(body).includes(passwordHash))
  }

  for (const route of [
    { path: '/users', method: 'GET', status: 200 },
    { path: '/users/target', method: 'GET', status: 200 },
    { path: '/users', method: 'POST', body: { email: 'admin-created@example.com', password }, status: 201 },
    { path: '/users/target', method: 'PATCH', body: { name: 'Edited', image: 'https://example.com/avatar.png' }, status: 200 },
    { path: '/users/target', method: 'DELETE', status: 200 },
  ]) {
    for (const role of [null, Role.GUEST, Role.USER, Role.MODERATOR, Role.ADMIN]) {
      await t.test(`${route.method} ${route.path}: ${role ?? 'no session'}`, async () => {
        caller.role = role ?? Role.ADMIN
        const beforeReads = authReads
        const beforeMutations = mutations
        const response = await request(route.path, route.method, route.body, role ? cookie : null)
        const body = await response.json()
        assert.equal(response.status, !role ? 401 : role === Role.ADMIN ? route.status : 403, JSON.stringify(body))
        assert.equal(authReads - beforeReads, role ? 1 : 0, 'exactly one authentication lookup per request')
        if (role === Role.ADMIN) noSecrets(body)
        else assert.equal(mutations, beforeMutations)
      })
    }
  }

  await t.test('admin create hashes once, and creation without a password remains supported', async () => {
    const created = [...users.values()].find((u) => u.email === 'admin-created@example.com')!
    assert.notEqual(created.password, password)
    assert.ok(await bcrypt.compare(password, created.password!))
    const response = await request('/users', 'POST', { email: 'passwordless@example.com' })
    assert.equal(response.status, 201)
    noSecrets(await response.json())
    assert.equal([...users.values()].find((u) => u.email === 'passwordless@example.com')?.password, null)
  })

  for (const field of ['password', 'role', 'isVerified', 'email', 'bannedAt', 'banReason']) {
    await t.test(`admin PATCH rejects ${field}`, async () => {
      const before = mutations
      const response = await request('/users/caller', 'PATCH', { [field]: field === 'isVerified' ? true : 'ADMIN' })
      assert.equal(response.status, 400)
      await response.text()
      assert.equal(mutations, before)
    })
  }

  await t.test('admin service also ignores mass assignment outside HTTP validation', async () => {
    caller.role = Role.USER
    await module.get(UsersService).updateAdmin(caller.id, { name: 'Allowed', role: Role.ADMIN, password: 'raw' } as { name: string })
    assert.equal(caller.password, passwordHash)
    assert.equal(caller.name, 'Allowed')
    assert.equal(caller.role, Role.USER)
  })

  for (const [path, method, body] of [
    ['/users/me/profile', 'GET', undefined],
    ['/users/me/profile/preview', 'POST', {}],
    ['/users/me/profile', 'PATCH', {}],
  ] as const) {
    await t.test(`USER retains ${method} ${path}`, async () => {
      caller.role = Role.USER
      const response = await request(path, method, body)
      assert.equal(response.status, 200, await response.text())
    })
  }

  for (const role of [Role.USER, Role.MODERATOR, Role.ADMIN]) {
    for (const [path, allowed] of [
      ['user', true], ['moderator', role !== Role.USER], ['exact-user', role === Role.USER], ['both', false],
    ] as const) {
      await t.test(`${role} hierarchy/exact roles: ${path}`, async () => {
        caller.role = role
        const response = await request(`/rbac-test/${path}`)
        assert.equal(response.status, allowed ? 200 : 403)
        await response.text()
      })
    }
  }

  await t.test('new endpoint requires auth by default and malformed sessions return 401', async () => {
    for (const value of [null, 'kajai-session=invalid']) {
      const response = await request('/rbac-test/default', 'GET', undefined, value)
      assert.equal(response.status, 401)
      await response.text()
    }
  })

  await t.test('ban takes effect on the next request with the same valid session', async () => {
    caller.role = Role.ADMIN
    assert.equal((await request('/users')).status, 200)
    caller.bannedAt = new Date()
    for (const path of ['/users', '/users/me/profile', '/rbac-test/default']) {
      const response = await request(path)
      assert.equal(response.status, 403)
      await response.text()
    }
    const response = await request('/auth/login', 'POST', { email: caller.email, password }, null)
    assert.equal(response.status, 401)
    await response.text()
    caller.bannedAt = null
    assert.equal((await request('/users')).status, 200)
  })

  await t.test('public logout remains callable with no session', async () => {
    const response = await request('/auth/logout', 'POST', undefined, null)
    assert.equal(response.status, 201)
    assert.ok(response.headers.get('set-cookie')?.includes('kajai-session='))
    await response.text()
  })

  await t.test('registration, verification, login and password reset preserve internal service updates', async () => {
    let response = await request('/auth/register', 'POST', { email: 'new@example.com', password, name: 'New' }, null)
    assert.equal(response.status, 201, await response.text())
    const user = [...users.values()].find((u) => u.email === 'new@example.com')!
    assert.ok(await bcrypt.compare(password, user.password!))
    assert.equal(user.isVerified, false)
    response = await request('/auth/login', 'POST', { email: user.email, password }, null)
    assert.equal(response.status, 401)
    await response.text()
    const verificationToken = [...tokens.entries()].find(([, value]) => value.userId === user.id && value.type === 'EMAIL_VERIFICATION')![0]
    response = await request(`/auth/verify?id=${verificationToken}`, 'GET', undefined, null)
    assert.equal(response.status, 200)
    noSecrets(await response.json())
    assert.equal(user.isVerified, true)
    response = await request('/auth/login', 'POST', { email: user.email, password }, null)
    assert.equal(response.status, 201)
    noSecrets(await response.json())
    response = await request('/auth/forgotpassword', 'POST', { email: user.email }, null)
    assert.equal(response.status, 201)
    await response.text()
    const resetToken = [...tokens.entries()].find(([, value]) => value.userId === user.id && value.type === 'PASSWORD_RESET')![0]
    const newPassword = 'NewPassword123'
    response = await request('/auth/resetpassword', 'POST', { email: user.email, password: newPassword, token: resetToken }, null)
    assert.equal(response.status, 201, await response.text())
    assert.ok(await bcrypt.compare(newPassword, user.password!))
    assert.ok(!tokens.has(resetToken))
    response = await request('/auth/login', 'POST', { email: user.email, password: newPassword }, null)
    assert.equal(response.status, 201)
    noSecrets(await response.json())
    response = await request('/auth/login', 'POST', { email: user.email, password }, null)
    assert.equal(response.status, 401)
    await response.text()
    assert.equal(mailSent, 2)
  })
})
