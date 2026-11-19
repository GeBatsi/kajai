// Shared deterministic I/O fake. Real PostgreSQL locking/cascades are tested separately.
import assert from 'node:assert/strict'
import { Prisma, Role, type User } from '@kajai/db'

export function makeTestUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id, email: `${id}@example.com`, password: 'test-only-hash', name: id, image: null,
    role: Role.USER, isVerified: true, bannedAt: null, banReason: null,
    createdAt: new Date('2026-11-18T12:00:00Z'), updatedAt: new Date('2026-11-18T12:00:00Z'),
    ...overrides,
  }
}

export function usersTestStore(initial: User[] = []) {
  const users = new Map(initial.map((user) => [user.id, user]))
  const audits: Record<string, unknown>[] = []
  const state = {
    authReads: 0, mutations: 0, failAudit: false, failDelete: false, externalReference: false,
    activeAdminCountOverride: undefined as number | undefined,
    locks: [] as string[], isolationLevels: [] as string[],
  }
  const project = (user: User | undefined, select?: Record<string, boolean>) => user
    ? select ? Object.fromEntries(Object.entries(select).filter(([, include]) => include).map(([key]) => [key, user[key as keyof User]])) : { ...user }
    : null
  function matches(user: User, where: Prisma.UserWhereInput = {}): boolean {
    if (typeof where.role === 'string' && user.role !== where.role) return false
    if (where.bannedAt === null && user.bannedAt !== null) return false
    if (where.bannedAt && typeof where.bannedAt === 'object' && 'not' in where.bannedAt && where.bannedAt.not === null && user.bannedAt === null) return false
    for (const key of ['name', 'email'] as const) {
      const filter = where[key]
      if (filter && typeof filter === 'object' && typeof filter.contains === 'string') {
        const value = user[key] ?? ''
        if (!(filter.mode === 'insensitive' ? value.toLowerCase().includes(filter.contains.toLowerCase()) : value.includes(filter.contains))) return false
      }
    }
    if (where.OR && !where.OR.some((filter) => matches(user, filter))) return false
    return true
  }
  const userClient = (trackAuth: boolean) => ({
    findUnique: async ({ where, select }: { where: { id?: string; email?: string }; select?: Record<string, boolean> }) => {
      if (trackAuth && select?.bannedAt && select?.id && !select?.email) state.authReads++
      return project(where.id ? users.get(where.id) : [...users.values()].find((u) => u.email === where.email), select)
    },
    findMany: async ({ where, select, skip = 0, take }: {
      where?: Prisma.UserWhereInput; select: Record<string, boolean>; skip?: number; take?: number; orderBy?: unknown
    }) => [...users.values()].filter((u) => matches(u, where))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id))
      .slice(skip, take === undefined ? undefined : skip + take).map((u) => project(u, select)),
    count: async ({ where }: { where: Prisma.UserWhereInput }) =>
      where.role === Role.ADMIN && state.activeAdminCountOverride !== undefined ? state.activeAdminCountOverride : [...users.values()].filter((u) => matches(u, where)).length,
    create: async ({ data, select }: { data: Partial<User> & { email: string }; select: Record<string, boolean> }) => {
      state.mutations++
      const user = makeTestUser(`created-${state.mutations}`, {
        ...Object.fromEntries(Object.entries(data).filter(([key, value]) => key !== 'profile' && value !== undefined)),
        email: data.email, password: data.password ?? null, isVerified: false,
      })
      users.set(user.id, user)
      return project(user, select)
    },
    update: async ({ where, data, select }: { where: { id: string }; data: Partial<User>; select: Record<string, boolean> }) => {
      state.mutations++
      const user = users.get(where.id)!
      Object.assign(user, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)))
      return project(user, select)
    },
    delete: async ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) => {
      if (state.failDelete) throw new Error('delete failed')
      state.mutations++
      const result = project(users.get(where.id), select)
      users.delete(where.id)
      return result
    },
  })
  const tx = {
    user: userClient(false),
    recipe: { findFirst: async () => state.externalReference ? { id: 'referenced-recipe' } : null },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => {
      if (state.failAudit) throw new Error('audit failed')
      audits.push(structuredClone(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))))
      return data
    } },
    $executeRaw: async (sql: TemplateStringsArray) => {
      state.locks.push(sql.join(''))
      return 0
    },
  }
  let queue = Promise.resolve()
  const prisma = {
    ...tx,
    user: userClient(true),
    userProfile: {
      findUnique: async ({ where }: { where: { userId: string } }) => ({
        userId: where.userId, gender: null, dateOfBirth: null, heightCm: null, weightKg: null,
        bodyFatPct: null, activityLevel: 'SEDENTARY', goalType: 'MAINTENANCE',
      }),
      update: async ({ where, data }: { where: { userId: string }; data: object }) => ({ ...where, ...data }),
    },
    $transaction: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: string }) => {
      state.isolationLevels.push(options.isolationLevel)
      const previous = queue
      let release!: () => void
      queue = new Promise<void>((resolve) => { release = resolve })
      await previous
      const originals = new Map(users)
      const snapshot = structuredClone(users)
      const auditCount = audits.length
      const mutationCount = state.mutations
      try {
        const result = await operation(tx as unknown as Prisma.TransactionClient)
        if (options.isolationLevel === 'ReadCommitted') {
          assert.ok(state.locks.at(-1)?.includes('SHARE ROW EXCLUSIVE MODE'))
        }
        return result
      } catch (error) {
        users.clear()
        snapshot.forEach((user, id) => users.set(id, Object.assign(originals.get(id)!, user)))
        audits.length = auditCount
        state.mutations = mutationCount
        throw error
      } finally {
        release()
      }
    },
  }
  return { prisma, users, audits, state }
}
