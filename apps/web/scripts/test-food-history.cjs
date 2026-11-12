/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
function load(name, overrides = {}) {
  const file = path.resolve(__dirname, '../src/components/foods', name + '.ts')
  const loaded = new Module(file, module)
  loaded.require = (key) => overrides[key] ?? require(key)
  loaded._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    file,
  )
  return loaded.exports
}
const { historyChanges } = load('food-history-data', { './food-fields': load('food-fields') })
const base = {
  name: 'Alma',
  category: 'Gyümölcs',
  nutrition: { protein: 5 },
  allergens: { sulphites: true },
  imageUrl: 'old.png',
}
test('history comparison labels numeric, nullable and all 14 allergen fields', () => {
  const result = historyChanges(base, {
    ...base,
    category: null,
    nutrition: { protein: 0 },
    allergens: { sulphites: false, molluscs: true },
  })
  assert.ok(
    result.some(
      (row) => row.key === 'nutrition.protein' && row.before === '5' && row.after === '0',
    ),
  )
  assert.ok(result.some((row) => row.label.includes('Kén-dioxid') && row.after === 'Nem'))
  assert.ok(result.some((row) => row.label.includes('Puhatestűek') && row.after === 'Igen'))
  assert.ok(result.some((row) => row.key === 'category' && row.after === 'Nincs adat'))
})
test('image-only changes are visible in history but absent from restore preview', () => {
  const next = { ...base, imageUrl: 'new.png' }
  assert.equal(historyChanges(base, next).length, 1)
  assert.deepEqual(historyChanges(base, next, false), [])
})
test('a real string matching the empty-value label is still a change', () => {
  assert.equal(
    historyChanges({ ...base, category: 'Nincs adat' }, { ...base, category: null }).length,
    1,
  )
})
test('null versus empty objects and field removal remain visible', () => {
  const result = historyChanges(base, { ...base, nutrition: null, allergens: {} }, false)
  assert.ok(result.some((row) => row.key === 'nutrition.protein' && row.after === 'Nincs adat'))
  assert.ok(result.some((row) => row.key === 'allergens.sulphites' && row.after === 'Nincs adat'))
  assert.equal(
    historyChanges({ ...base, nutrition: null }, { ...base, nutrition: {} }, false).length,
    1,
  )
})
