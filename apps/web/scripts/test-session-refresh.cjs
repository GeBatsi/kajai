/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness for the existing TypeScript compiler. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

// The session refresh endpoint is NextAuth's GET /api/auth/session: drive its real core
// handler with our real auth options, replacing only database I/O.
const nextAuthDir = path.dirname(require.resolve('next-auth'))
const { AuthHandler } = require(path.join(nextAuthDir, 'core'))
const { encode, decode } = require(path.join(nextAuthDir, 'jwt'))

function loadSource(relativePath, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath)
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = loaded.require.bind(loaded)
  loaded.require = (name) =>
    Object.hasOwn(overrides, name) ? overrides[name] : originalRequire(name)
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  })
  loaded._compile(compiled.outputText, filename)
  return loaded.exports
}

const secret = 'unit-test-session-secret-not-for-production'
process.env.NEXTAUTH_URL = 'http://localhost:4000'
let dbRole = 'USER'
const { getAuthOptions, SESSION_MAX_AGE_SECONDS } = loadSource('lib/auth.ts', {
  './prisma': {
    prisma: { user: { findUnique: async () => (dbRole === null ? null : { role: dbRole }) } },
  },
})

async function refresh(cookieValue) {
  // Rejected cookies are expected here; keep NextAuth's error log out of the test output.
  const quiet = { error: () => {}, warn: () => {}, debug: () => {} }
  const options = { ...(await getAuthOptions()), secret, logger: quiet }
  const response = await AuthHandler({
    req: {
      action: 'session',
      method: 'GET',
      cookies: cookieValue === undefined ? {} : { 'kajai-session': cookieValue },
      headers: { host: 'localhost:4000' },
      query: {},
      body: {},
    },
    options,
  })
  const sessionCookie = (response.cookies ?? []).find((c) => c.name === 'kajai-session')
  return { body: response.body, sessionCookie }
}

const nearlyExpired = () =>
  encode({ token: { userId: 'test-user', role: 'USER', sub: 'test-user' }, secret, maxAge: 60 })

test('session lifetime is an explicit 30 day inactivity limit', () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60)
})

test('a valid session cookie is re-issued with a fresh expiry and the same identity', async () => {
  const before = Date.now()
  const { body, sessionCookie } = await refresh(await nearlyExpired())
  assert.equal(body.user.id, 'test-user')
  assert.ok(sessionCookie?.value, 'refreshed session cookie is set')

  const expected = before + SESSION_MAX_AGE_SECONDS * 1000
  const expires = sessionCookie.options.expires.getTime()
  assert.ok(Math.abs(expires - expected) < 60_000, 'cookie expiry slides forward')

  const payload = await decode({ token: sessionCookie.value, secret })
  assert.equal(payload.userId, 'test-user')
  assert.ok(Math.abs(payload.exp * 1000 - expected) < 60_000, 'token exp slides forward')
})

test('the refreshed token stays in an XSS-protected httpOnly cookie', async () => {
  const { sessionCookie } = await refresh(await nearlyExpired())
  assert.equal(sessionCookie.options.httpOnly, true)
  assert.equal(sessionCookie.options.sameSite, 'lax')
  assert.equal(sessionCookie.options.path, '/')
})

test('refresh reports the current database role, not the role stored in the token', async () => {
  dbRole = 'MODERATOR'
  try {
    const { body } = await refresh(await nearlyExpired())
    assert.equal(body.user.role, 'MODERATOR')
  } finally {
    dbRole = 'USER'
  }
})

for (const [description, makeCookie] of [
  [
    'expired',
    () => encode({ token: { userId: 'test-user', sub: 'test-user' }, secret, maxAge: -60 }),
  ],
  [
    'encrypted with the wrong secret',
    () => encode({ token: { userId: 'test-user', sub: 'test-user' }, secret: 'wrong-secret' }),
  ],
  ['malformed', async () => 'fake.token.value'],
]) {
  test(`session cookie that is ${description} is not refreshed and is cleared`, async () => {
    const { body, sessionCookie } = await refresh(await makeCookie())
    assert.deepEqual(body, {})
    assert.equal(sessionCookie?.value ?? '', '')
  })
}

test('no session cookie means no session and no new cookie', async () => {
  const { body, sessionCookie } = await refresh(undefined)
  assert.deepEqual(body, {})
  assert.equal(sessionCookie, undefined)
})
