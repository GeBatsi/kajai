/* eslint-disable @typescript-eslint/no-require-imports -- Matches the repository's Node/TypeScript test harness. */
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
  loaded.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : original(name)
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename)
  return loaded.exports
}
const permissions = load('lib/admin-permissions.ts')
const baseApi = load('lib/api.ts')
const apiModule = load('lib/admin-users-api.ts', { './api': baseApi })
const user = { id: 'target', email: 'target@example.com', name: 'Teszt Elek', image: null, role: 'USER', bannedAt: null, banReason: null, isVerified: false, createdAt: '2026-11-18T12:00:00Z', updatedAt: '2026-11-18T12:00:00Z' }
const session = (role = 'ADMIN', isBanned = false) => ({ user: { id: 'actor', name: 'Admin', email: 'admin@example.com', role, isBanned } })
const failure = (status, message) => ({ isAxiosError: true, response: { status, data: message ? { message } : {} } })
const flush = () => new Promise((resolve) => setImmediate(resolve))
const link = { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
const ui = Object.fromEntries(['Button', 'Card', 'Input', 'Select', 'Textarea', 'Label', 'Badge', 'Dialog', 'DialogContent', 'DialogHeader', 'DialogFooter', 'DialogTitle', 'DialogDescription'].map((name) => {
  const tag = { Button: 'button', Input: 'input', Select: 'select', Textarea: 'textarea', Label: 'label', Badge: 'span', DialogTitle: 'h2', DialogDescription: 'p' }[name] || 'div'
  const component = ({ children, ...props }) => {
    const safe = Object.fromEntries(Object.entries(props).filter(([key]) => !['variant', 'size', 'asChild', 'open', 'onOpenChange', 'onCloseAutoFocus', 'onEscapeKeyDown', 'onPointerDownOutside', 'returnFocus'].includes(key)))
    return React.createElement(tag, safe, children)
  }
  component.displayName = name
  return [name, component]
}))

// A small controlled hook host lets Node exercise the real component handlers.
// React Query, routing and I/O are doubles here; browser QA uses the real hooks/UI.
function hooks() {
  let index = 0
  const slots = []
  let effects = []
  return {
    react: { ...React,
      useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
      useRef(initial) { const i = index++; return slots[i] ?? (slots[i] = { current: initial }) },
      useEffect(fn, deps) { const i = index++; const old = slots[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) { old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn() }) } },
    },
    render(component, props) { index = 0; effects = []; const result = component(props); effects.forEach((fn) => fn()); return result },
    dispose() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}
