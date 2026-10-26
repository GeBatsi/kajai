import type { Allergen, Nutrition } from '@kajai/types'

const nutritionKeys: readonly (keyof Nutrition | 'per' | 'unit')[] = [
  'energyKcal',
  'protein',
  'carbs',
  'fat',
  'sugar',
  'saturatedFat',
  'fiber',
  'salt',
  'per',
  'unit',
]
const allergenKeys: readonly (keyof Allergen)[] = [
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
]

function pickFields(value: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  return Object.fromEntries(
    keys.filter((key) => value && Object.hasOwn(value, key)).map((key) => [key, value![key]]),
  )
}

export function nutritionFields(value: Record<string, unknown> | null | undefined) {
  return pickFields(value, nutritionKeys)
}

export function allergenFields(value: Record<string, unknown> | null | undefined) {
  return pickFields(value, allergenKeys)
}
