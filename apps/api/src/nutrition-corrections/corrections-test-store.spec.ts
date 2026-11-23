// Deterministic I/O fake; real PostgreSQL tests verify locks, constraints and cascades.
import { Prisma, Role } from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { FoodsService } from '../foods/foods.service'
import { StorageService } from '../storage/storage.service'
import { NutritionCorrectionsService } from './nutrition-corrections.service'

export function correctionTestStore() {
  const users = new Map<string, any>(['user', 'other', 'mod', 'admin'].map((id) => [id, {
    id, name: id, email: `${id}@example.invalid`, password: 'SECRET_HASH', profile: { health: 'PRIVATE' },
    role: id === 'mod' ? Role.MODERATOR : id === 'admin' ? Role.ADMIN : Role.USER, bannedAt: null,
  }]))
  const foods = new Map<string, any>([['food', {
    id: 'food', name: 'Alapanyag', type: 'BASIC', brand: null, eanBarcode: null, imageUrl: null,
    category: 'Teszt', packageSize: null, packageUnit: null, isVerified: false,
    nutrition: { energyKcal: 180, protein: 20, carbs: 30, sugar: 3, fat: 5, saturatedFat: 1, per: 100, unit: 'g' },
    allergens: { milk: false }, productAvailability: [], ingredient: null,
    createdAt: new Date('2026-11-23T10:00:00Z'), updatedAt: new Date('2026-11-23T10:00:00Z'),
  }]])
  const corrections = new Map<string, any>()
  const audits: any[] = []
  const state = { failure: '', locks: [] as string[], transactions: 0, tick: 0 }
  const now = () => new Date(Date.parse('2026-11-23T12:00:00Z') + ++state.tick)
  const project = (row: any, select?: any): any => !row ? null : !select ? structuredClone(row)
    : Object.fromEntries(Object.entries(select).filter(([, value]) => value).map(([key, value]) => [key,
      value === true ? structuredClone(row[key]) : project(key === 'foodItem' ? foods.get(row.foodItemId) : users.get(row[`${key}Id`]), (value as any).select),
    ]))
  const matches = (row: any, where: any = {}) => Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'submittedAt') return (!value.gte || row[key] >= value.gte) && (!value.lte || row[key] <= value.lte)
    if (key === 'OR') return value.some((filter: any) => matches(row, filter))
    if (key === 'id' && value && typeof value === 'object') return !value.in || value.in.includes(row.id)
    return row[key] === value
  })
  const sorted = (rows: any[], orderBy: any[]) => [...rows].sort((a, b) => {
    for (const order of orderBy) for (const [key, direction] of Object.entries(order)) {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1
    }
    return 0
  })
  const tx = {
    $queryRaw: async (query: Prisma.Sql) => {
      state.locks.push(query.text)
      const rows = query.text.includes('"users"') ? users : query.text.includes('"food_nutrition_corrections"') ? corrections : foods
      return query.text.includes('lower(btrim') ? [] : rows.has(String(query.values[0])) ? [{ id: query.values[0] }] : []
    },
    user: {
      findUnique: async ({ where, select }: any) => project(users.get(where.id), select),
      findMany: async ({ where, select }: any) => [...users.values()].filter((row) => matches(row, where)).map((row) => project(row, select)),
    },
    foodItem: {
      findUnique: async ({ where }: any) => project(foods.get(where.id)),
      findUniqueOrThrow: async ({ where }: any) => { const row = foods.get(where.id); if (!row) throw new Error('missing food'); return project(row) },
      update: async ({ where, data }: any) => {
        if (state.failure === 'food') throw new Error('forced food failure')
        const updated = { ...foods.get(where.id), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), updatedAt: now() }
        foods.set(where.id, updated); return project(updated)
      },
    },
    foodNutritionCorrection: {
      findUnique: async ({ where, select }: any) => project(corrections.get(where.id), select),
      findFirst: async ({ where, select }: any) => project([...corrections.values()].find((row) => matches(row, where)), select),
      count: async ({ where }: any) => [...corrections.values()].filter((row) => matches(row, where)).length,
      findMany: async ({ where, select, orderBy, skip = 0, take }: any) => sorted([...corrections.values()].filter((row) => matches(row, where)), orderBy).slice(skip, skip + take).map((row) => project(row, select)),
      create: async ({ data, select }: any) => {
        const row = { id: `c${corrections.size + 1}`, status: 'PENDING', reviewedAt: null, reviewedById: null, rejectionReason: null,
          submittedAt: now(), createdAt: now(), updatedAt: now(), ...data, originalNutrition: data.originalNutrition === Prisma.DbNull ? null : data.originalNutrition }
        corrections.set(row.id, structuredClone(row)); return project(row, select)
      },
      update: async ({ where, data, select }: any) => {
        if (state.failure === 'correction') throw new Error('forced correction failure')
        const row = { ...corrections.get(where.id), ...data, updatedAt: now() }
        corrections.set(where.id, row); return project(row, select)
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        if (state.failure === data.tableName || (state.failure === 'decision' && data.action === 'UPDATE' && data.tableName === 'food_nutrition_corrections')) throw new Error('forced audit failure')
        const row = { id: `a${audits.length + 1}`, createdAt: now(), ...data }; audits.push(row); return project(row)
      },
      count: async ({ where }: any) => audits.filter((row) => matches(row, where)).length,
      findFirst: async ({ where, orderBy }: any) => project(sorted(audits.filter((row) => matches(row, where)), orderBy)[0]),
      findMany: async ({ where, orderBy, take }: any) => sorted(audits.filter((row) => matches(row, where)), orderBy).slice(0, take).map((row) => project(row)),
    },
  }
  const prisma = {
    ...tx,
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => {
      state.transactions++
      const before = structuredClone({ users, foods, corrections, audits })
      try { return await operation(tx) }
      catch (error) {
        for (const [target, source] of [[users, before.users], [foods, before.foods], [corrections, before.corrections]]) { target.clear(); for (const [key, value] of source) target.set(key, value) }
        audits.splice(0, audits.length, ...before.audits)
        throw error
      }
    },
  } as unknown as PrismaService
  const audit = new AuditService(prisma)
  const foodService = new FoodsService(prisma, audit, {} as StorageService)
  foodService['logger'].error = () => undefined
  return { prisma, audit, foodService, service: new NutritionCorrectionsService(prisma, audit, foodService), users, foods, corrections, audits, state }
}
