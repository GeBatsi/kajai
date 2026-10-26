const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Load the real components/callbacks while replacing routing and database I/O.
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

const permissions = loadSource('lib/food-permissions.ts')
let dbRole = 'USER'
let dbError
let databaseReads = 0
const { getAuthOptions } = loadSource('lib/auth.ts', {
  './prisma': {
    prisma: {
      user: {
        findUnique: async (query) => {
          databaseReads++
          assert.deepEqual(query, { where: { id: 'test-user' }, select: { role: true } })
          if (dbError) throw dbError
          return dbRole === null ? null : { role: dbRole }
        },
      },
    },
  },
})
let uiSession
const HomePage = loadSource('app/page.tsx', {
  'next-auth/react': {
    useSession: () => ({
      data: uiSession,
      status: uiSession ? 'authenticated' : 'unauthenticated',
    }),
  },
  'next/navigation': { useRouter: () => ({ replace: () => {} }) },
  'next/link': {
    __esModule: true,
    default: ({ href, children, ...props }) =>
      React.createElement('a', { href, ...props }, children),
  },
  '@/components/layout/Header': { __esModule: true, default: () => null },
  '@/lib/food-permissions': permissions,
}).default

let token = { userId: 'test-user', role: 'ADMIN' }
let signedIn = true
const sessionForToken = async (options) =>
  options.callbacks.session({
    token,
    session: {
      user: { name: 'Teszt felhasználó', email: 'test@example.com', image: null },
      expires: '2099-01-01T00:00:00Z',
    },
  })
const FoodLayout = loadSource('app/moderator/foods/layout.tsx', {
  'next-auth': {
    getServerSession: async (options) => (signedIn ? sessionForToken(options) : null),
  },
  'next/navigation': {
    redirect: (destination) => {
      throw Object.assign(new Error('Redirect'), { destination })
    },
  },
  '@/lib/auth': { getAuthOptions },
  '@/lib/food-permissions': permissions,
}).default

function assertButtons(visible) {
  const html = renderToStaticMarkup(React.createElement(HomePage))
  assert.equal(html.includes('href="/moderator/foods/new"'), visible)
  assert.equal(html.includes('href="/moderator/foods/edit"'), visible)
}

for (const role of ['ADMIN', 'MODERATOR', 'USER', 'GUEST', undefined, 'UNKNOWN', 'admin']) {
  test(`home page buttons for ${role}`, () => {
    uiSession = { user: { id: 'test-user', name: 'Test', email: 'test@example.com', role } }
    assertButtons(role === 'ADMIN' || role === 'MODERATOR')
  })
}

test('unauthenticated home has no management buttons', () => {
  uiSession = null
  assertButtons(false)
})

for (const role of ['ADMIN', 'MODERATOR', 'USER', 'GUEST', null]) {
  test(`food route layout uses current database role ${role}`, async () => {
    signedIn = true
    token = { userId: 'test-user', role: 'ADMIN' }
    dbRole = role
    const children = React.createElement('form', { id: 'protected-form' })
    if (role === 'ADMIN' || role === 'MODERATOR') {
      const result = await FoodLayout({ children })
      assert.ok(renderToStaticMarkup(result).includes('protected-form'))
    } else {
      await assert.rejects(FoodLayout({ children }), (error) => error.destination === '/')
    }
  })
}

test('direct food page access without a session redirects to login', async () => {
  signedIn = false
  await assert.rejects(
    FoodLayout({ children: 'editor' }),
    (error) => error.destination === '/login',
  )
  signedIn = true
})

test('role downgrade updates the UI and denies page access with the same old ADMIN token', async () => {
  dbRole = 'ADMIN'
  token = { userId: 'test-user', role: 'ADMIN' }
  const options = await getAuthOptions()
  uiSession = await sessionForToken(options)
  assertButtons(true)
  dbRole = 'USER'
  uiSession = await sessionForToken(options)
  assertButtons(false)
  await assert.rejects(FoodLayout({ children: 'editor' }), (error) => error.destination === '/')
})

test('promotion makes management available without requiring a new login', async () => {
  dbRole = 'MODERATOR'
  token = { userId: 'test-user', role: 'USER' }
  uiSession = await sessionForToken(await getAuthOptions())
  assertButtons(true)
  assert.ok(await FoodLayout({ children: 'editor' }))
})

test('missing session identity never falls back to the token role', async () => {
  token = { role: 'ADMIN' }
  const before = databaseReads
  uiSession = await sessionForToken(await getAuthOptions())
  assertButtons(false)
  await assert.rejects(
    FoodLayout({ children: 'editor' }),
    (error) => error.destination === '/login',
  )
  assert.equal(databaseReads, before)
})

test('database failure cannot fall back to an old ADMIN role', async () => {
  token = { userId: 'test-user', role: 'ADMIN' }
  dbError = new Error('Database unavailable')
  try {
    await assert.rejects(FoodLayout({ children: 'editor' }), (error) => error === dbError)
  } finally {
    dbError = undefined
  }
})