function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); return }
  if (!React.isValidElement(node)) return
  yield node
  yield* elements(node.props.children)
  if (node.props.action) yield* elements(node.props.action)
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ')
  if (React.isValidElement(node)) return text(node.props.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
const find = (tree, predicate) => { const result = [...elements(tree)].find(predicate); assert.ok(result, 'Expected element not found'); return result }
const field = (tree, id) => find(tree, (e) => e.props.id === id)
const button = (tree, label) => find(tree, (e) => e.type === ui.Button && text(e) === label)
const change = (element, value) => element.props.onChange({ target: { value } })

for (const role of ['ADMIN', 'USER', 'MODERATOR', 'GUEST', 'UNKNOWN', undefined]) {
  test(`admin permission ${role}`, () => assert.equal(permissions.canAccessAdmin({ id: 'actor', role }), role === 'ADMIN'))
}
test('missing identity and banned ADMIN are denied', () => {
  assert.equal(permissions.canAccessAdmin(null), false)
  assert.equal(permissions.canAccessAdmin({ id: ' ', role: 'ADMIN' }), false)
  assert.equal(permissions.canAccessAdmin(session('ADMIN', true).user), false)
})

test('server layout reads the real session callback DB state and fails closed', async () => {
  let dbRole = 'ADMIN'
  let bannedAt = null
  let signedIn = true
  let dbError = false
  const auth = load('lib/auth.ts', { 
    './apple-signin': load('lib/apple-signin.ts'),
    './prisma': { prisma: { user: { findUnique: async () => { if (dbError) throw new Error('DB unavailable'); return { role: dbRole, bannedAt } } } } } })
  const layout = load('app/admin/layout.tsx', {
    'next-auth': { getServerSession: async (options) => signedIn ? options.callbacks.session({ session: session(), token: { userId: 'actor', role: 'ADMIN' } }) : null },
    'next/navigation': { redirect: (destination) => { throw Object.assign(new Error('Redirect'), { destination }) } },
    '@/lib/auth': auth, '@/lib/admin-permissions': permissions,
    '@/components/admin/admin-shell': { AdminShell: ({ children }) => children },
  }).default
  assert.ok(await layout({ children: 'Protected' }))
  for (const role of ['USER', 'MODERATOR', 'GUEST']) {
    dbRole = role
    await assert.rejects(layout({ children: 'Protected' }), (e) => e.destination === '/')
  }
  dbRole = 'ADMIN'; bannedAt = new Date()
  await assert.rejects(layout({ children: 'Protected' }), (e) => e.destination === '/login')
  bannedAt = null; signedIn = false
  await assert.rejects(layout({ children: 'Protected' }), (e) => e.destination === '/login')
  signedIn = true; dbError = true
  await assert.rejects(layout({ children: 'Protected' }), /DB unavailable/)
})

test('Header admin navigation is exclusive and logout uses NextAuth', async () => {
  let current = session()
  const calls = []
  const Header = load('components/layout/Header.tsx', {
    'next-auth/react': { useSession: () => ({ data: current, status: current ? 'authenticated' : 'unauthenticated' }), signOut: async (options) => calls.push(options) },
    'next/navigation': { usePathname: () => '/admin/users' },
    '@/lib/recipe-book-navigation': load('lib/recipe-book-navigation.ts', { './correction-nutrition': load('lib/correction-nutrition.ts'), './food-permissions': load('lib/food-permissions.ts') }),
    'next/link': link, 'next/image': { __esModule: true, default: () => null }, '@/lib/admin-permissions': permissions,
  }).default
  for (const [role, banned] of [['ADMIN', false], ['USER', false], ['MODERATOR', false], ['ADMIN', true]]) {
    current = session(role, banned)
    const html = renderToStaticMarkup(React.createElement(Header, { onLoginClick: () => {} }))
    assert.equal(html.includes('href="/admin"'), role === 'ADMIN' && !banned)
  }
  current = null
  assert.ok(!renderToStaticMarkup(React.createElement(Header, { onLoginClick: () => {} })).includes('href="/admin"'))
  current = session()
  const original = global.fetch
  let apiCalls = 0
  global.fetch = async () => { apiCalls++; throw new TypeError('Failed to fetch') }
  try { await find(Header({ onLoginClick: () => {} }), (e) => e.type === 'button' && text(e) === 'Kijelentkezés').props.onClick() }
  finally { global.fetch = original }
  assert.deepEqual(calls, [{ callbackUrl: '/login' }])
  assert.equal(apiCalls, 0)
})

test('an admin without nutrition targets bypasses onboarding; USER keeps the existing flow', () => {
  let current = session()
  const redirects = []
  const Home = load('app/page.tsx', {
    react: { ...React, useEffect: (fn) => fn() }, 'next-auth/react': { useSession: () => ({ data: current, status: 'authenticated' }) },
    'next/navigation': { useRouter: () => ({ replace: (url) => redirects.push(url) }) },
    '@tanstack/react-query': { useQuery: () => ({ data: { dailyKcal: null }, isLoading: false }) },
    'next/link': link, 'next/image': { __esModule: true, default: () => null },
    '@/lib/api': baseApi, '@/lib/admin-permissions': permissions, '@/lib/food-permissions': load('lib/food-permissions.ts'),
    '@/components/layout/Header': { __esModule: true, default: () => null },
    '@/components/profile/calorie-progress-bar': { CalorieProgressBar: () => null }, '@/components/profile/macro-donut-chart': { MacroDonutChart: () => null },
  }).default
  assert.ok(Home()); assert.deepEqual(redirects, [])
  current = session('USER'); assert.equal(Home(), null); assert.deepEqual(redirects, ['/onboarding'])
})

test('API transport exactly matches backend routes/payloads and always uses cookies', async () => {
  const calls = []
  baseApi.apiClient.defaults.adapter = async (config) => { calls.push(config); return { data: user, status: 200, statusText: 'OK', headers: {}, config } }
  const api = apiModule.adminUsersApi
  await api.list({ search: 'name', role: 'MODERATOR', status: 'active', page: 2, limit: 50 })
  await api.detail('a/b')
  await api.create({ email: user.email, name: 'Name', role: 'ADMIN', password: 'Password123', actorId: 'forged', isVerified: true })
  await api.edit('target', { name: null, image: null, role: 'ADMIN', password: 'bad' })
  await api.role('target', 'MODERATOR'); await api.ban('target', '  Reason  '); await api.unban('target'); await api.remove('target')
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [['get', '/users'], ['get', '/users/a%2Fb'], ['post', '/users'], ['patch', '/users/target'], ['patch', '/users/target/role'], ['post', '/users/target/ban'], ['post', '/users/target/unban'], ['delete', '/users/target']])
  assert.deepEqual(calls[0].params, { page: 2, limit: 50, search: 'name', role: 'MODERATOR', status: 'active' })
  assert.deepEqual(JSON.parse(calls[2].data), { email: user.email, role: 'ADMIN', name: 'Name', password: 'Password123' })
  assert.deepEqual(JSON.parse(calls[3].data), { name: null, image: null })
  assert.deepEqual(JSON.parse(calls[5].data), { reason: 'Reason' })
  assert.deepEqual(JSON.parse(calls[6].data), {})
  for (const call of calls) { assert.equal(call.withCredentials, true); assert.ok(!call.headers.get('x-user-role')); assert.ok(!call.headers.get('x-user-id')) }
})
for (const status of [400, 401, 403, 404, 409, 500]) {
  test(`API error ${status} produces a useful message`, () => assert.ok(apiModule.adminErrorMessage(failure(status)).length > 15))
}
test('backend validation arrays and recipe conflicts remain visible', () => {
  assert.equal(apiModule.adminErrorMessage(failure(400, ['Hibás név.', 'Hibás kép.'])), 'Hibás név. Hibás kép.')
  assert.equal(apiModule.adminErrorMessage(failure(409, 'Más felhasználó receptje hivatkozik rá.')), 'Más felhasználó receptje hivatkozik rá.')
})

