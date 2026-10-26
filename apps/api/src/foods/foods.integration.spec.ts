import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mock, test } from 'node:test'
import { ConflictException } from '@nestjs/common'
import { FoodItemType, Prisma, PrismaClient } from '@kajai/db'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { FoodsService } from './foods.service'

const testDatabaseUrl = process.env.FOOD_TEST_DATABASE_URL
const duplicateMessage = 'Ilyen nevű alapanyag már létezik ebben a kategóriában.'

function isDuplicate(error: unknown): boolean {
  assert.ok(error instanceof ConflictException)
  assert.equal(error.getStatus(), 409)
  assert.equal(error.message, duplicateMessage)
  return true
}

test(
  'BASIC food uniqueness with PostgreSQL',
  { skip: !testDatabaseUrl, timeout: 60000 },
  async (t) => {
    const schema = `food_uniqueness_test_${randomUUID().replaceAll('-', '')}`
    const url = new URL(testDatabaseUrl!)
    const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    t.after(async () => {
      await db.$disconnect()
      try {
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
      } finally {
        await admin.$disconnect()
      }
    })

    const prismaDir = resolve(__dirname, '../../../../packages/db/prisma')
    // The immutable initial migration has only simple, semicolon-separated DDL statements.
    const initialSql = readFileSync(
      resolve(prismaDir, 'migrations/20260623154715_init/migration.sql'),
      'utf8',
    )
    for (const statement of initialSql
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean)) {
      await db.$executeRawUnsafe(statement)
    }
    const migration = readFileSync(
      resolve(prismaDir, 'migrations/20261025120000_unique_basic_food_name_category/migration.sql'),
      'utf8',
    )
    const preflight = readFileSync(resolve(prismaDir, 'checks/basic-food-duplicates.sql'), 'utf8')
    const apiDb = db as unknown as PrismaService
    const storage = {
      uploadFoodImage: mock.fn(async () => ({ url: `https://images.example/${randomUUID()}.png` })),
      deleteFileByUrl: mock.fn<(url: string) => Promise<void>>(async () => undefined),
    }
    const service = new FoodsService(
      apiDb,
      new AuditService(apiDb),
      storage as unknown as StorageService,
    )
    service['logger'].error = () => undefined
    const userId = 'food-test-user'
    const image = {
      buffer: Buffer.from('mock upload'),
      mimetype: 'image/png',
    } as Express.Multer.File

    t.beforeEach(async () => {
      await db.auditLog.deleteMany()
      await db.foodItem.deleteMany()
      storage.uploadFoodImage.mock.resetCalls()
      storage.deleteFileByUrl.mock.resetCalls()
    })

    await t.test(
      'preflight lists legacy duplicates and migration refuses them without deleting records',
      async () => {
        await db.foodItem.createMany({
          data: [
            { name: 'QA19-dup', category: ' Hús ' },
            { name: 'QA19-dup', category: 'hús' },
            { name: 'qa19-DUP ', category: 'HÚS' },
            { name: 'QA19-dup', category: 'Hús', type: FoodItemType.PRODUCT },
            { name: 'QA19-dup', category: 'Más' },
          ],
        })
        const duplicates =
          await db.$queryRawUnsafe<
            {
              normalized_name: string
              normalized_category: string
              duplicate_count: bigint
              records: unknown[]
            }[]
          >(preflight)
        assert.equal(duplicates.length, 1)
        assert.equal(duplicates[0].normalized_name, 'qa19-dup')
        assert.equal(duplicates[0].normalized_category, 'hús')
        assert.equal(duplicates[0].duplicate_count, 3n)
        assert.equal(duplicates[0].records.length, 3)
        await assert.rejects(db.$executeRawUnsafe(migration), (error) => {
          assert.ok(error instanceof Prisma.PrismaClientKnownRequestError)
          assert.equal(error.meta?.code, '23505')
          return true
        })
        assert.equal(await db.foodItem.count(), 5)
      },
    )

    // Only this test's isolated schema is cleared, then the real migration is applied.
    await db.foodItem.deleteMany()
    await db.$executeRawUnsafe(migration)

    await t.test(
      'sequential duplicate and case/space variants return 409 before image upload',
      async () => {
        await service.create({ name: ' QA19-dup ', category: ' Hús ' }, userId)
        for (const name of ['QA19-dup', 'QA19-dup', 'qa19-DUP ']) {
          await assert.rejects(
            service.create({ name, category: 'hÚs' }, userId, image),
            isDuplicate,
          )
        }
        assert.equal(await db.foodItem.count(), 1)
        assert.equal(await db.auditLog.count(), 1)
        assert.equal(storage.uploadFoodImage.mock.callCount(), 0)
        assert.equal(storage.deleteFileByUrl.mock.callCount(), 0)
      },
    )

    await t.test('absent, null, empty and space-only categories are equivalent', async () => {
      await service.create({ name: 'Rice' }, userId)
      for (const category of [null, '', '   ']) {
        await assert.rejects(
          service.create({ name: 'rice ', category: category ?? undefined }, userId),
          isDuplicate,
        )
        await assert.rejects(db.foodItem.create({ data: { name: 'RICE', category } }), (error) => {
          assert.ok(error instanceof Prisma.PrismaClientKnownRequestError)
          assert.equal(error.code, 'P2002')
          return true
        })
      }
      assert.equal(await db.foodItem.count(), 1)
    })

    await t.test(
      'different categories, literal wildcard characters and PRODUCT duplicates remain allowed',
      async () => {
        for (const category of ['First', 'Second']) {
          await service.create({ name: 'Same', category }, userId)
        }
        for (const name of ['Rice_', 'Rice%', "O'Brien"]) {
          await service.create({ name, category: 'First' }, userId)
        }
        await service.create(
          { name: 'Same', category: 'First', type: FoodItemType.PRODUCT },
          userId,
        )
        await service.create(
          { name: 'same ', category: 'first', type: FoodItemType.PRODUCT },
          userId,
        )
        assert.equal(await db.foodItem.count(), 7)
      },
    )

    await t.test(
      'updates exclude self but reject duplicate names, categories and conversion to BASIC',
      async () => {
        const first = await service.create({ name: 'First', category: 'One' }, userId)
        const second = await service.create({ name: 'Second', category: 'One' }, userId)
        const third = await service.create({ name: 'First', category: 'Two' }, userId)
        const product = await service.create(
          { name: 'First', category: 'One', type: FoodItemType.PRODUCT },
          userId,
        )
        await service.update(first.id, { name: ' first ', category: ' ONE ' }, userId)
        const auditsBefore = await db.auditLog.count()
        await assert.rejects(service.update(second.id, { name: 'FIRST' }, userId), isDuplicate)
        await assert.rejects(service.update(third.id, { category: 'one' }, userId), isDuplicate)
        await assert.rejects(
          service.update(product.id, { type: FoodItemType.BASIC }, userId),
          isDuplicate,
        )
        assert.equal(await db.auditLog.count(), auditsBefore)
        assert.equal(
          (await db.foodItem.findUniqueOrThrow({ where: { id: second.id } })).name,
          'Second',
        )
        // Direct writes also cannot bypass the constraint.
        await assert.rejects(
          db.foodItem.update({ where: { id: second.id }, data: { name: 'first' } }),
          (error) => {
            assert.ok(error instanceof Prisma.PrismaClientKnownRequestError)
            assert.equal(error.code, 'P2002')
            return true
          },
        )
      },
    )

    await t.test(
      'concurrent creates commit one food and audit, return 409 and clean up the losing image',
      async () => {
        let release!: () => void
        const bothUploaded = new Promise<void>((resolve) => {
          release = resolve
        })
        let uploads = 0
        storage.uploadFoodImage.mock.mockImplementation(async () => {
          const url = `https://images.example/${randomUUID()}.png`
          if (++uploads === 2) release()
          await bothUploaded
          return { url }
        })

        const results = await Promise.allSettled([
          service.create({ name: 'Concurrent', category: 'Race' }, userId, image),
          service.create({ name: 'concurrent ', category: ' RACE ' }, userId, image),
        ])

        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
        const rejected = results.find((result) => result.status === 'rejected')
        assert.ok(rejected && rejected.status === 'rejected')
        isDuplicate(rejected.reason)
        const saved = await db.foodItem.findMany()
        assert.equal(saved.length, 1)
        const audits = await db.auditLog.findMany()
        assert.equal(audits.length, 1)
        assert.equal(audits[0].recordId, saved[0].id)
        assert.equal(audits[0].action, 'CREATE')
        assert.equal(storage.deleteFileByUrl.mock.callCount(), 1)
        assert.notEqual(storage.deleteFileByUrl.mock.calls[0].arguments[0], saved[0].imageUrl)
      },
    )

    await t.test('EAN conflicts keep their own message on create and update', async () => {
      await service.create(
        { name: 'EAN first', eanBarcode: '12345', type: FoodItemType.PRODUCT },
        userId,
      )
      const second = await service.create(
        { name: 'EAN second', type: FoodItemType.PRODUCT },
        userId,
      )
      for (const operation of [
        () =>
          service.create(
            { name: 'EAN third', eanBarcode: '12345', type: FoodItemType.PRODUCT },
            userId,
          ),
        () => service.update(second.id, { eanBarcode: '12345' }, userId),
      ]) {
        await assert.rejects(operation(), (error) => {
          assert.ok(error instanceof ConflictException)
          assert.equal(error.getStatus(), 409)
          assert.equal(error.message, 'Ez az EAN vonalkód már létezik.')
          return true
        })
      }
    })
  },
)
