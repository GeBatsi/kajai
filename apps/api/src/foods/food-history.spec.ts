import 'reflect-metadata'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common'
import { FoodItemType, Prisma } from '@kajai/db'
import { FoodsService } from './foods.service'
import { FoodHistoryQueryDto, RestoreFoodDto } from './dto/food-history.dto'

function setup() {
  const food = {
    id: 'food-id',
    name: 'Mostani',
    type: FoodItemType.BASIC as FoodItemType,
    category: 'Új',
    imageUrl: 'https://images.example/current.png',
    brand: 'Keep',
    nutrition: { protein: 20, carbs: 10 },
    allergens: { milk: true, fish: true },
    updatedAt: new Date('2026-10-27T10:00:00.000Z'),
  }
  const snapshot = {
    ...food,
    name: 'Korábbi',
    category: null,
    nutrition: { protein: 5 },
    allergens: { milk: false },
    imageUrl: 'https://images.example/deleted.png',
  }
  const rows = [
    {
      id: 'latest',
      tableName: 'food_items',
      recordId: food.id,
      action: 'UPDATE',
      oldValue: snapshot as unknown,
      newValue: food as unknown,
      userId: 'author',
      createdAt: new Date('2026-10-27T10:00:00Z'),
    },
    {
      id: 'earlier',
      tableName: 'food_items',
      recordId: food.id,
      action: 'CREATE',
      oldValue: null as unknown,
      newValue: snapshot as unknown,
      userId: 'author',
      createdAt: new Date('2026-10-26T10:00:00Z'),
    },
  ]
  let exists = true
  const tx = {
    foodItem: {
      findUnique: mock.fn(async () => (exists ? food : null)),
      findUniqueOrThrow: mock.fn(async () => food),
      update: mock.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...food,
        ...data,
      })),
    },
    auditLog: {
      findFirst: mock.fn(
        async ({ where }: { where: { id?: string; tableName: string; recordId: string } }) =>
          rows.find(
            (row) =>
              row.tableName === where.tableName &&
              row.recordId === where.recordId &&
              (!where.id || row.id === where.id),
          ) ?? null,
      ),
      findMany: mock.fn(
        async (query: {
          where: { tableName: string; recordId: string; OR?: { createdAt: { lt: Date } }[] }
          take: number
        }) =>
          rows
            .filter(
              (row) =>
                row.tableName === query.where.tableName &&
                row.recordId === query.where.recordId &&
                (!query.where.OR || row.createdAt < query.where.OR[0].createdAt.lt),
            )
            .slice(0, query.take),
      ),
    },
    user: {
      findMany: mock.fn(async (query: unknown) => {
        void query
        return [{ id: 'author', name: 'Moderátor' }]
      }),
    },
    $queryRaw: mock.fn(async (query: Prisma.Sql) =>
      query.text.includes('FOR UPDATE') && exists ? [{ id: food.id }] : ([] as { id: string }[]),
    ),
  }
  const prisma = {
    ...tx,
    $transaction: mock.fn(async (callback: (client: typeof tx) => unknown, options?: unknown) => {
      void options
      return callback(tx)
    }),
  }
  const audit = {
    logWithTx: mock.fn(async (client: unknown, params: unknown) => {
      void client
      void params
    }),
  }
  const storage = { uploadFoodImage: mock.fn(), deleteFileByUrl: mock.fn() }
  type Deps = ConstructorParameters<typeof FoodsService>
  const service = new FoodsService(
    prisma as unknown as Deps[0],
    audit as unknown as Deps[1],
    storage as unknown as Deps[2],
  )
  const dto: RestoreFoodDto = {
    auditId: 'earlier',
    side: 'after',
    expectedUpdatedAt: food.updatedAt.toISOString(),
    expectedLatestAuditId: 'latest',
  }
  return {
    service,
    food,
    snapshot,
    rows,
    tx,
    prisma,
    audit,
    storage,
    dto,
    removeFood: () => {
      exists = false
    },
  }
}