test('real action hook prevents duplicate submission, denies unauthorized state and never retries conflicts', async () => {
  const h = hooks(); let current = session(); let updateCalls = 0; let starts = 0
  const mutation = { isPending: false, error: null, reset() { this.error = null }, async mutateAsync(fn) { starts++; try { return await fn() } catch (e) { this.error = e; throw e } } }
  const shared = load('components/admin/admin-shared.tsx', { react: h.react, '@kajai/ui': ui, 'next/link': link,
    'next-auth/react': { useSession: () => ({ data: current, status: 'authenticated', update: async () => { updateCalls++ } }) },
    '@tanstack/react-query': { useMutation: (options) => { assert.equal(options.retry, false); return mutation } }, '@/lib/admin-permissions': permissions, '@/lib/admin-users-api': apiModule,
  })
  let action = h.render(shared.useAdminAction)
  let release
  const first = action.run(() => new Promise((resolve) => { release = resolve }))
  assert.equal(await action.run(async () => {}), false); assert.equal(starts, 1)
  release(); assert.equal(await first, true)
  assert.equal(await action.run(async () => { throw failure(409) }), false); assert.equal(starts, 2); assert.equal(updateCalls, 0)
  action = h.render(shared.useAdminAction); assert.equal(action.error.response.status, 409)
  await action.run(async () => { throw failure(403) }); assert.equal(updateCalls, 1)
  current = session('USER'); action = h.render(shared.useAdminAction)
  assert.equal(await action.run(async () => {}), false); assert.equal(starts, 3)
})

