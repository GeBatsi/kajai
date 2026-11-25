/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness for the existing TypeScript compiler. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

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
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  loaded._compile(compiled.outputText, filename)
  return loaded.exports
}

// In-memory stand-in for the users table: upsert by unique email, like Prisma.
const users = new Map()
const upserts = []
const prisma = {
  user: {
    upsert: async (query) => {
      upserts.push(query)
      const existing = users.get(query.where.email)
      const row = existing
        ? { ...existing, ...Object.fromEntries(Object.entries(query.update).filter(([, v]) => v !== undefined)) }
        : { id: `user-${users.size + 1}`, role: 'USER', ...query.create }
      users.set(query.where.email, row)
      return { id: row.id, role: row.role }
    },
    findUnique: async () => ({ role: 'USER' }),
  },
  userProfile: { upsert: async () => ({}) },
}

const appleSignin = loadSource('lib/apple-signin.ts')
const { parseAppleUserName, appleUserNameFromCallback, appleFirstLoginName } = appleSignin
const { getAuthOptions } = loadSource('lib/auth.ts', {
  './prisma': { prisma },
  './apple-signin': appleSignin,
})

process.env.APPLE_ID = 'hu.kajai.web'
process.env.APPLE_SECRET = 'pre-generated-client-secret'

async function withEnv(url, run) {
  const previous = process.env.NEXTAUTH_URL
  process.env.NEXTAUTH_URL = url
  try {
    return await run()
  } finally {
    process.env.NEXTAUTH_URL = previous
  }
}

const appleUser = (firstName, lastName) => JSON.stringify({ name: { firstName, lastName }, email: 'x' })

test('Apple first-login name is read in Hungarian order (family name first)', () => {
  assert.equal(parseAppleUserName(appleUser('Gergely', 'Kovács')), 'Kovács Gergely')
  assert.equal(parseAppleUserName(appleUser(' Anna ', '')), 'Anna')
  assert.equal(parseAppleUserName(appleUser('A'.repeat(80), 'B'.repeat(80))).length, 100)
})

for (const [description, raw] of [
  ['missing field', null],
  ['non-string field', { name: 'x' }],
  ['invalid JSON', '{not json'],
  ['JSON null', 'null'],
  ['no name object', JSON.stringify({ email: 'x' })],
  ['non-string name parts', JSON.stringify({ name: { firstName: 1, lastName: {} } })],
  ['blank name parts', appleUser('  ', '')],
]) {
  test(`Apple name parsing ignores ${description}`, () => {
    assert.equal(parseAppleUserName(raw), null)
  })
}

test('the name is read from the form_post body without consuming it for NextAuth', async () => {
  const body = new URLSearchParams({ code: 'c', user: appleUser('Gergely', 'Kovács') })
  const req = new Request('https://kajai.hu/api/auth/callback/apple', { method: 'POST', body })
  assert.equal(await appleUserNameFromCallback(req), 'Kovács Gergely')
  assert.equal(new URLSearchParams(await req.text()).get('code'), 'c')
  const json = new Request('https://kajai.hu/x', { method: 'POST', body: '{}' })
  assert.equal(await appleUserNameFromCallback(json), null)
})

test('only the Apple callback POST exposes the name to the NextAuth handler', async () => {
  const seen = []
  const route = loadSource('app/api/auth/[...nextauth]/route.ts', {
    'next-auth': {
      __esModule: true,
      default: () => async () => {
        seen.push(appleFirstLoginName.getStore())
        return new Response(null)
      },
    },
    '@/lib/auth': { getAuthOptions: async () => ({}) },
    '@/lib/apple-signin': appleSignin,
  })
  const post = (segments) =>
    route.POST(
      new Request('https://kajai.hu/api/auth/x', {
        method: 'POST',
        body: new URLSearchParams({ user: appleUser('Gergely', 'Kovács') }),
      }),
      { params: Promise.resolve({ nextauth: segments }) },
    )
  await post(['callback', 'apple'])
  await post(['callback', 'credentials'])
  assert.deepEqual(seen, ['Kovács Gergely', null])
  assert.equal(appleFirstLoginName.getStore(), undefined)
})

async function appleProvider() {
  const options = await getAuthOptions()
  return options.providers.find((provider) => provider.id === 'apple')
}

