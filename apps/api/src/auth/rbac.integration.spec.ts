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
import { usersTestStore } from '../users/users-test-store.spec'

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
  const makeUser = (id: string, email: string): User => ({
    id, email, password: passwordHash, role: Role.USER, name: 'Test user', image: null,
    isVerified: true, bannedAt: null, banReason: null, createdAt: new Date(), updatedAt: new Date(),
  })
  const caller = makeUser('caller', 'caller@example.com')
  const { prisma, users, audits, state } = usersTestStore([caller, makeUser('target', 'target@example.com')])
  let mailSent = 0
  const tokens = new Map<string, { id: string; userId: string; createdAt: Date; type: string }>()
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
      for (const key of ['password', 'profile', 'mailTokens', 'mealLogs', 'weightLogs', 'activityLogs']) assert.ok(!Object.hasOwn(body, key))
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
        const beforeReads = state.authReads
        const beforeMutations = state.mutations
        const response = await request(route.path, route.method, route.body, role ? cookie : null)
        const body = await response.json()
        assert.equal(response.status, !role ? 401 : role === Role.ADMIN ? route.status : 403, JSON.stringify(body))
        assert.equal(state.authReads - beforeReads, role ? 1 : 0, 'exactly one guard lookup; transaction revalidation is separate')
        if (role === Role.ADMIN) noSecrets(body)
        else assert.equal(state.mutations, beforeMutations)
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
      const before = state.mutations
      const response = await request('/users/caller', 'PATCH', { [field]: field === 'isVerified' ? true : 'ADMIN' })
      assert.equal(response.status, 400)
      await response.text()
      assert.equal(state.mutations, before)
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

  for (const route of [
    { path: '/users/managed/role', method: 'PATCH', body: { role: 'MODERATOR' } },
    { path: '/users/managed/ban', method: 'POST', body: { reason: '  Rule violation  ' } },
    { path: '/users/managed/unban', method: 'POST', body: {} },
  ]) {
    users.set('managed', makeUser('managed', 'managed@example.com'))
    for (const role of [null, Role.GUEST, Role.USER, Role.MODERATOR, Role.ADMIN]) {
      await t.test(`${route.method} ${route.path}: ${role ?? 'no session'}`, async () => {
        caller.role = role ?? Role.ADMIN
        const response = await request(route.path, route.method, route.body, role ? cookie : null)
        assert.equal(response.status, !role ? 401 : role === Role.ADMIN ? 200 : 403, await response.text())
      })
    }
  }

  await t.test('management endpoints reject own-account changes, missing targets and invalid/extra fields', async () => {
    caller.role = Role.ADMIN
    for (const [suffix, method, body] of [
      ['/role', 'PATCH', { role: 'USER' }], ['/ban', 'POST', { reason: 'Reason' }], ['', 'DELETE', undefined],
    ] as const) {
      let response = await request(`/users/caller${suffix}`, method, body)
      assert.equal(response.status, 403, await response.text())
      response = await request(`/users/missing${suffix}`, method, body)
      assert.equal(response.status, 404, await response.text())
    }
    let response = await request('/users/missing/unban', 'POST', {})
    assert.equal(response.status, 404, await response.text())
    for (const body of [{ role: 'GUEST' }, { role: 'UNKNOWN' }, {}, { role: 'USER', password: 'injected' }]) {
      response = await request('/users/managed/role', 'PATCH', body)
      assert.equal(response.status, 400, await response.text())
    }
    for (const body of [{}, { reason: '' }, { reason: '   ' }, { reason: null }, { reason: 123 }, { reason: 'x'.repeat(501) }, { reason: 'OK', role: 'ADMIN' }]) {
      response = await request('/users/managed/ban', 'POST', body)
      assert.equal(response.status, 400, await response.text())
    }
    response = await request('/users/managed/unban', 'POST', { role: 'ADMIN' })
    assert.equal(response.status, 400, await response.text())
    for (const role of ['GUEST', 'UNKNOWN', null]) {
      response = await request('/users', 'POST', { email: 'guest@example.com', role })
      assert.equal(response.status, 400, await response.text())
    }
  })

  await t.test('ban, repeat, guard/login rejection, unban and login success with the same cookie', async () => {
    const managed = makeUser('managed', 'managed@example.com')
    users.set(managed.id, managed)
    const managedCookie = `kajai-session=${await encode({ token: { userId: managed.id, role: 'ADMIN' }, secret })}`
    const before = audits.length
    let response = await request('/users/managed/ban', 'POST', { reason: '  Original reason  ' })
    assert.equal(response.status, 200)
    const first = await response.json() as { bannedAt: string; banReason: string }
    assert.equal(first.banReason, 'Original reason')
    noSecrets(first)
    response = await request('/users/managed/ban', 'POST', { reason: 'Replacement' })
    assert.equal(response.status, 200)
    const repeated = await response.json() as { bannedAt: string; banReason: string }
    assert.equal(repeated.bannedAt, first.bannedAt)
    assert.equal(repeated.banReason, first.banReason)
    response = await request('/users/me/profile', 'GET', undefined, managedCookie)
    assert.equal(response.status, 403, await response.text())
    response = await request('/auth/login', 'POST', { email: managed.email, password }, null)
    assert.equal(response.status, 401, await response.text())
    response = await request('/users/managed/unban', 'POST', {})
    assert.equal(response.status, 200)
    const restored = await response.json() as { bannedAt: null; banReason: null; role: string }
    assert.equal(restored.bannedAt, null)
    assert.equal(restored.banReason, null)
    assert.equal(restored.role, 'USER')
    response = await request('/users/managed/unban', 'POST', {})
    assert.equal(response.status, 200, await response.text())
    assert.equal(audits.length - before, 2)
    response = await request('/auth/login', 'POST', { email: managed.email, password }, null)
    assert.equal(response.status, 201, await response.text())
    response = await request('/users/me/profile', 'GET', undefined, managedCookie)
    assert.equal(response.status, 200, await response.text())
  })

  await t.test('role updates are audited once and audited create may grant ADMIN/MODERATOR', async () => {
    const before = audits.length
    for (let repeat = 0; repeat < 2; repeat++) {
      const response = await request('/users/managed/role', 'PATCH', { role: 'MODERATOR' })
      assert.equal(response.status, 200, await response.text())
    }
    assert.equal(audits.length - before, 1)
    assert.deepEqual(audits.at(-1)?.oldValue, { role: 'USER' })
    assert.deepEqual(audits.at(-1)?.newValue, { role: 'MODERATOR' })
    assert.equal(audits.at(-1)?.userId, caller.id)
    assert.equal(audits.at(-1)?.recordId, 'managed')
    for (const role of ['ADMIN', 'MODERATOR']) {
      const response = await request('/users', 'POST', { email: `new-${role}@example.com`, role })
      assert.equal(response.status, 201, await response.text())
      assert.deepEqual(audits.at(-1)?.newValue, { role })
      assert.equal(audits.at(-1)?.action, 'CREATE')
    }
  })

  await t.test('HTTP audit failure rolls back role, ban, unban, delete and creation', async () => {
    state.failAudit = true
    const before = structuredClone(users.get('managed'))
    const auditCount = audits.length
    for (const [path, method, body] of [
      ['/users/managed/role', 'PATCH', { role: 'ADMIN' }],
      ['/users/managed/ban', 'POST', { reason: 'Must roll back' }],
      ['/users/managed', 'DELETE', undefined],
      ['/users', 'POST', { email: 'rollback@example.com', role: 'ADMIN' }],
    ] as const) {
      const response = await request(path, method, body)
      assert.equal(response.status, 500, await response.text())
      assert.deepEqual(users.get('managed'), before)
      assert.equal(audits.length, auditCount)
    }
    const managed = users.get('managed')!
    managed.bannedAt = new Date()
    managed.banReason = 'Keep this reason'
    const response = await request('/users/managed/unban', 'POST', {})
    assert.equal(response.status, 500, await response.text())
    assert.equal(managed.banReason, 'Keep this reason')
    assert.ok(managed.bannedAt)
    assert.ok(![...users.values()].some((user) => user.email === 'rollback@example.com'))
    state.failAudit = false
    managed.bannedAt = null
    managed.banReason = null
  })

  await t.test('external recipe references prevent HTTP deletion', async () => {
    state.externalReference = true
    const response = await request('/users/managed', 'DELETE')
    assert.equal(response.status, 409, await response.text())
    assert.ok(users.has('managed'))
    state.externalReference = false
  })

  await t.test('last active admin defensive checks return 409 over HTTP', async () => {
    users.get('managed')!.role = Role.ADMIN
    state.activeAdminCountOverride = 1
    for (const [suffix, method, body] of [
      ['/role', 'PATCH', { role: 'USER' }], ['/ban', 'POST', { reason: 'Denied' }], ['', 'DELETE', undefined],
    ] as const) {
      const response = await request(`/users/managed${suffix}`, method, body)
      assert.equal(response.status, 409, await response.text())
    }
    state.activeAdminCountOverride = undefined
    users.get('managed')!.role = Role.USER
  })

  await t.test('list validates queries and preserves legacy versus explicit paginated contracts', async () => {
    users.get('managed')!.name = 'Unique Search Name'
    users.get('managed')!.email = 'unique@sample.hu'
    let response = await request('/users')
    const legacy = await response.json()
    assert.ok(Array.isArray(legacy))
    assert.ok(legacy.every((user) => !('bannedAt' in user) && !('banReason' in user)))
    for (const query of ['search=unique%20search', 'search=SAMPLE.HU', 'page=1&limit=1', 'status=active', 'role=USER', 'search=']) {
      response = await request(`/users?${query}`)
      assert.equal(response.status, 200)
      const body = await response.json() as { data: Record<string, unknown>[]; meta: { page: number; limit: number; total: number } }
      assert.ok(Array.isArray(body.data))
      assert.equal(body.meta.page, 1)
      assert.ok(body.data.every((row) => 'bannedAt' in row && 'banReason' in row))
      noSecrets(body)
      if (query.startsWith('search=') && query !== 'search=') assert.equal(body.data[0].id, 'managed')
    }
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=1e2', 'page=', 'page=1000001', 'limit=0', 'limit=101', 'limit=abc', 'role=GUEST', 'role=UNKNOWN', 'status=all', 'search=a&search=b', 'page=1&page=2', 'unknown=1']) {
      response = await request(`/users?${query}`)
      assert.equal(response.status, 400, `${query}: ${await response.text()}`)
    }
    for (const role of [Role.USER, Role.MODERATOR]) {
      caller.role = role
      response = await request('/users?page=1')
      assert.equal(response.status, 403, await response.text())
    }
    caller.role = Role.ADMIN
  })

  await t.test('concurrent requests from two admins cannot disable both accounts', async () => {
    const first = makeUser('concurrent-first', 'concurrent-first@example.com')
    const second = makeUser('concurrent-second', 'concurrent-second@example.com')
    first.role = second.role = Role.ADMIN
    users.set(first.id, first)
    users.set(second.id, second)
    const firstCookie = `kajai-session=${await encode({ token: { userId: first.id }, secret })}`
    const secondCookie = `kajai-session=${await encode({ token: { userId: second.id }, secret })}`
    const responses = await Promise.all([
      request(`/users/${second.id}/ban`, 'POST', { reason: 'Concurrent test' }, firstCookie),
      request(`/users/${first.id}/role`, 'PATCH', { role: 'USER' }, secondCookie),
    ])
    const statuses = responses.map((response) => response.status).sort()
    assert.deepEqual(statuses, [200, 403])
    await Promise.all(responses.map((response) => response.text()))
    assert.equal([first, second].filter((user) => user.role === Role.ADMIN && user.bannedAt === null).length, 1)
  })
})