function view(overrides = {}) {
  const h = hooks(); const records = []; const notices = []; const routes = []; let current = session(); let queryState
  const cache = { invalidateQueries: async (key) => records.push(['invalidate', key]), removeQueries: (key) => records.push(['remove', key]), setQueryData: (key, data) => records.push(['set', key, typeof data === 'function' ? data(user) : data]) }
  const mutation = { pending: false, error: null, reset() { this.error = null }, async run(fn) { try { await fn(); return true } catch (e) { this.error = e; return false } } }
  const simple = (name) => ({ children, error, title, action }) => React.createElement('div', { 'data-state': name }, title, error ? apiModule.adminErrorMessage(error) : children, action)
  const shared = { useAdminSession: () => ({ allowed: permissions.canAccessAdmin(current?.user), actorId: current?.user.id ?? '', status: current ? 'authenticated' : 'unauthenticated' }), useAdminAction: () => mutation,
    AccessState: simple('access'), AdminHeading: simple('heading'), ApiError: simple('error'), LoadingCard: simple('loading'), UserBadges: simple('badges'), formatAdminDate: (value) => value }
  const DialogMarker = () => null
  const api = Object.fromEntries(['detail', 'list', 'create', 'edit', 'role', 'ban', 'unban', 'remove'].map((name) => [name, async (...args) => { records.push([name, ...args]); return { ...user, ...(name === 'role' ? { role: args[1] } : {}), ...(name === 'ban' ? { bannedAt: '2026-11-19T12:00:00Z', banReason: args[1] } : {}) } }]))
  const deps = { react: h.react, '@kajai/ui': ui, 'next/link': link, 'next/navigation': { useRouter: () => ({ replace: (url) => routes.push(url) }) },
    '@tanstack/react-query': { useQueryClient: () => cache, useQuery: (options) => { records.push(['query', options]); const result = queryState ?? { data: { data: [user], meta: { page: options.queryKey.at(-1).page, limit: 20, total: 60, totalPages: 3 } }, isPending: false, isError: false, isFetching: false }; return { ...result, refetch: () => records.push(['refetch']) } } },
    '@/lib/admin-users-api': { ...apiModule, adminUsersApi: api }, './admin-shared': shared, './admin-shell': { useAdminNotice: () => (message) => notices.push(message) }, './user-action-dialog': { UserActionDialog: DialogMarker }, ...overrides }
  return { h, records, notices, routes, api, mutation, deps, DialogMarker, setSession: (s) => { current = s }, setQuery: (q) => { queryState = q }, component: (file, name) => load(`components/admin/${file}.tsx`, deps)[name] }
}

test('list uses explicit paging, server filters, 300ms debounce and page reset', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const v = view(); const List = v.component('admin-users-list', 'AdminUsersList'); let tree = v.h.render(List)
  const filters = () => v.records.filter((r) => r[0] === 'query').at(-1)[1].queryKey.at(-1)
  assert.deepEqual(filters(), { search: '', role: '', status: '', page: 1, limit: 20 })
  button(tree, 'Következő').props.onClick(); tree = v.h.render(List); assert.equal(filters().page, 2)
  change(field(tree, 'users-search'), 'Elek'); v.h.render(List)
  t.mock.timers.tick(299); v.h.render(List); assert.equal(filters().search, '')
  t.mock.timers.tick(1); tree = v.h.render(List); assert.equal(filters().search, 'Elek'); assert.equal(filters().page, 1)
  change(field(tree, 'users-role'), 'MODERATOR'); tree = v.h.render(List); assert.equal(filters().role, 'MODERATOR')
  change(field(tree, 'users-status'), 'banned'); tree = v.h.render(List); assert.equal(filters().status, 'banned')
  change(field(tree, 'users-limit'), '50'); v.h.render(List); assert.equal(filters().limit, 50)
  assert.ok(v.records.filter((r) => r[0] === 'query').every((r) => r[1].retry === false))
  v.h.dispose()
})
for (const [name, state] of [['loading', { isPending: true }], ['empty', { data: { data: [], meta: { page: 1, total: 0, totalPages: 0 } } }], ['error', { isError: true, error: failure(500) }]]) {
  test(`list ${name} state is visible`, () => {
    const v = view(); v.setQuery(state); const html = renderToStaticMarkup(v.h.render(v.component('admin-users-list', 'AdminUsersList')))
    assert.ok(html.includes(name === 'empty' ? 'Még nincs felhasználó' : `data-state="${name}"`)); v.h.dispose()
  })
}
for (const current of [null, session('USER'), session('MODERATOR'), session('ADMIN', true)]) {
  test(`unauthorized list/detail/create cannot start an admin query: ${current?.user.role}`, () => {
    const v = view(); v.setSession(current)
    for (const [file, name, props] of [['admin-users-list', 'AdminUsersList', {}], ['admin-user-detail', 'AdminUserDetail', { id: 'target' }], ['admin-user-create', 'AdminUserCreate', {}]]) {
      const host = hooks(); v.deps.react = host.react
      const tree = host.render(v.component(file, name), props)
      assert.ok(renderToStaticMarkup(tree).includes('data-state="access"')); host.dispose()
    }
    assert.ok(v.records.filter((r) => r[0] === 'query').every((r) => r[1].enabled === false))
    assert.ok(!v.records.some((r) => ['create', 'role', 'ban', 'unban', 'remove'].includes(r[0])))
  })
}

