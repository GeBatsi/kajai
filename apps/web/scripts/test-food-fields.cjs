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
const { nutritionFields, allergenFields } = loaded.exports

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
test('allergen payload retains hidden valid allergens and false values', () => {
  assert.deepEqual(
    allergenFields({
      milk: false,
      fish: true,
      shellfish: false,
      sesame: true,
      celery: false,
      mustard: true,
      lupin: false,
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
    },
  )
})
test('missing or null stored objects produce an empty payload', () => {
  for (const value of [undefined, null, {}]) {
    assert.deepEqual(nutritionFields(value), {})
    assert.deepEqual(allergenFields(value), {})
  }
})
