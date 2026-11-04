import { BadRequestException } from '@nestjs/common'
import { normalizeStoredNutrition, parseAllergens, parseNutrition } from './food-json.schema'

export function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function historyValues(value: unknown) {
  const data = jsonObject(value)
  if (!data) return null
  return {
    name: typeof data.name === 'string' ? data.name : null,
    category: typeof data.category === 'string' ? data.category : null,
    nutrition: data.nutrition == null ? null : normalizeStoredNutrition(data.nutrition),
    allergens: jsonObject(data.allergens),
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
  }
}

export function restoreValues(value: unknown) {
  const data = jsonObject(value)
  if (!data || data.type !== 'BASIC') {
    throw new BadRequestException('Csak alapanyag korábbi adatállapota állítható vissza.')
  }
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name || name.length > 200) {
    throw new BadRequestException('A korábbi névnek 1–200 karakter hosszúnak kell lennie.')
  }
  if (data.category != null && typeof data.category !== 'string') {
    throw new BadRequestException('A korábbi kategória érvénytelen.')
  }
  if (data.nutrition != null && !jsonObject(data.nutrition)) {
    throw new BadRequestException('A korábbi tápértékek nem olvashatók objektumként.')
  }
  return {
    name,
    category: typeof data.category === 'string' ? data.category : null,
    nutrition:
      parseNutrition(data.nutrition == null ? null : normalizeStoredNutrition(data.nutrition)) ??
      null,
    allergens: parseAllergens(data.allergens ?? null) ?? null,
  }
}