test('role change confirms ADMIN grants, updates actual detail data and invalidates the list', async () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent'); let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'ADMIN'); tree = v.h.render(Detail, { user, actorId: 'actor' })
  button(tree, 'Szerepkör módosítása').props.onClick({ currentTarget: {} }); tree = v.h.render(Detail, { user, actorId: 'actor' })
  const dialog = find(tree, (e) => e.type === v.DialogMarker); assert.equal(dialog.props.role, 'ADMIN')
  await dialog.props.onConfirm('')
  assert.deepEqual(v.records.find((r) => r[0] === 'role'), ['role', user.id, 'ADMIN'])
  assert.equal(v.records.find((r) => r[0] === 'set')[2].role, 'ADMIN')
  assert.ok(v.records.some((r) => r[0] === 'invalidate')); assert.equal(v.notices.length, 1)
  assert.ok(![...elements(v.h.render(Detail, { user, actorId: 'actor' }))].some((e) => e.type === v.DialogMarker))
})
test('role select initializes from each server role and follows refetches without a draft', () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
  for (const role of ['USER', 'MODERATOR', 'ADMIN', 'GUEST', 'USER']) {
    const tree = v.h.render(Detail, { user: { ...user, role }, actorId: 'actor' })
    assert.equal(field(tree, 'user-role').props.value, role === 'GUEST' ? 'USER' : role)
    assert.ok(!text(tree).includes('A szerepkört időközben módosították.'))
  }
  assert.ok(!v.records.some((r) => r[0] === 'role'))
})

test('refetch preserves an unsaved role choice and marks a changed server role as stale', () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
  let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'ADMIN')
  tree = v.h.render(Detail, { user: { ...user, name: 'Frissített név' }, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'ADMIN')
  assert.ok(!text(tree).includes('A szerepkört időközben módosították.'))
  tree = v.h.render(Detail, { user: { ...user, role: 'MODERATOR' }, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'ADMIN')
  const warning = find(tree, (e) => e.props.role === 'alert')
  assert.match(text(warning), /Jelenlegi szerepkör:.*MODERATOR/)
  assert.match(text(warning), /nem mentett választásod:.*ADMIN/)
  assert.ok(!v.records.some((r) => r[0] === 'role'))
})

test('a changed server role invalidates the open confirmation and requires a new one', async () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
  let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'ADMIN'); tree = v.h.render(Detail, { user, actorId: 'actor' })
  button(tree, 'Szerepkör módosítása').props.onClick({ currentTarget: {} })
  tree = v.h.render(Detail, { user, actorId: 'actor' })
  assert.equal(find(tree, (e) => e.type === v.DialogMarker).props.user.role, 'USER')
  const refreshed = { ...user, role: 'MODERATOR' }
  tree = v.h.render(Detail, { user: refreshed, actorId: 'actor' })
  // Even before the effect's closing render, the confirmation handler refuses the stale snapshot.
  await find(tree, (e) => e.type === v.DialogMarker).props.onConfirm('')
  tree = v.h.render(Detail, { user: refreshed, actorId: 'actor' })
  assert.ok(![...elements(tree)].some((e) => e.type === v.DialogMarker))
  assert.equal(field(tree, 'user-role').props.value, 'ADMIN')
  assert.ok(!v.records.some((r) => r[0] === 'role'))
  button(tree, 'Szerepkör módosítása').props.onClick({ currentTarget: {} })
  tree = v.h.render(Detail, { user: refreshed, actorId: 'actor' })
  const dialog = find(tree, (e) => e.type === v.DialogMarker)
  assert.equal(dialog.props.user.role, 'MODERATOR'); assert.equal(dialog.props.role, 'ADMIN')
  await dialog.props.onConfirm('')
  assert.deepEqual(v.records.filter((r) => r[0] === 'role'), [['role', user.id, 'ADMIN']])
})

