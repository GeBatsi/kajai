/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness for the existing TypeScript compiler. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

const signOutCalls = []
const filename = path.resolve(__dirname, '../src/components/layout/Header.tsx')
const loaded = new Module(filename, module)
loaded.filename = filename
loaded.paths = Module._nodeModulePaths(path.dirname(filename))
const overrides = {
  'next-auth/react': {
    useSession: () => ({ data: { user: { name: 'Teszt' } }, status: 'authenticated' }),
    signOut: async (options) => signOutCalls.push(options),
  },
  'next/image': { __esModule: true, default: () => null },
}
const originalRequire = loaded.require.bind(loaded)
loaded.require = (name) => (Object.hasOwn(overrides, name) ? overrides[name] : originalRequire(name))
loaded._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText,
  filename,
)
const Header = loaded.exports.default

// Header has no own hooks besides the mocked useSession, so it can be called directly.
function logoutButton() {
  const found = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'button') found.push(node)
    walk(node.props?.children)
  }
  walk(Header({ onLoginClick: () => {} }))
  return found.find((button) => button.props.children === 'kijentkezés')
}

test('logout signs out of NextAuth even when the API is unreachable', async () => {
  const realFetch = global.fetch
  let apiCalls = 0
  global.fetch = async () => {
    apiCalls++
    throw new TypeError('Failed to fetch')
  }
  try {
    await logoutButton().props.onClick()
  } finally {
    global.fetch = realFetch
  }
  assert.deepEqual(signOutCalls, [{ callbackUrl: '/login' }])
  assert.equal(apiCalls, 0)
})