test('history returns scoped, paginated snapshots and only public actor identity', async () => {
  const { service, tx } = setup()
  const first = await service.history('food-id', { limit: 1 })
  assert.equal(first.entries.length, 1)
  assert.equal(first.nextCursor, 'latest')
  assert.deepEqual(first.entries[0].actor, { id: 'author', name: 'Moderátor' })
  assert.deepEqual(tx.user.findMany.mock.calls[0].arguments[0], {
    where: { id: { in: ['author'] } },
    select: { id: true, name: true },
  })
  assert.equal(first.entries[0].before?.values.name, 'Korábbi')
  assert.equal(first.current?.latestAuditId, 'latest')
  const second = await service.history('food-id', { limit: 1, cursor: first.nextCursor! })
  assert.equal(second.entries[0].id, 'earlier')
  assert.equal(second.nextCursor, null)
  assert.equal(second.entries[0].before, null)
})

test('history remains available after deletion and marks invalid historical values as unavailable', async () => {
  const { service, removeFood, rows } = setup()
  removeFood()
  rows[0].action = 'DELETE'
  rows[0].newValue = null
  rows[0].oldValue = { type: 'BASIC', name: 'Legacy', nutrition: { foo: 'bar' } }
  const result = await service.history('food-id', { limit: 20 })
  assert.equal(result.current, null)
  assert.equal(result.entries[0].after, null)
  assert.equal(result.entries[0].before?.canRestore, false)
  assert.match(result.entries[0].before?.reason ?? '', /nutrition.foo/)
})

test('history rejects foreign cursors and unknown records', async () => {
  const { service } = setup()
  await assert.rejects(
    service.history('food-id', { limit: 20, cursor: 'foreign' }),
    BadRequestException,
  )
  const missing = setup()
  missing.removeFood()
  await assert.rejects(missing.service.history('other-id', { limit: 20 }), NotFoundException)
})

test('restore replaces the four data fields, keeps image and identity, and appends a traced audit', async () => {
  const { service, food, snapshot, tx, audit, storage, dto } = setup()
  const restored = await service.restore(food.id, dto, 'restoring-user')
  const data = tx.foodItem.update.mock.calls[0].arguments[0].data
  assert.deepEqual(data, {
    name: snapshot.name,
    category: null,
    nutrition: { protein: 5 },
    allergens: { milk: false },
  })
  assert.equal(restored.imageUrl, food.imageUrl)
  assert.equal(restored.id, food.id)
  assert.equal(restored.brand, food.brand)
  assert.equal(storage.uploadFoodImage.mock.callCount(), 0)
  assert.equal(storage.deleteFileByUrl.mock.callCount(), 0)
  assert.equal(audit.logWithTx.mock.calls[0].arguments[0], tx)
  const log = audit.logWithTx.mock.calls[0].arguments[1] as {
    action: string
    userId: string
    oldValue: unknown
    newValue: { restoreSource: unknown }
  }
  assert.equal(log.action, 'RESTORE')
  assert.equal(log.userId, 'restoring-user')
  assert.deepEqual(log.oldValue, food)
  assert.deepEqual(log.newValue.restoreSource, {
    auditId: 'earlier',
    side: 'after',
    createdAt: '2026-10-26T10:00:00.000Z',
  })
  assert.match(tx.$queryRaw.mock.calls[0].arguments[0].text, /FOR UPDATE/)
  assert.deepEqual(tx.$queryRaw.mock.calls[0].arguments[0].values, [food.id])
})

test('restore supports the before state, legacy nutrition keys and null JSON values', async () => {
  const { service, tx, dto, rows, snapshot } = setup()
  rows[0].oldValue = { ...snapshot, nutrition: { kcal: 120, proteinG: 5 }, allergens: null }
  await service.restore('food-id', { ...dto, auditId: 'latest', side: 'before' }, 'user')
  assert.deepEqual(tx.foodItem.update.mock.calls[0].arguments[0].data.nutrition, {
    energyKcal: 120,
    protein: 5,
  })
  assert.equal(tx.foodItem.update.mock.calls[0].arguments[0].data.allergens, Prisma.DbNull)
  rows[0].oldValue = { ...snapshot, nutrition: null, allergens: {} }
  await service.restore('food-id', { ...dto, auditId: 'latest', side: 'before' }, 'user')
  assert.equal(tx.foodItem.update.mock.calls[1].arguments[0].data.nutrition, Prisma.DbNull)
})