test('successful role change adopts the actual backend response and subsequent refetches', async () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
  v.api.role = async (id, role) => { v.records.push(['role', id, role]); return { ...user, role: 'MODERATOR' } }
  let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'ADMIN'); tree = v.h.render(Detail, { user, actorId: 'actor' })
  button(tree, 'Szerepkör módosítása').props.onClick({ currentTarget: {} })
  tree = v.h.render(Detail, { user, actorId: 'actor' })
  await find(tree, (e) => e.type === v.DialogMarker).props.onConfirm('')
  const saved = v.records.find((r) => r[0] === 'set')[2]
  tree = v.h.render(Detail, { user: saved, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'MODERATOR')
  assert.equal(find(tree, (e) => e.props.email === saved.email && 'isVerified' in e.props).props.role, saved.role)
  assert.equal(button(tree, 'Szerepkör módosítása').props.disabled, true)
  assert.equal(v.notices.length, 1)
  tree = v.h.render(Detail, { user: { ...saved, role: 'USER' }, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'USER')
})

test('failed role change preserves the draft and dialog without a false success', async () => {
  const v = view(); v.api.role = async () => { throw failure(409, 'A szerepkörmódosítás ütközik.') }
  const Detail = v.component('admin-user-detail', 'UserDetailContent')
  let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'MODERATOR'); tree = v.h.render(Detail, { user, actorId: 'actor' })
  button(tree, 'Szerepkör módosítása').props.onClick({ currentTarget: {} })
  tree = v.h.render(Detail, { user, actorId: 'actor' })
  await find(tree, (e) => e.type === v.DialogMarker).props.onConfirm('')
  tree = v.h.render(Detail, { user: { ...user }, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'MODERATOR')
  assert.equal(find(tree, (e) => e.type === v.DialogMarker).props.error.response.status, 409)
  assert.equal(v.notices.length, 0)
  assert.ok(!v.records.some((r) => ['set', 'invalidate'].includes(r[0])))
})

test('switching target resets the role selection and the detail wrapper keys content by target', () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
  let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'ADMIN')
  tree = v.h.render(Detail, { user: { ...user, id: 'other', role: 'MODERATOR' }, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'MODERATOR')
  assert.equal(button(tree, 'Szerepkör módosítása').props.disabled, true)
  tree = v.h.render(Detail, { user, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'USER')
  const wrapper = view(); wrapper.setQuery({ data: user, isPending: false, isError: false })
  const page = wrapper.h.render(wrapper.component('admin-user-detail', 'AdminUserDetail'), { id: user.id })
  assert.equal(page.key, user.id)
})

test('a fulfilled draft becomes clean and stale choices can be explicitly discarded', () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
  let tree = v.h.render(Detail, { user, actorId: 'actor' })
  change(field(tree, 'user-role'), 'ADMIN')
  tree = v.h.render(Detail, { user: { ...user, role: 'ADMIN' }, actorId: 'actor' })
  assert.equal(button(tree, 'Szerepkör módosítása').props.disabled, true)
  tree = v.h.render(Detail, { user: { ...user, role: 'MODERATOR' }, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'MODERATOR')
  change(field(tree, 'user-role'), 'ADMIN')
  tree = v.h.render(Detail, { user, actorId: 'actor' })
  button(tree, 'Aktuális szerepkör átvétele').props.onClick()
  tree = v.h.render(Detail, { user, actorId: 'actor' })
  assert.equal(field(tree, 'user-role').props.value, 'USER')
  assert.ok(!text(tree).includes('A szerepkört időközben módosították.'))
  assert.equal(button(tree, 'Szerepkör módosítása').props.disabled, true)
})

test('unchanged and self role actions cannot even open a confirmation', () => {
  for (const own of [false, true]) {
    const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent')
    const props = { user, actorId: own ? user.id : 'actor' }
    let tree = v.h.render(Detail, props)
    if (own) { change(field(tree, 'user-role'), 'ADMIN'); tree = v.h.render(Detail, props) }
    button(tree, 'Szerepkör módosítása').props.onClick({ currentTarget: {} })
    tree = v.h.render(Detail, props)
    assert.ok(![...elements(tree)].some((e) => e.type === v.DialogMarker))
    assert.ok(!v.records.some((r) => r[0] === 'role'))
  }
})

