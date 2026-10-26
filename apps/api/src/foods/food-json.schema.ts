import { BadRequestException } from '@nestjs/common'
import type { Allergen, Nutrition } from '@kajai/types'

const nutritionFields: Record<
  keyof Nutrition | 'per' | 'unit',
  'number' | 'nullable' | 'per' | 'unit'
> = {
  energyKcal: 'number',
  protein: 'number',
  carbs: 'number',
  fat: 'number',
  sugar: 'nullable',
  saturatedFat: 'nullable',
  fiber: 'nullable',
  salt: 'nullable',
  per: 'per',
  unit: 'unit',
}
const allergenFields: Record<keyof Allergen, true> = {
  gluten: true,
  milk: true,
  egg: true,
  soy: true,
  nuts: true,
  peanuts: true,
  fish: true,
  shellfish: true,
  sesame: true,
  celery: true,
  mustard: true,
  lupin: true,
}

function parseObject(value: unknown, field: string): Record<string, unknown> | null | undefined {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      throw new BadRequestException(`${field}: érvénytelen JSON.`)
    }
  }
  // Preserve the existing optional-object semantics; PATCH rejects nutrition: null separately.
  if (value === undefined || value === null) return value
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field}: az értéket objektumként kell megadni.`)
  }
  return value as Record<string, unknown>
}

export function parseNutrition(value: unknown): Record<string, unknown> | null | undefined {
  const nutrition = parseObject(value, 'nutrition')
  if (!nutrition) return nutrition
  for (const [key, amount] of Object.entries(nutrition)) {
    if (!Object.hasOwn(nutritionFields, key)) {
      throw new BadRequestException(`nutrition.${key}: ismeretlen mező.`)
    }
    const rule = nutritionFields[key as keyof typeof nutritionFields]
    if (rule === 'per') {
      if (amount !== 100) throw new BadRequestException('nutrition.per: az érték csak 100 lehet.')
    } else if (rule === 'unit') {
      if (amount !== 'g' && amount !== 'ml') {
        throw new BadRequestException('nutrition.unit: csak g vagy ml lehet.')
      }
    } else if (!(rule === 'nullable' && amount === null)) {
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException(
          `nutrition.${key}: csak nemnegatív, véges számok adhatók meg.`,
        )
      }
      if (key === 'energyKcal' && amount > 900) {
        throw new BadRequestException('nutrition.energyKcal: az energia legfeljebb 900 kcal lehet.')
      }
    }
  }
  return nutrition
}

export function parseAllergens(value: unknown): Record<string, unknown> | null | undefined {
  const allergens = parseObject(value, 'allergens')
  if (!allergens) return allergens
  for (const [key, flag] of Object.entries(allergens)) {
    if (!Object.hasOwn(allergenFields, key)) {
      throw new BadRequestException(`allergens.${key}: ismeretlen mező.`)
    }
    if (typeof flag !== 'boolean') {
      throw new BadRequestException(`allergens.${key}: csak true vagy false lehet.`)
    }
  }
  return allergens
}

// Only stored data uses legacy aliases; incoming requests must use canonical keys.
export function normalizeStoredNutrition(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const nutrition = { ...value } as Record<string, unknown>
  for (const [oldKey, key] of Object.entries({
    kcal: 'energyKcal',
    proteinG: 'protein',
    carbsG: 'carbs',
    fatG: 'fat',
  })) {
    if (!Object.hasOwn(nutrition, key) && Object.hasOwn(nutrition, oldKey)) {
      nutrition[key] = nutrition[oldKey]
    }
    delete nutrition[oldKey]
  }
  return nutrition
}