for (const change of [
  { expectedUpdatedAt: '2026-10-26T10:00:00.000Z' },
  { expectedLatestAuditId: 'stale-audit' },
]) {
  test(`restore rejects stale comparison ${JSON.stringify(change)} without writes`, async () => {
    const { service, tx, dto, audit } = setup()
    await assert.rejects(
      service.restore('food-id', { ...dto, ...change }, 'user'),
      ConflictException,
    )
    assert.equal(tx.foodItem.update.mock.callCount(), 0)
    assert.equal(audit.logWithTx.mock.callCount(), 0)
  })
}

for (const scenario of [
  'deleted',
  'foreign-entry',
  'missing-state',
  'invalid-name',
  'invalid-nutrition',
  'invalid-allergens',
  'product',
  'duplicate',
] as const) {
  test(`restore rejects ${scenario} before mutation`, async () => {
    const { service, food, tx, dto, audit, rows, snapshot, removeFood } = setup()
    let expected = BadRequestException
    if (scenario === 'deleted') {
      removeFood()
      expected = NotFoundException
    }
    if (scenario === 'foreign-entry') {
      rows[1].recordId = 'other'
      expected = NotFoundException
    }
    if (scenario === 'missing-state') dto.side = 'before'
    if (scenario === 'invalid-name') rows[1].newValue = { ...snapshot, name: '   ' }
    if (scenario === 'invalid-nutrition')
      rows[1].newValue = { ...snapshot, nutrition: { protein: 80, carbs: 30 } }
    if (scenario === 'invalid-allergens')
      rows[1].newValue = { ...snapshot, allergens: { sulphites: 'yes' } }
    if (scenario === 'product') food.type = FoodItemType.PRODUCT
    if (scenario === 'duplicate') {
      tx.$queryRaw.mock.mockImplementation(async () => [{ id: 'existing' }])
      expected = ConflictException
    }
    await assert.rejects(service.restore('food-id', dto, 'user'), expected)
    assert.equal(tx.foodItem.update.mock.callCount(), 0)
    assert.equal(audit.logWithTx.mock.callCount(), 0)
  })
}

test('audit failure rejects the enclosing restore transaction', async () => {
  const { service, dto, audit, prisma } = setup()
  const error = new Error('audit unavailable')
  audit.logWithTx.mock.mockImplementation(async () => {
    throw error
  })
  await assert.rejects(service.restore('food-id', dto, 'user'), (actual) => actual === error)
  assert.equal(prisma.$transaction.mock.callCount(), 1)
})

test('restore maps a raced unique constraint failure to 409', async () => {
  const { service, dto, tx, audit } = setup()
  tx.foodItem.update.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: 'food_items_basic_name_category_key' },
    })
  })
  await assert.rejects(service.restore('food-id', dto, 'user'), ConflictException)
  assert.equal(audit.logWithTx.mock.callCount(), 0)
})

test('restore DTO rejects arbitrary snapshot fields, missing version and invalid side', async () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  const { dto } = setup()
  for (const body of [
    { ...dto, name: 'Injected' },
    { ...dto, side: 'DELETE' },
    { ...dto, expectedLatestAuditId: undefined },
    { ...dto, expectedUpdatedAt: 'invalid' },
  ]) {
    await assert.rejects(
      pipe.transform(body, { type: 'body', metatype: RestoreFoodDto }),
      BadRequestException,
    )
  }
  assert.equal(
    (
      await pipe.transform(
        { ...dto, expectedLatestAuditId: null },
        { type: 'body', metatype: RestoreFoodDto },
      )
    ).expectedLatestAuditId,
    null,
  )
  for (const limit of ['0', '-1', '51', 'sok']) {
    await assert.rejects(
      pipe.transform({ limit }, { type: 'query', metatype: FoodHistoryQueryDto }),
      BadRequestException,
    )
  }
})