test('self-account and unchanged role controls are disabled', () => {
  const v = view(); const Detail = v.component('admin-user-detail', 'UserDetailContent'); const tree = v.h.render(Detail, { user, actorId: user.id })
  for (const label of ['Szerepkör módosítása', 'Felhasználó tiltása', 'Felhasználó törlése']) assert.equal(button(tree, label).props.disabled, true)
  const other = view(); const sameRole = other.h.render(other.component('admin-user-detail', 'UserDetailContent'), { user, actorId: 'actor' })
  assert.equal(button(sameRole, 'Szerepkör módosítása').props.disabled, true)
})
for (const action of ['ban', 'unban', 'delete']) {
  test(`${action} uses the correct API and waits for server success before changing cache`, async () => {
    const v = view(); const target = action === 'unban' ? { ...user, bannedAt: '2026-11-19T00:00:00Z' } : user
    const Detail = v.component('admin-user-detail', 'UserDetailContent'); let tree = v.h.render(Detail, { user: target, actorId: 'actor' })
    button(tree, action === 'delete' ? 'Felhasználó törlése' : action === 'ban' ? 'Felhasználó tiltása' : 'Tiltás visszavonása').props.onClick({ currentTarget: {} })
    tree = v.h.render(Detail, { user: target, actorId: 'actor' }); await find(tree, (e) => e.type === v.DialogMarker).props.onConfirm('Reason')
    assert.ok(v.records.some((r) => r[0] === (action === 'delete' ? 'remove' : action)))
    if (action === 'delete') assert.deepEqual(v.routes, ['/admin/users'])
    else assert.equal(v.records.find((r) => r[0] === 'set')[2].bannedAt !== null, action === 'ban')
  })
}
test('409 delete conflict preserves dialog and cache, with no navigation or retry', async () => {
  const v = view(); let calls = 0; v.api.remove = async () => { calls++; throw failure(409, 'Más felhasználó receptje hivatkozik rá.') }
  const Detail = v.component('admin-user-detail', 'UserDetailContent'); let tree = v.h.render(Detail, { user, actorId: 'actor' })
  button(tree, 'Felhasználó törlése').props.onClick({ currentTarget: {} }); tree = v.h.render(Detail, { user, actorId: 'actor' })
  await find(tree, (e) => e.type === v.DialogMarker).props.onConfirm('')
  assert.equal(calls, 1); assert.deepEqual(v.routes, []); assert.equal(v.notices.length, 0)
  assert.ok(!v.records.some((r) => ['set', 'remove', 'invalidate'].includes(r[0])))
  assert.equal(find(v.h.render(Detail, { user, actorId: 'actor' }), (e) => e.type === v.DialogMarker).props.error.response.status, 409)
})