test('Apple profile uses the first-login name, or none on later logins', async () => {
  const provider = await appleProvider()
  const claims = { sub: 'apple-sub', email: 'anna@privaterelay.appleid.com' }
  const first = await appleFirstLoginName.run('Kovács Anna', () => provider.options.profile(claims))
  assert.deepEqual(first, {
    id: 'apple-sub',
    name: 'Kovács Anna',
    email: 'anna@privaterelay.appleid.com',
    image: null,
  })
  assert.equal(provider.options.profile(claims).name, null)
})

test('Apple provider is disabled without credentials', async () => {
  const saved = process.env.APPLE_ID
  delete process.env.APPLE_ID
  try {
    assert.equal(await appleProvider(), undefined)
  } finally {
    process.env.APPLE_ID = saved
  }
})

test('on HTTPS the PKCE cookie survives Apple\'s cross-site form_post', async () => {
  const { cookies } = await withEnv('https://kajai.hu', getAuthOptions)
  assert.deepEqual(cookies.pkceCodeVerifier, {
    name: '__Secure-next-auth.pkce.code_verifier',
    options: { httpOnly: true, sameSite: 'none', path: '/', secure: true, maxAge: 900 },
  })
  assert.equal(cookies.sessionToken.options.sameSite, 'lax')
})

test('on plain HTTP the PKCE cookie stays SameSite=Lax (None requires Secure)', async () => {
  const { cookies } = await withEnv('http://localhost:4000', getAuthOptions)
  assert.equal(cookies.pkceCodeVerifier.name, 'next-auth.pkce.code_verifier')
  assert.equal(cookies.pkceCodeVerifier.options.sameSite, 'lax')
  assert.equal(cookies.pkceCodeVerifier.options.secure, false)
})

async function signIn(provider, profile) {
  const { callbacks } = await getAuthOptions()
  return callbacks.jwt({ token: {}, user: profile, account: { provider, type: 'oauth' } })
}

test('first Apple login saves the name; later logins without a name keep it', async () => {
  users.clear()
  const email = 'kovacs.anna@example.com'
  const first = await signIn('apple', { id: 's', email, name: 'Kovács Anna', image: null })
  const later = await signIn('apple', { id: 's', email, name: null, image: null })
  assert.equal(first.userId, later.userId)
  assert.equal(users.get(email).name, 'Kovács Anna')
})

test('Apple login with the email of a Google account links to the same user', async () => {
  users.clear()
  const email = 'gergely@example.com'
  const google = await signIn('google', { id: 'g', email, name: 'Kovács Gergely', image: 'img' })
  const apple = await signIn('apple', { id: 'a', email, name: null, image: null })
  assert.equal(apple.userId, google.userId)
  assert.equal(users.size, 1)
  assert.equal(users.get(email).name, 'Kovács Gergely')
})

test('"Hide My Email" relay address registers and logs in as its own user', async () => {
  users.clear()
  const email = 'x7k2abc@privaterelay.appleid.com'
  const first = await signIn('apple', { id: 'a', email, name: 'Kovács Anna', image: null })
  const again = await signIn('apple', { id: 'a', email, name: null, image: null })
  assert.ok(first.userId)
  assert.equal(again.userId, first.userId)
  assert.equal(upserts.at(-1).where.email, email)
})

function renderLogin(error) {
  const LoginPage = loadSource('app/(auth)/login/page.tsx', {
    'next-auth/react': { signIn: () => {}, useSession: () => ({ status: 'unauthenticated' }) },
    'next/navigation': { useSearchParams: () => new URLSearchParams(error ? { error } : {}) },
    '@/components/auth/LoginModal': { __esModule: true, default: () => null },
    '@/components/auth/RegisterModal': { __esModule: true, default: () => null },
    '@/components/layout/Header': { __esModule: true, default: () => null },
  }).default
  return renderToStaticMarkup(React.createElement(LoginPage))
}

test('failed OAuth callback shows an understandable Hungarian error', () => {
  assert.ok(renderLogin('OAuthCallback').includes('A külső fiókos bejelentkezés nem sikerült.'))
  assert.ok(renderLogin('SomethingNew').includes('Sikertelen bejelentkezés.'))
  assert.ok(!renderLogin(null).includes('role="alert"'))
})
