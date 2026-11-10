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
const allergenLabels: Record<keyof Allergen, string> = {
  gluten: 'Glutén',
  milk: 'Tej',
  egg: 'Tojás',
  soy: 'Szója',
  nuts: 'Diófélék',
  peanuts: 'Földimogyoró',
  fish: 'Hal',
  shellfish: 'Rákfélék',
  sesame: 'Szezám',
  celery: 'Zeller',
  mustard: 'Mustár',
  lupin: 'Csillagfürt',
  sulphites: 'Kén-dioxid és szulfitok',
  molluscs: 'Puhatestűek',
}
const allergenKeys = Object.keys(allergenLabels) as (keyof Allergen)[]

export const allergenOptions = allergenKeys.map((key) => ({ key, label: allergenLabels[key] }))

export function allergenValues(value?: Record<string, unknown> | null): Allergen {
  return Object.fromEntries(
    allergenKeys.map((key) => [key, value?.[key] === true]),
  ) as unknown as Allergen
}

function pickFields(value: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  return Object.fromEntries(
    keys.filter((key) => value && Object.hasOwn(value, key)).map((key) => [key, value![key]]),
  )
}

export function nutritionFields(value: Record<string, unknown> | null | undefined) {
  return pickFields(value, nutritionKeys)
}

export function nutritionAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error('A tápértékekhez érvényes számot adj meg.')
  return amount
}

export function allergenFields(value: Record<string, unknown> | null | undefined) {
  return pickFields(value, allergenKeys)
}