test('delete dialog requires exact email, preserves confirmation on failure and uses shared Dialog', () => {
  const h = hooks(); let confirmations = 0
  const Dialog = load('components/admin/user-action-dialog.tsx', { react: h.react, '@kajai/ui': ui, './admin-shared': { ApiError: () => null } }).UserActionDialog
  const props = { user, action: 'delete', role: 'USER', pending: false, error: null, onClose: () => {}, onConfirm: async () => { confirmations++ }, returnFocus: () => {} }
  let tree = h.render(Dialog, props); assert.equal(tree.type, ui.Dialog); assert.equal(button(tree, 'Végleges törlés').props.disabled, true)
  change(field(tree, 'delete-email'), 'TARGET@example.com'); tree = h.render(Dialog, props); assert.equal(button(tree, 'Végleges törlés').props.disabled, true)
  change(field(tree, 'delete-email'), user.email); tree = h.render(Dialog, { ...props, error: failure(409) }); assert.equal(button(tree, 'Végleges törlés').props.disabled, false)
  button(tree, 'Végleges törlés').props.onClick(); assert.equal(confirmations, 1)
  tree = h.render(Dialog, { ...props, pending: true }); assert.equal(button(tree, 'Feldolgozás…').props.disabled, true)
  assert.ok(text(tree).includes('auditnaplók megmaradnak'))
})
test('ban requires a trimmed reason and role dialog explains complete ADMIN access', () => {
  const h = hooks(); const reasons = []
  const Dialog = load('components/admin/user-action-dialog.tsx', { react: h.react, '@kajai/ui': ui, './admin-shared': { ApiError: () => null } }).UserActionDialog
  const props = { user, action: 'ban', role: 'ADMIN', pending: false, error: null, onClose: () => {}, onConfirm: async (value) => reasons.push(value), returnFocus: () => {} }
  let tree = h.render(Dialog, props); change(field(tree, 'ban-reason'), '   '); tree = h.render(Dialog, props); assert.equal(button(tree, 'Felhasználó tiltása').props.disabled, true)
  change(field(tree, 'ban-reason'), '  Reason  '); tree = h.render(Dialog, props); button(tree, 'Felhasználó tiltása').props.onClick(); assert.deepEqual(reasons, ['Reason'])
  const other = hooks(); tree = other.render(Dialog, { ...props, action: 'role' }); assert.ok(text(tree).includes('teljes adminisztrátori hozzáférést'))
})
test('create form sends only allowed fields and reports the actual unverified result', async () => {
  const v = view(); const Create = v.component('admin-user-create', 'AdminUserCreate'); let tree = v.h.render(Create)
  assert.ok(![...elements(tree)].some((e) => e.type === 'option' && text(e) === 'GUEST'))
  change(field(tree, 'new-user-email'), user.email); change(field(tree, 'new-user-name'), '  Név  '); change(field(tree, 'new-user-password'), 'Password123'); change(field(tree, 'new-user-role'), 'ADMIN')
  tree = v.h.render(Create); assert.ok(text(tree).includes('teljes adminisztrátori hozzáférést'))
  find(tree, (e) => e.type === 'form').props.onSubmit({ preventDefault() {} }); await flush()
  assert.deepEqual(v.records.find((r) => r[0] === 'create')[1], { email: user.email, name: 'Név', role: 'ADMIN', password: 'Password123' })
  tree = v.h.render(Create); assert.ok(text(tree).includes('nem aktiválja automatikusan')); assert.ok(text(tree).includes('nincs megerősítve'))
  assert.ok(v.records.some((r) => r[0] === 'invalidate'))
})
test('basic form only patches name/image and merges the safe response into detail', async () => {
  const v = view(); const Form = v.component('admin-user-detail', 'BasicUserForm'); let tree = v.h.render(Form, { user, actorId: 'actor' })
  change(field(tree, 'edit-user-name'), '  Új név  '); change(field(tree, 'edit-user-image'), ''); tree = v.h.render(Form, { user, actorId: 'actor' })
  find(tree, (e) => e.type === 'form').props.onSubmit({ preventDefault() {} }); await flush()
  assert.deepEqual(v.records.find((r) => r[0] === 'edit'), ['edit', user.id, { name: 'Új név', image: null }])
  assert.ok(v.records.some((r) => r[0] === 'set')); assert.ok(v.records.some((r) => r[0] === 'invalidate'))
})

test('dialog completion restores focus to a fallback when its trigger is disabled or removed', () => {
  const v = view(); const restore = v.component('admin-user-detail', 'restoreAdminFocus'); const focused = []
  const fallback = { focus: () => focused.push('fallback') }
  restore({ isConnected: true, matches: () => false, focus: () => focused.push('trigger') }, fallback)
  restore({ isConnected: true, matches: () => true, focus: () => focused.push('disabled') }, fallback)
  restore({ isConnected: false, focus: () => focused.push('removed') }, fallback)
  assert.deepEqual(focused, ['trigger', 'fallback', 'fallback'])
})

test('invalid optional password and unsafe image URL do not reach the API', async () => {
  const v = view(); const Create = v.component('admin-user-create', 'AdminUserCreate'); let tree = v.h.render(Create)
  change(field(tree, 'new-user-email'), user.email); change(field(tree, 'new-user-password'), 'short')
  tree = v.h.render(Create); find(tree, e => e.type === 'form').props.onSubmit({ preventDefault() {} }); await flush()
  assert.ok(!v.records.some(r => r[0] === 'create'))
  assert.ok(text(v.h.render(Create)).includes('legalább 8 karakteres'))
  const other = view(); const Form = other.component('admin-user-detail', 'BasicUserForm'); tree = other.h.render(Form, { user, actorId: 'actor' })
  change(field(tree, 'edit-user-image'), 'javascript:alert(1)'); tree = other.h.render(Form, { user, actorId: 'actor' })
  find(tree, e => e.type === 'form').props.onSubmit({ preventDefault() {} }); await flush()
  assert.ok(!other.records.some(r => r[0] === 'edit'))
  assert.ok(text(other.h.render(Form, { user, actorId: 'actor' })).includes('http vagy https'))
})
