import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { ConflictException, ForbiddenException } from '@nestjs/common'
import { Prisma, Role } from '@kajai/db'
import { AuditService } from '../audit/audit.service'
import { WriteAuditLogParams } from '../audit/audit.types'
import { FoodsService } from '../foods/foods.service'
import { StorageService } from '../storage/storage.service'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import { MailTokenService } from '../mail-token/mail-token.service'
import { TokenService } from '../token/token.service'
import { isolatedPostgres } from '../test-support/isolated-postgres.spec'
import { NutritionCorrectionsService } from './nutrition-corrections.service'

const databaseUrl = process.env.NUTRITION_CORRECTIONS_TEST_DATABASE_URL

test('nutrition correction workflow with isolated PostgreSQL: migrations, row locks, rollback and retention', {
  skip: databaseUrl ? false : 'NUTRITION_CORRECTIONS_TEST_DATABASE_URL nincs megadva; a valódi PostgreSQL tesztek KIHAGYVA.',
  timeout: 240000,
}, async (t) => {
  const { db, schema } = await isolatedPostgres(t, databaseUrl!, 'kai77_nutrition_test')
  const prisma = db as unknown as PrismaService
  const audit = new AuditService(prisma)
  const storage = { deleteFileByUrl: async () => {} } as unknown as StorageService
  const foods = new FoodsService(prisma, audit, storage); foods['logger'].error = () => undefined
  const service = new NutritionCorrectionsService(prisma, audit, foods)
  const users = new UsersService(prisma, {} as MailTokenService, {} as TokenService, audit)
  const makeUser = (role: Role = Role.USER) => db.user.create({ data: { email: `${randomUUID()}@test.invalid`, role, profile: { create: {} } } })
  const submitter = await makeUser(); const other = await makeUser(); const moderator = await makeUser(Role.MODERATOR); const admin = await makeUser(Role.ADMIN)
  const nutrition = { energyKcal: 180, protein: 20, carbs: 30, sugar: 3, fat: 5, saturatedFat: 1, per: 100, unit: 'g' }
  const food = () => foods.create({ name: `Nutrition ${randomUUID()}`, nutrition, allergens: { milk: false } }, moderator.id)
  const proposal = { nutrition: { protein: 31, fat: 3.6 }, reason: 'Gyártói adatlap.' }
  const submit = async (actorId = submitter.id) => { const item = await food(); return { item, correction: await service.submit(item.id, proposal, actorId) } }
  class FailingAudit extends AuditService {
    constructor(private readonly failure: 'create' | 'food' | 'decision') { super(prisma) }
    override logWithTx(tx: Prisma.TransactionClient, params: WriteAuditLogParams) {
      if ((this.failure === 'food' && params.tableName === 'food_items') ||
        (params.tableName === 'food_nutrition_corrections' && params.action === (this.failure === 'create' ? 'CREATE' : 'UPDATE'))) throw new Error('forced audit failure')
      return super.logWithTx(tx, params)
    }
  }
  const failing = (failure: 'create' | 'food' | 'decision') => {
    const failedAudit = new FailingAudit(failure)
    return new NutritionCorrectionsService(prisma, failedAudit, new FoodsService(prisma, failedAudit, storage))
  }

  await t.test('new enum/table/indexes exist only in the checked test schema; reconnects keep raw row locks isolated', async () => {
    const rows = await db.$queryRaw<{ schema: string }[]>`SELECT n.nspname::text AS schema FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='NutritionCorrectionStatus' AND n.nspname=current_schema()`
    assert.deepEqual(rows, [{ schema }])
    await db.$disconnect()
    const { item, correction } = await submit()
    await db.$transaction(async (tx) => {
      const [actual] = await tx.$queryRaw<{ schema: string; path: string }[]>`SELECT current_schema()::text AS schema, current_setting('search_path') AS path`
      assert.equal(actual.schema, schema); assert.equal(actual.path, schema)
      await foods.lockForUpdate(tx, item.id)
    })
    assert.equal(correction.status, 'PENDING'); assert.deepEqual((await db.foodItem.findUniqueOrThrow({ where: { id: item.id } })).nutrition, nutrition)
  })

  await t.test('partial unique index rejects real concurrent duplicate submissions; different actors can submit', async () => {
    const item = await food()
    const results = await Promise.allSettled([service.submit(item.id, proposal, submitter.id), service.submit(item.id, proposal, submitter.id)])
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
    const rejected = results.find((row) => row.status === 'rejected') as PromiseRejectedResult
    assert.ok(rejected.reason instanceof ConflictException)
    // Bypass the service's preflight to prove the database index itself enforces the invariant.
    const existing = await db.foodNutritionCorrection.findFirstOrThrow({ where: { foodItemId: item.id } })
    await assert.rejects(db.foodNutritionCorrection.create({ data: { ...existing, id: randomUUID(), originalNutrition: existing.originalNutrition ?? Prisma.DbNull, proposedNutrition: existing.proposedNutrition! } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    await service.submit(item.id, proposal, other.id)
    assert.equal(await db.foodNutritionCorrection.count({ where: { foodItemId: item.id } }), 2)
  })

  await t.test('approval changes only nutrition, records reviewer and two audits, supports food history/restore', async () => {
    const { item, correction } = await submit()
    const approved = await service.approve(correction.id, moderator.id)
    assert.equal(approved.status, 'APPROVED'); assert.equal(approved.reviewedById, moderator.id); assert.ok(approved.reviewedAt)
    const saved = await db.foodItem.findUniqueOrThrow({ where: { id: item.id } })
    assert.deepEqual(saved.nutrition, correction.proposedNutrition); assert.equal(saved.name, item.name); assert.deepEqual(saved.allergens, item.allergens)
    const rows = await db.auditLog.findMany({ where: { tableName: 'food_items', recordId: item.id, action: 'UPDATE' } })
    assert.equal(rows.length, 1); assert.equal(rows[0].userId, moderator.id)
    assert.deepEqual((rows[0].oldValue as any).nutrition, item.nutrition); assert.deepEqual((rows[0].newValue as any).nutrition, correction.proposedNutrition)
    assert.equal(await db.auditLog.count({ where: { tableName: 'food_nutrition_corrections', recordId: correction.id } }), 2)
    const history = await foods.history(item.id, { limit: 20 })
    assert.ok(history.entries.some((entry) => entry.id === rows[0].id && entry.before?.canRestore && entry.after?.canRestore))
    await foods.restore(item.id, { auditId: rows[0].id, side: 'before', expectedUpdatedAt: history.current!.updatedAt.toISOString(), expectedLatestAuditId: history.current!.latestAuditId }, admin.id)
    assert.deepEqual((await db.foodItem.findUniqueOrThrow({ where: { id: item.id } })).nutrition, item.nutrition)
    await assert.rejects(service.approve(correction.id, admin.id), ConflictException)
  })

  await t.test('rejection leaves FoodItem intact, is audited, and releases the pending slot', async () => {
    const { item, correction } = await submit()
    const rejected = await service.reject(correction.id, '  Nem igazolható.  ', moderator.id)
    assert.equal(rejected.status, 'REJECTED'); assert.equal(rejected.rejectionReason, 'Nem igazolható.')
    assert.deepEqual(await db.foodItem.findUniqueOrThrow({ where: { id: item.id } }), item)
    await assert.rejects(service.reject(correction.id, 'Másodszor', admin.id), ConflictException)
    await service.submit(item.id, proposal, submitter.id)
  })

  for (const role of [Role.MODERATOR, Role.ADMIN]) await t.test(`${role} cannot approve/reject their own proposal`, async () => {
    const actor = role === Role.ADMIN ? admin : moderator
    const { correction } = await submit(actor.id)
    await assert.rejects(service.approve(correction.id, actor.id), ForbiddenException)
    await assert.rejects(service.reject(correction.id, 'Indok', actor.id), ForbiddenException)
  })

  await t.test('food changes including same-millisecond audited writes are stale and stay pending', async () => {
    const { item, correction } = await submit()
    await db.$transaction(async (tx) => {
      await foods.lockForUpdate(tx, item.id)
      // Same timestamp and same nutrition, but a new audited FoodItem version.
      await tx.foodItem.update({ where: { id: item.id }, data: { updatedAt: item.updatedAt, name: `${item.name} new` } })
      await audit.logWithTx(tx, { tableName: 'food_items', recordId: item.id, action: 'UPDATE', oldValue: item, newValue: { ...item, name: `${item.name} new` }, userId: admin.id })
    })
    assert.equal((await service.detail(correction.id, moderator.id)).isStale, true)
    await assert.rejects(service.approve(correction.id, moderator.id), ConflictException)
    assert.equal((await db.foodNutritionCorrection.findUniqueOrThrow({ where: { id: correction.id } })).status, 'PENDING')
  })

  await t.test('concurrent decisions on one correction commit exactly once', async () => {
    const { correction } = await submit()
    const results = await Promise.allSettled([service.approve(correction.id, moderator.id), service.reject(correction.id, 'Nem igazolható.', admin.id)])
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
    assert.ok((results.find((row) => row.status === 'rejected') as PromiseRejectedResult).reason instanceof ConflictException)
    assert.equal(await db.auditLog.count({ where: { tableName: 'food_nutrition_corrections', recordId: correction.id, action: 'UPDATE' } }), 1)
  })

  await t.test('competing proposals cannot overwrite each other when approved concurrently', async () => {
    const { item, correction } = await submit()
    const second = await service.submit(item.id, { nutrition: { protein: 29 }, reason: 'Más forrás.' }, other.id)
    const results = await Promise.allSettled([service.approve(correction.id, moderator.id), service.approve(second.id, admin.id)])
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
    assert.ok((results.find((row) => row.status === 'rejected') as PromiseRejectedResult).reason instanceof ConflictException)
    const winner = await db.foodNutritionCorrection.findFirstOrThrow({ where: { foodItemId: item.id, status: 'APPROVED' } })
    assert.deepEqual((await db.foodItem.findUniqueOrThrow({ where: { id: item.id } })).nutrition, winner.proposedNutrition)
    assert.equal(await db.foodNutritionCorrection.count({ where: { foodItemId: item.id, status: 'PENDING' } }), 1)
  })

  await t.test('direct concurrent partial food updates merge under the row lock without losing either patch', async () => {
    const item = await food()
    await Promise.all([foods.update(item.id, { nutrition: { protein: 25 } }, moderator.id), foods.update(item.id, { nutrition: { carbs: 35 } }, admin.id)])
    const saved = await db.foodItem.findUniqueOrThrow({ where: { id: item.id } })
    assert.deepEqual(saved.nutrition, { ...nutrition, protein: 25, carbs: 35 })
  })

  await t.test('approval versus direct update preserves the later direct patch or rejects the stale approval', async () => {
    const { item, correction } = await submit()
    const [approval, update] = await Promise.allSettled([service.approve(correction.id, moderator.id), foods.update(item.id, { nutrition: { fat: 6 } }, admin.id)])
    assert.equal(update.status, 'fulfilled')
    const saved = await db.foodItem.findUniqueOrThrow({ where: { id: item.id } })
    assert.equal((saved.nutrition as any).fat, 6)
    assert.equal((saved.nutrition as any).protein, approval.status === 'fulfilled' ? 31 : 20)
    if (approval.status === 'rejected') assert.ok(approval.reason instanceof ConflictException)
  })

  await t.test('approval versus restore uses the same row lock and permits only a current-version writer', async () => {
    const { item, correction } = await submit()
    const history = await foods.history(item.id, { limit: 20 })
    const results = await Promise.allSettled([
      service.approve(correction.id, moderator.id),
      foods.restore(item.id, { auditId: history.entries[0].id, side: 'after', expectedUpdatedAt: history.current!.updatedAt.toISOString(), expectedLatestAuditId: history.current!.latestAuditId }, admin.id),
    ])
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
    assert.ok((results.find((row) => row.status === 'rejected') as PromiseRejectedResult).reason instanceof ConflictException)
  })

  for (const failure of ['food', 'decision'] as const) await t.test(`real approval rollback on ${failure} audit failure`, async () => {
    const { item, correction } = await submit()
    const count = await db.auditLog.count()
    await assert.rejects(failing(failure).approve(correction.id, moderator.id), /forced audit failure/)
    assert.deepEqual(await db.foodItem.findUniqueOrThrow({ where: { id: item.id } }), item)
    assert.equal((await db.foodNutritionCorrection.findUniqueOrThrow({ where: { id: correction.id } })).status, 'PENDING')
    assert.equal(await db.auditLog.count(), count)
  })

  await t.test('real submission/rejection audit failures roll back their correction writes', async () => {
    const item = await food()
    await assert.rejects(failing('create').submit(item.id, proposal, submitter.id), /forced audit failure/)
    assert.equal(await db.foodNutritionCorrection.count({ where: { foodItemId: item.id } }), 0)
    const correction = await service.submit(item.id, proposal, submitter.id)
    const count = await db.auditLog.count()
    await assert.rejects(failing('decision').reject(correction.id, 'Indok', moderator.id), /forced audit failure/)
    assert.equal((await db.foodNutritionCorrection.findUniqueOrThrow({ where: { id: correction.id } })).status, 'PENDING')
    assert.equal(await db.auditLog.count(), count)
  })

  await t.test('a database status-update failure rolls back the preceding FoodItem update and food audit', async () => {
    const { item, correction } = await submit(); const count = await db.auditLog.count()
    await db.$executeRawUnsafe(`CREATE FUNCTION kai77_fail_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced decision failure'; END; $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER kai77_fail_decision BEFORE UPDATE ON food_nutrition_corrections FOR EACH ROW EXECUTE FUNCTION kai77_fail_decision()`)
    try {
      await assert.rejects(service.approve(correction.id, moderator.id))
      assert.deepEqual(await db.foodItem.findUniqueOrThrow({ where: { id: item.id } }), item)
      assert.equal((await db.foodNutritionCorrection.findUniqueOrThrow({ where: { id: correction.id } })).status, 'PENDING')
      assert.equal(await db.auditLog.count(), count)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER kai77_fail_decision ON food_nutrition_corrections')
      await db.$executeRawUnsafe('DROP FUNCTION kai77_fail_decision()')
    }
  })

  await t.test('user management deletion nulls submitter/reviewer links, preserves decisions and all prior audits', async () => {
    const actor = await makeUser(); const reviewer = await makeUser(Role.MODERATOR)
    const { correction } = await submit(actor.id)
    await service.approve(correction.id, reviewer.id)
    const ids = (await db.auditLog.findMany({ where: { recordId: correction.id } })).map((row) => row.id)
    await users.remove(actor.id, admin.id); await users.remove(reviewer.id, admin.id)
    const saved = await db.foodNutritionCorrection.findUniqueOrThrow({ where: { id: correction.id } })
    assert.equal(saved.submittedById, null); assert.equal(saved.reviewedById, null); assert.equal(saved.status, 'APPROVED')
    assert.equal(await db.auditLog.count({ where: { id: { in: ids } } }), ids.length)
    assert.ok(!JSON.stringify(saved).includes(actor.email))
  })

  await t.test('deleted food leaves retained but unapprovable pending proposal; rejection and audit history remain available', async () => {
    const { item, correction } = await submit()
    await foods.remove(item.id, moderator.id)
    const saved = await db.foodNutritionCorrection.findUniqueOrThrow({ where: { id: correction.id } })
    assert.equal(saved.foodItemId, null); assert.equal(saved.status, 'PENDING')
    assert.equal((await service.detail(saved.id, moderator.id)).canApprove, false)
    await assert.rejects(service.approve(saved.id, moderator.id), ConflictException)
    await service.reject(saved.id, 'Az élelmiszert törölték.', moderator.id)
    assert.equal(await db.auditLog.count({ where: { tableName: 'food_items', recordId: item.id } }), 2)
  })
})
