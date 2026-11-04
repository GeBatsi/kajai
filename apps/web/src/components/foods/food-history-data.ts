import { allergenOptions } from './food-fields'

export type HistoryValues = {
  name: string | null
  category: string | null
  nutrition: Record<string, unknown> | null
  allergens: Record<string, unknown> | null
  imageUrl: string | null
}
export type HistoryState = { values: HistoryValues; canRestore: boolean; reason: string | null }
export type HistoryEntry = {
  id: string
  action: string
  createdAt: string
  actor: { id: string; name: string | null } | null
  before: HistoryState | null
  after: HistoryState | null
  restoreSource: { auditId: string; side: 'before' | 'after'; createdAt?: string } | null
}
export type FoodHistoryData = {
  current: {
    values: HistoryValues
    updatedAt: string
    latestAuditId: string | null
    canRestore: boolean
  } | null
  entries: HistoryEntry[]
  nextCursor: string | null
}

const nutritionLabels: Record<string, string> = {
  energyKcal: 'Energia (kcal)',
  protein: 'Fehérje (g)',
  carbs: 'Szénhidrát (g)',
  sugar: 'Cukor (g)',
  fat: 'Zsír (g)',
  saturatedFat: 'Telített zsír (g)',
  fiber: 'Rost (g)',
  salt: 'Só (g)',
  per: 'Vonatkoztatási mennyiség',
  unit: 'Mértékegység',
}
const allergenLabels = Object.fromEntries(allergenOptions.map(({ key, label }) => [key, label]))
export function historyText(value: unknown): string {
  if (value === null || value === undefined) return 'Nincs adat'
  if (value === true) return 'Igen'
  if (value === false) return 'Nem'
  if (value === '') return 'Üres'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function historyChanges(
  before: HistoryValues | null,
  after: HistoryValues | null,
  includeImage = true,
) {
  const rows: { key: string; label: string; before: string; after: string }[] = []
  const add = (key: string, label: string, old: unknown, next: unknown) => {
    if (JSON.stringify(old ?? null) !== JSON.stringify(next ?? null))
      rows.push({ key, label, before: historyText(old), after: historyText(next) })
  }
  add('name', 'Név', before?.name, after?.name)
  add('category', 'Kategória', before?.category, after?.category)
  for (const [field, label, names] of [
    ['nutrition', 'Tápértékek', nutritionLabels],
    ['allergens', 'Allergének', allergenLabels],
  ] as const) {
    const old = before?.[field],
      next = after?.[field]
    const keys = new Set([...Object.keys(old ?? {}), ...Object.keys(next ?? {})])
    if (!keys.size || !old !== !next)
      add(field, label, old ? 'Megadva' : null, next ? 'Megadva' : null)
    for (const key of keys)
      add(`${field}.${key}`, `${label}: ${names[key] ?? key}`, old?.[key], next?.[key])
  }
  if (includeImage) add('imageUrl', 'Kép hivatkozása', before?.imageUrl, after?.imageUrl)
  return rows
}
