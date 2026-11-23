import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { ConflictException } from '@nestjs/common'
import { Role } from '@kajai/db'
import { UsersService } from './users.service'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { MailTokenService } from '../mail-token/mail-token.service'
import { TokenService } from '../token/token.service'
import { isolatedPostgres } from '../test-support/isolated-postgres.spec'

const databaseUrl = process.env.USERS_TEST_DATABASE_URL
test('user management with isolated PostgreSQL: migrations, cascades, rollback and real locks', {
  skip: databaseUrl ? false : 'USERS_TEST_DATABASE_URL nincs megadva; kizárólag külön tesztadatbázis használható.',
  timeout: 120000,
}, async (t) => {
  const { db } = await isolatedPostgres(t, databaseUrl!, 'kai77_users_test')
  const prisma = db as unknown as PrismaService
  const service = new UsersService(prisma, {} as MailTokenService, {} as TokenService, new AuditService(prisma))
  const createUser = (role: Role = Role.USER) => db.user.create({ data: { email: `${randomUUID()}@test.invalid`, role, profile: { create: {} } } })
  const actor = await createUser(Role.ADMIN)
  const recipe = async (ownerId: string) => db.recipe.create({ data: { ownerId, name: 'Test recipe', steps: [] } })

  await t.test('all owned data cascades while historical and new audits survive', async () => {
    const target = await createUser()
    const other = await createUser()
    const food = await db.foodItem.create({ data: { name: `Food ${randomUUID()}` } })
    const owned = await recipe(target.id)
    const nested = await recipe(target.id)
    await db.recipeIngredient.create({ data: { recipeId: owned.id, childRecipeId: nested.id, amount: 1, unit: 'g' } })
    await db.mealLog.create({ data: { userId: target.id, recipeId: owned.id, date: new Date(), mealType: 'BREAKFAST', amount: 1 } })
    await db.mealLog.create({ data: { userId: other.id, foodItemId: food.id, date: new Date(), mealType: 'BREAKFAST', amount: 2 } })
    await db.weightLog.create({ data: { userId: target.id, date: new Date(), weightKg: 70 } })
    await db.activityLog.create({ data: { userId: target.id, date: new Date(), source: 'test' } })
    await db.inventoryItem.create({ data: { userId: target.id, foodItemId: food.id, quantity: 1, unit: 'g' } })
    await db.favorite.create({ data: { userId: target.id, recipeId: owned.id, type: 'RECIPE' } })
    await db.mailToken.create({ data: { userId: target.id, mailToken: randomUUID(), type: 'PASSWORD_RESET' } })
    const historic = await db.auditLog.create({ data: { tableName: 'users', recordId: target.id, userId: target.id, action: 'UPDATE', newValue: { role: 'USER' } } })
    await service.remove(target.id, actor.id)
    assert.equal(await db.user.findUnique({ where: { id: target.id } }), null)
    const where = { userId: target.id }
    const counts = await Promise.all([
      db.userProfile.count({ where }), db.mealLog.count({ where }), db.weightLog.count({ where }),
      db.activityLog.count({ where }), db.inventoryItem.count({ where }),
      db.favorite.count({ where }), db.mailToken.count({ where }),
    ])
    counts.forEach((count) => assert.equal(count, 0))
    assert.equal(await db.recipe.count({ where: { ownerId: target.id } }), 0)
    assert.equal(await db.recipeIngredient.count({ where: { recipeId: owned.id } }), 0)
    assert.equal(await db.mealLog.count({ where: { userId: other.id } }), 1)
    assert.ok(await db.auditLog.findUnique({ where: { id: historic.id } }))
    const deletion = await db.auditLog.findFirstOrThrow({ where: { recordId: target.id, action: 'DELETE' } })
    assert.equal(deletion.userId, actor.id)
    assert.deepEqual(deletion.oldValue, { role: 'USER', bannedAt: null })
  })

  for (const reference of ['meal', 'favorite', 'recipe'] as const) {
    await t.test(`external ${reference} references reject deletion without nulling other users' data`, async () => {
      const target = await createUser()
      const other = await createUser()
      const owned = await recipe(target.id)
      if (reference === 'meal') await db.mealLog.create({ data: { userId: other.id, recipeId: owned.id, date: new Date(), mealType: 'LUNCH', amount: 1 } })
      if (reference === 'favorite') await db.favorite.create({ data: { userId: other.id, recipeId: owned.id, type: 'RECIPE' } })
      if (reference === 'recipe') {
        const parent = await recipe(other.id)
        await db.recipeIngredient.create({ data: { recipeId: parent.id, childRecipeId: owned.id, amount: 1, unit: 'g' } })
      }
      await assert.rejects(service.remove(target.id, actor.id), ConflictException)
      assert.ok(await db.recipe.findUnique({ where: { id: owned.id } }))
      assert.equal(await db.auditLog.count({ where: { recordId: target.id, action: 'DELETE' } }), 0)
      if (reference === 'meal') assert.equal(await db.mealLog.count({ where: { userId: other.id, recipeId: owned.id } }), 1)
      if (reference === 'favorite') assert.equal(await db.favorite.count({ where: { userId: other.id, recipeId: owned.id } }), 1)
      if (reference === 'recipe') assert.equal(await db.recipeIngredient.count({ where: { childRecipeId: owned.id } }), 1)
    })
  }

  for (const action of ['role', 'ban', 'unban', 'delete', 'create'] as const) {
    await t.test(`real PostgreSQL rolls back ${action} when audit creation fails`, async () => {
      const target = await createUser()
      if (action === 'unban') await db.user.update({ where: { id: target.id }, data: { bannedAt: new Date(), banReason: 'Original' } })
      const before = await db.user.findUniqueOrThrow({ where: { id: target.id } })
      const failingAudit = { logWithTx: async () => { throw new Error('forced audit failure') } } as unknown as AuditService
      const failing = new UsersService(prisma, {} as MailTokenService, {} as TokenService, failingAudit)
      const email = `${randomUUID()}@test.invalid`
      const operation = action === 'role' ? failing.updateRole(target.id, Role.MODERATOR, actor.id)
        : action === 'ban' ? failing.ban(target.id, 'Reason', actor.id)
          : action === 'unban' ? failing.unban(target.id, actor.id)
            : action === 'create' ? failing.createAdmin({ email, role: Role.ADMIN }, actor.id) : failing.remove(target.id, actor.id)
      await assert.rejects(operation, /forced audit failure/)
      assert.deepEqual(await db.user.findUnique({ where: { id: target.id } }), before)
      assert.equal(await db.auditLog.count({ where: { recordId: target.id } }), 0)
      assert.equal(await db.user.count({ where: { email } }), 0)
    })
  }

  for (const action of ['role', 'ban', 'delete', 'mixed'] as const) {
    await t.test(`real concurrent ${action} cannot remove both active admins`, async () => {
      await db.user.updateMany({ data: { role: Role.USER } })
      const first = await createUser(Role.ADMIN)
      const second = await createUser(Role.ADMIN)
      const one = action === 'role' ? service.updateRole(second.id, Role.USER, first.id)
        : action === 'ban' ? service.ban(second.id, 'Reason', first.id) : service.remove(second.id, first.id)
      const two = action === 'role' || action === 'mixed' ? service.updateRole(first.id, Role.USER, second.id)
        : action === 'ban' ? service.ban(first.id, 'Reason', second.id) : service.remove(first.id, second.id)
      const results = await Promise.allSettled([one, two])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      assert.equal(await db.user.count({ where: { role: Role.ADMIN, bannedAt: null } }), 1)
    })
  }
})
