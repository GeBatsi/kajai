/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node/TypeScript frontend test infrastructure. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relative)
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const original = loaded.require.bind(loaded)
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : original(name)
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename)
  return loaded.exports
}
const nutrition = load('lib/correction-nutrition.ts')
const foodPermissions = load('lib/food-permissions.ts')
const adminPermissions = load('lib/admin-permissions.ts')
const navigation = load('lib/recipe-book-navigation.ts', { './correction-nutrition': nutrition, './food-permissions': foodPermissions })
const makeUser = (role, extra = {}) => ({ id: 'qa-actor', role, name: 'QA', ...extra })
const userLinks = ['/nutrition-corrections/new', '/nutrition-corrections/mine']
const managementLinks = ['/moderator/nutrition-corrections', '/moderator/foods/new', '/moderator/foods/edit']
const link = { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
const Card = ({ children, ...props }) => React.createElement('div', props, children)
const ui = { Card, Button: ({ children, variant: _variant, size: _size, ...props }) => React.createElement('button', props, children) }
const hrefs = html => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
let current, status, pathname = '/recipe-book'
const session = { useSession: () => ({ data: current ? { user: current } : null, status }), signOut: async () => {} }
const Header = load('components/layout/Header.tsx', {
  'next-auth/react': session, 'next/navigation': { usePathname: () => pathname }, 'next/link': link,
  'next/image': { __esModule: true, default: () => null }, '@/lib/admin-permissions': adminPermissions, '@/lib/recipe-book-navigation': navigation,
}).default
const Dashboard = load('components/recipe-book/recipe-book-dashboard.tsx', {
  'next-auth/react': session, 'next/link': link, '@kajai/ui': ui, '@/lib/recipe-book-navigation': navigation,
  '@/components/layout/Header': { __esModule: true, default: () => null },
  '@tanstack/react-query': { useQuery: () => { throw Error('The navigation dashboard must not fetch private API data') } },
}).RecipeBookDashboard
const html = Component => renderToStaticMarkup(React.createElement(Component, { onLoginClick: () => {} }))

for (const [role, expected] of [['USER', userLinks], ['MODERATOR', [...userLinks, ...managementLinks]], ['ADMIN', [...userLinks, ...managementLinks]]]) {
  test(`${role} has exactly the expected recipe-book cards and groups`, () => {
    current = makeUser(role); status = 'authenticated'
    const sections = navigation.recipeBookSections(current)
    assert.deepEqual(sections.flatMap(section => section.items.map(item => item.href)), expected)
    const rendered = html(Dashboard)
    assert.deepEqual(hrefs(rendered), expected)
    assert.equal(rendered.includes('Alapanyagkezelés'), role !== 'USER')
    assert.equal(rendered.includes('Javaslatok moderálása'), role !== 'USER')
    assert.ok(rendered.includes('<h1 class="font-heading text-3xl sm:text-4xl">Receptkönyv</h1>'))
    assert.ok(!rendered.includes('/admin'))
  })
  test(`${role} Header contains only the allowed top-level navigation in the required order`, () => {
    current = makeUser(role); status = 'authenticated'
    const rendered = html(Header)
    assert.deepEqual(hrefs(rendered), role === 'ADMIN' ? ['/', '/admin', '/recipe-book'] : ['/', '/recipe-book'])
    assert.ok(rendered.includes('Kijelentkezés'))
    assert.ok(rendered.indexOf('Receptkönyv') < rendered.indexOf('Kijelentkezés'))
    if (role === 'ADMIN') assert.ok(rendered.indexOf('Admin Dashboard') < rendered.indexOf('Receptkönyv'))
    assert.ok(!rendered.includes('Javaslatok moderálása'))
  })
}

for (const [name, user, state] of [
  ['anonymous', null, 'unauthenticated'], ['GUEST', makeUser('GUEST'), 'authenticated'],
  ['banned USER', makeUser('USER', { isBanned: true }), 'authenticated'],
  ['banned MODERATOR', makeUser('MODERATOR', { isBanned: true }), 'authenticated'],
  ['banned ADMIN', makeUser('ADMIN', { isBanned: true }), 'authenticated'],
  ['unknown role', makeUser('UNKNOWN'), 'authenticated'], ['missing identity', makeUser('ADMIN', { id: ' ' }), 'authenticated'],
  ['loading with cached ADMIN', makeUser('ADMIN'), 'loading'],
]) {
  test(`${name} receives neither dashboard cards nor protected Header navigation`, () => {
    current = user; status = state
    const header = html(Header), dashboard = html(Dashboard)
    assert.ok(!hrefs(header).includes('/recipe-book'))
    assert.ok(!hrefs(header).includes('/admin'))
    assert.deepEqual(hrefs(dashboard), state === 'loading' ? [] : ['/login'])
    assert.ok(!dashboard.includes('Alapanyagkezelés'))
    assert.ok(!dashboard.includes('Javaslatok moderálása'))
    if (state === 'loading') assert.ok(dashboard.includes('Jogosultság ellenőrzése…'))
    if (state !== 'loading') assert.deepEqual(navigation.recipeBookSections(user), [])
  })
}

test('a live session downgrade, promotion, ban and logout immediately update rendered navigation', () => {
  status = 'authenticated'
  for (const [role, banned, count] of [['ADMIN', false, 5], ['USER', false, 2], ['MODERATOR', false, 5], ['MODERATOR', true, 0]]) {
    current = makeUser(role, { isBanned: banned })
    const links = hrefs(html(Dashboard)).filter(href => href !== '/login')
    assert.equal(links.length, count)
    assert.equal(hrefs(html(Header)).includes('/admin'), role === 'ADMIN' && !banned)
  }
  current = null; status = 'unauthenticated'
  assert.deepEqual(hrefs(html(Dashboard)), ['/login'])
})

for (const [route, active] of [
  ['/recipe-book', '/recipe-book'], ['/nutrition-corrections/mine', '/recipe-book'],
  ['/moderator/nutrition-corrections/qa-id', '/recipe-book'], ['/moderator/foods/qa-id/edit', '/recipe-book'],
  ['/admin/users', '/admin'], ['/', null], ['/recipe-book-other', null],
]) test(`Header marks the active section for ${route}`, () => {
  pathname = route; current = makeUser('ADMIN'); status = 'authenticated'
  const rendered = html(Header)
  const activeLinks = [...rendered.matchAll(/<a[^>]*href="([^"]+)"[^>]*aria-current="(?:page|location)"/g)].map(match => match[1])
  assert.deepEqual(activeLinks, active ? [active] : [])
  if (active) assert.ok(rendered.includes('bg-accent text-accent-foreground'))
})

test('cards are entire native links with headings, descriptions and decorative icons', () => {
  current = makeUser('MODERATOR'); status = 'authenticated'
  const rendered = html(Dashboard)
  assert.equal((rendered.match(/aria-labelledby="recipe-book-[^"]+-title"/g) || []).length, 5)
  assert.equal((rendered.match(/aria-describedby="recipe-book-[^"]+-description"/g) || []).length, 5)
  assert.equal((rendered.match(/<svg /g) || []).length, 5)
  assert.ok(rendered.includes('aria-hidden="true"'))
  assert.ok(rendered.includes('focus-visible:outline-ring'))
  assert.ok(!rendered.includes('<button'))
})

let serverUser, serverError
const guard = load('lib/correction-route.ts', {
  'next-auth': { getServerSession: async () => { if (serverError) throw serverError; return serverUser ? { user: serverUser } : null } },
  'next/navigation': { redirect: destination => { throw Object.assign(Error('redirect'), { destination }) } },
  './auth': { getAuthOptions: async () => ({}) }, './correction-nutrition': nutrition,
})
const Layout = load('app/recipe-book/layout.tsx', { '@/lib/correction-route': guard }).default
for (const [name, user, destination] of [
  ['anonymous', null, '/login'], ['GUEST', makeUser('GUEST'), '/'], ['banned', makeUser('ADMIN', { isBanned: true }), '/login'],
  ['missing identity', makeUser('USER', { id: '' }), '/login'], ['unknown', makeUser('UNKNOWN'), '/'],
  ['USER', makeUser('USER'), null], ['MODERATOR', makeUser('MODERATOR'), null], ['ADMIN', makeUser('ADMIN'), null],
]) test(`direct recipe-book server route: ${name}`, async () => {
  serverUser = user
  if (destination) await assert.rejects(Layout({ children: 'private dashboard' }), error => error.destination === destination)
  else assert.ok(renderToStaticMarkup(await Layout({ children: 'private dashboard' })).includes('private dashboard'))
})
test('server route rechecks changed session state and fails closed on an auth/database error', async () => {
  serverUser = makeUser('MODERATOR'); assert.ok(await Layout({ children: 'allowed' }))
  serverUser = makeUser('GUEST'); await assert.rejects(Layout({ children: 'denied' }))
  serverError = Error('Auth/database unavailable')
  try { await assert.rejects(Layout({ children: 'denied' }), error => error === serverError) } finally { serverError = null }
})
test('recipe-book page renders the protected client dashboard', () => {
  const Page = load('app/recipe-book/page.tsx', { '@/components/recipe-book/recipe-book-dashboard': { RecipeBookDashboard: Dashboard } }).default
  assert.equal(Page().type, Dashboard)
})

test('AdminShell navigation only administers users, keeping the existing links', () => {
  const Shell = load('components/admin/admin-shell.tsx', {
    react: { ...React, useEffect: () => {} }, 'next/link': link, '@kajai/ui': ui,
    '@tanstack/react-query': { useQueryClient: () => ({}) }, '@/lib/admin-users-api': {},
    '@/components/layout/Header': { __esModule: true, default: () => null },
    './admin-shared': { useAdminSession: () => ({ allowed: true, actorId: 'admin', status: 'authenticated' }), AccessState: () => null },
  }).AdminShell
  const rendered = renderToStaticMarkup(React.createElement(Shell, null, 'user management'))
  assert.deepEqual(hrefs(rendered), ['/admin/users', '/'])
  assert.ok(!rendered.includes('Javaslatok moderálása'))
  assert.ok(rendered.includes('user management'))
})
test('admin root still redirects to the existing user list', () => {
  const Admin = load('app/admin/page.tsx', { 'next/navigation': { redirect: destination => { throw Object.assign(Error('redirect'), { destination }) } } }).default
  assert.throws(() => Admin(), error => error.destination === '/admin/users')
})
test('CorrectionShell replaces the duplicate menu with one recipe-book back link', () => {
  const shared = load('components/nutrition-corrections/shared.tsx', {
    'next-auth/react': { useSession: () => ({ data: { user: makeUser('MODERATOR') }, status: 'authenticated' }) },
    '@tanstack/react-query': {}, '@kajai/ui': ui, 'next/link': link,
    '@/components/layout/Header': { __esModule: true, default: () => null }, '@/lib/correction-nutrition': nutrition,
    '@/lib/nutrition-corrections-api': {},
  })
  const rendered = renderToStaticMarkup(React.createElement(shared.CorrectionShell, { moderator: true }, 'unchanged form'))
  assert.deepEqual(hrefs(rendered), ['/recipe-book'])
  assert.ok(rendered.includes('← Vissza a Receptkönyvbe'))
  assert.ok(rendered.includes('unchanged form'))
})
test('food create returns to recipe book without changing the form or API base', () => {
  let props
  const Form = input => { props = input; return null }
  const Page = load('app/moderator/foods/new/page.tsx', { '@/components/foods/food-form': { __esModule: true, default: Form } }).default
  renderToStaticMarkup(React.createElement(Page))
  assert.equal(props.backHref, '/recipe-book')
  assert.equal(props.title, 'Alapanyag létrehozása')
  assert.ok(props.apiBaseUrl)
})
test('food picker returns to recipe book; a concrete editor still returns to the picker', () => {
  const react = { ...React, useState: value => [value, () => {}], useEffect: () => {} }
  const dependencies = { react, 'next/link': link, './food-api': {}, './food-form': { __esModule: true, default: () => null } }
  const Picker = load('components/foods/food-picker.tsx', dependencies).default
  const Editor = load('components/foods/food-editor.tsx', dependencies).default
  const picker = renderToStaticMarkup(React.createElement(Picker, { apiBaseUrl: 'http://fixture.invalid' }))
  const editor = renderToStaticMarkup(React.createElement(Editor, { apiBaseUrl: 'http://fixture.invalid', foodId: 'qa-id' }))
  assert.equal(hrefs(picker)[0], '/recipe-book')
  assert.equal(hrefs(editor)[0], '/moderator/foods/edit')
})
