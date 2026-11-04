/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness for the existing TypeScript compiler. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const file = path.resolve(__dirname, '../src/components/foods/food-fields.ts')
const loaded = new Module(file, module)
loaded._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  file,
)
const { nutritionFields, nutritionAmount, allergenFields, allergenOptions, allergenValues } =
  loaded.exports

test('empty nutrition inputs remain unknown through JSON serialization; explicit zero stays zero', () => {
  for (const empty of ['', '   ']) assert.equal(nutritionAmount(empty), null)
  for (const zero of ['0', '0.0', ' 0 ']) assert.equal(nutritionAmount(zero), 0)
  assert.equal(nutritionAmount('1.25'), 1.25)
  assert.deepEqual(
    JSON.parse(JSON.stringify({ salt: nutritionAmount(''), fiber: nutritionAmount('0') })),
    {
      salt: null,
      fiber: 0,
    },
  )
  for (const invalid of ['sok', 'NaN', 'Infinity']) assert.throws(() => nutritionAmount(invalid))
})

test('nutrition payload excludes unknown and legacy keys while retaining valid fields', () => {
  const stored = {
    per: 100,
    unit: 'g',
    energyKcal: 100,
    protein: 0,
    sugar: null,
    kcal: 999,
    foo: 'bar',
  }
  assert.deepEqual(nutritionFields(stored), {
    per: 100,
    unit: 'g',
    energyKcal: 100,
    protein: 0,
    sugar: null,
  })
  assert.equal(stored.foo, 'bar')
})
test('allergen payload retains valid allergens and false values', () => {
  assert.deepEqual(
    allergenFields({
      milk: false,
      fish: true,
      shellfish: false,
      sesame: true,
      celery: false,
      mustard: true,
      lupin: false,
      sulphites: true,
      molluscs: false,
      foo: 'bar',
    }),
    {
      milk: false,
      fish: true,
      shellfish: false,
      sesame: true,
      celery: false,
      mustard: true,
      lupin: false,
      sulphites: true,
      molluscs: false,
    },
  )
})

test('the form exposes all 14 allergens with unique keys and labels', () => {
  const expected = [
    'gluten',
    'milk',
    'egg',
    'soy',
    'nuts',
    'peanuts',
    'fish',
    'shellfish',
    'sesame',
    'celery',
    'mustard',
    'lupin',
    'sulphites',
    'molluscs',
  ]
  assert.deepEqual(
    allergenOptions.map((option) => option.key),
    expected,
  )
  assert.equal(new Set(allergenOptions.map((option) => option.label)).size, 14)
  assert.ok(allergenOptions.every((option) => option.label.trim()))
})

test('all 14 saved values are loaded and legacy omissions default to unchecked', () => {
  for (const enabled of [true, false]) {
    const stored = Object.fromEntries(allergenOptions.map(({ key }) => [key, enabled]))
    assert.deepEqual(allergenValues(stored), stored)
  }
  for (const stored of [undefined, null, {}, { milk: true, foo: 'bar' }]) {
    const values = allergenValues(stored)
    assert.equal(Object.keys(values).length, 14)
    for (const { key } of allergenOptions) assert.equal(values[key], stored?.[key] === true)
  }
})
test('missing or null stored objects produce an empty payload', () => {
  for (const value of [undefined, null, {}]) {
    assert.deepEqual(nutritionFields(value), {})
    assert.deepEqual(allergenFields(value), {})
  }
})
