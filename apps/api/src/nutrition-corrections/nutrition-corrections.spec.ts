import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { NutritionCorrectionStatus, Prisma, Role } from '@kajai/db'
import { correctionTestStore } from './corrections-test-store.spec'
import { NutritionCorrectionsService } from './nutrition-corrections.service'

const proposal = { nutrition: { protein: 31, fat: 3.6 }, reason: '  Gyártói adatlap alapján.  ' }
const httpError = (status: number) => (error: unknown) => error instanceof HttpException && error.getStatus() === status

for (const actor of ['user', 'mod', 'admin']) test(`${actor} submits a snapshot without changing FoodItem or exposing private user data`, async () => {
  const v = correctionTestStore(); const before = structuredClone(v.foods.get('food'))
  const row = await v.service.submit('food', proposal, actor)
  assert.equal(row.status, 'PENDING'); assert.equal(row.submittedById, actor)
  assert.equal(row.reason, proposal.reason.trim()); assert.deepEqual(row.originalNutrition, before.nutrition)
  assert.deepEqual(row.proposedNutrition, { ...before.nutrition, ...proposal.nutrition })
  assert.deepEqual(v.foods.get('food'), before); assert.equal(v.audits.length, 1)
  assert.equal(v.audits[0].userId, actor); assert.equal(v.audits[0].recordId, row.id)
  assert.ok(!JSON.stringify(row).includes('SECRET_HASH')); assert.ok(!JSON.stringify(row).includes('PRIVATE'))
})

for (const [label, nutrition] of [
  ['negative', { protein: -1 }], ['NaN', { fat: NaN }], ['infinite', { protein: Infinity }],
  ['over 100', { sugar: 101 }], ['energy over 900', { energyKcal: 901 }], ['numeric string', { protein: '31' }],
  ['unknown key', { kcal: 165 }], ['wrong per', { per: 50 }], ['wrong unit', { unit: 'kg' }],
  ['unit conversion', { unit: 'ml' }], ['sugar exceeds stored carbs', { sugar: 31 }],
  ['saturated fat exceeds stored fat', { saturatedFat: 6 }], ['total exceeds 100', { protein: 80 }],
  ['null object', null], ['array', []], ['string object', '{}'], ['empty', {}],
  ['unchanged', { protein: 20 }],
] as const) test(`submission rejects ${label}`, async () => {
  const v = correctionTestStore()
  await assert.rejects(v.service.submit('food', { ...proposal, nutrition: nutrition as any }, 'user'), BadRequestException)
  assert.equal(v.corrections.size, 0); assert.equal(v.audits.length, 0)
})

for (const reason of ['', '   ', 'x'.repeat(1001), null]) test(`submission/rejection reject invalid reason ${String(reason).slice(0, 12)}`, async () => {
  const v = correctionTestStore()
  await assert.rejects(v.service.submit('food', { ...proposal, reason: reason as string }, 'user'), BadRequestException)
  await assert.rejects(v.service.reject('none', reason as string, 'mod'), BadRequestException)
})

test('explicit null and zero override only the requested nutrient; legacy aliases normalize', async () => {
  const v = correctionTestStore(); v.foods.get('food').nutrition = { kcal: 180, proteinG: 20, carbsG: 10, fatG: 5 }
  const row = await v.service.submit('food', { ...proposal, nutrition: { protein: null, energyKcal: 0 } }, 'user')
  assert.deepEqual(row.proposedNutrition, { energyKcal: 0, protein: null, carbs: 10, fat: 5 })
  assert.deepEqual(row.originalNutrition, { kcal: 180, proteinG: 20, carbsG: 10, fatG: 5 })
})

test('unknown stored metadata cannot silently be dropped or proposed as nutrition', async () => {
  const v = correctionTestStore(); v.foods.get('food').nutrition.source = 'legacy metadata'
  await assert.rejects(v.service.submit('food', proposal, 'user'), BadRequestException)
})

test('missing food is 404; missing/guest/banned actors fail closed inside the write transaction', async () => {
  const v = correctionTestStore()
  await assert.rejects(v.service.submit('missing', proposal, 'user'), NotFoundException)
  for (const actor of [null, { role: Role.GUEST, bannedAt: null }, { role: Role.ADMIN, bannedAt: new Date() }]) {
    if (actor) v.users.set('bad', actor)
    else v.users.delete('bad')
    await assert.rejects(v.service.submit('food', proposal, 'bad'), ForbiddenException)
    await assert.rejects(v.service.approve('missing', 'bad'), ForbiddenException)
  }
})

test('one pending per actor/food, independent users allowed, decided rows do not block new submissions', async () => {
  const v = correctionTestStore(); const first = await v.service.submit('food', proposal, 'user')
  await assert.rejects(v.service.submit('food', proposal, 'user'), ConflictException)
  await v.service.submit('food', proposal, 'other')
  await v.service.reject(first.id, 'Nem igazolható.', 'mod')
  await v.service.submit('food', proposal, 'user')
  assert.equal(v.corrections.size, 3)
})

test('mine is actor-scoped and paginated; moderator filters are deterministic and default pending oldest first', async () => {
  const v = correctionTestStore(); const first = await v.service.submit('food', proposal, 'user')
  await v.service.submit('food', proposal, 'other'); await v.service.reject(first.id, 'Nem igazolható.', 'mod')
  const mine = await v.service.mine('user', { page: 1, limit: 20 })
  assert.equal(mine.meta.total, 1); assert.ok(mine.data.every((row) => row.submittedById === 'user'))
  assert.equal((await v.service.mine('user', { page: 1, limit: 20, status: NutritionCorrectionStatus.PENDING })).meta.total, 0)
  const pending = await v.service.list({ page: 1, limit: 1, foodItemId: 'food' })
  assert.equal(pending.data[0].submittedById, 'other'); assert.equal(pending.meta.total, 1)
  assert.equal((await v.service.list({ page: 2, limit: 1 })).data.length, 0)
  assert.equal((await v.service.list({ page: 1, limit: 20, submittedFrom: '2030-01-01T00:00:00Z' })).meta.total, 0)
  await assert.rejects(async () => v.service.list({ page: 1, limit: 20, submittedFrom: '2030-01-01', submittedTo: '2020-01-01' }), BadRequestException)
})

test('detail provides original/proposed/current nutrition and reports changed timestamps, audit versions or deleted foods', async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, 'user')
  const detail = await v.service.detail(row.id, 'mod')
  assert.equal(detail.canApprove, true); assert.equal(detail.isStale, false)
  assert.deepEqual(detail.currentFood!.nutrition, row.originalNutrition)
  v.audits.push({ tableName: 'food_items', recordId: 'food' })
  assert.equal((await v.service.detail(row.id, 'mod')).isStale, true)
  v.audits.pop(); v.foods.get('food').updatedAt = new Date('2027-01-01')
  assert.equal((await v.service.detail(row.id, 'mod')).canApprove, false)
  v.foods.delete('food'); v.corrections.get(row.id).foodItemId = null
  assert.equal((await v.service.detail(row.id, 'mod')).currentFood, null)
  await assert.rejects(v.service.approve(row.id, 'mod'), ConflictException)
  await assert.rejects(v.service.detail('missing', 'mod'), NotFoundException)
})

for (const scenario of [
  { status: 'APPROVED', food: 'changed', own: false, reason: 'A javaslatot már elbírálták.' },
  { status: 'APPROVED', food: 'changed', own: true, reason: 'A javaslatot már elbírálták.' },
  { status: 'APPROVED', food: 'deleted', own: true, reason: 'A javaslatot már elbírálták.' },
  { status: 'REJECTED', food: 'changed', own: false, reason: 'A javaslatot már elbírálták.' },
  { status: 'REJECTED', food: 'deleted', own: true, reason: 'A javaslatot már elbírálták.' },
  { status: 'REJECTED', food: 'unchanged', own: true, reason: 'A javaslatot már elbírálták.' },
  { status: 'PENDING', food: 'deleted', own: true, reason: 'Az élelmiszert törölték.' },
  { status: 'PENDING', food: 'changed', own: true, reason: 'Az élelmiszer a beküldés óta megváltozott.' },
  { status: 'PENDING', food: 'unchanged', own: true, reason: 'Saját javaslatot nem bírálhatsz el.' },
  { status: 'PENDING', food: 'unchanged', own: false, reason: null },
] as const) test(`detail reason priority: ${scenario.status}, ${scenario.food}, own=${scenario.own}`, async () => {
  const v = correctionTestStore()
  const row = await v.service.submit('food', proposal, 'mod')
  if (scenario.status === 'APPROVED') await v.service.approve(row.id, 'admin')
  if (scenario.status === 'REJECTED') await v.service.reject(row.id, 'Nem igazolható.', 'admin')
  if (scenario.food === 'changed') v.foods.get('food').updatedAt = new Date('2027-01-01')
  if (scenario.food === 'deleted') { v.foods.delete('food'); v.corrections.get(row.id).foodItemId = null }
  const snapshot = () => structuredClone({ users: v.users, foods: v.foods, corrections: v.corrections, audits: v.audits })
  const before = snapshot()
  const detail = await v.service.detail(row.id, scenario.own ? 'mod' : 'admin')
  assert.equal(detail.status, scenario.status)
  assert.equal(detail.approvalBlockedReason, scenario.reason)
  assert.equal(detail.canApprove, scenario.reason === null)
  assert.equal(detail.isStale, scenario.food !== 'unchanged')
  assert.deepEqual(snapshot(), before, 'The detail query must not write records or audit entries')
})

test('approval uses one transaction, updates only nutrition and writes two compatible audits; history and restore remain usable', async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, 'user')
  const before = structuredClone(v.foods.get('food')); const transactionCount = v.state.transactions
  const approved = await v.service.approve(row.id, 'mod')
  assert.equal(v.state.transactions, transactionCount + 1)
  assert.equal(approved.status, 'APPROVED'); assert.equal(approved.reviewedById, 'mod'); assert.ok(approved.reviewedAt)
  assert.deepEqual(v.foods.get('food').nutrition, row.proposedNutrition)
  assert.equal(v.foods.get('food').name, before.name); assert.deepEqual(v.foods.get('food').allergens, before.allergens)
  const foodAudit = v.audits.find((entry) => entry.tableName === 'food_items')
  assert.deepEqual(foodAudit.oldValue.nutrition, before.nutrition); assert.deepEqual(foodAudit.newValue.nutrition, row.proposedNutrition)
  assert.equal(foodAudit.userId, 'mod'); assert.equal(v.audits.length, 3)
  const history = await v.foodService.history('food', { limit: 20 })
  assert.equal(history.entries[0].before!.canRestore, true)
  await v.foodService.restore('food', { auditId: foodAudit.id, side: 'before', expectedUpdatedAt: history.current!.updatedAt.toISOString(), expectedLatestAuditId: history.current!.latestAuditId }, 'admin')
  assert.deepEqual(v.foods.get('food').nutrition, before.nutrition)
  await assert.rejects(v.service.approve(row.id, 'admin'), ConflictException)
})

for (const actor of ['mod', 'admin']) test(`${actor} cannot approve or reject their own proposal`, async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, actor)
  assert.equal((await v.service.detail(row.id, actor)).canApprove, false)
  await assert.rejects(v.service.approve(row.id, actor), ForbiddenException)
  await assert.rejects(v.service.reject(row.id, 'Nem igazolható.', actor), ForbiddenException)
})

test('approval rechecks a downgraded or banned reviewer and rejects missing records', async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, 'user')
  v.users.get('mod').role = Role.USER
  await assert.rejects(v.service.approve(row.id, 'mod'), ForbiddenException)
  v.users.get('admin').bannedAt = new Date()
  await assert.rejects(v.service.reject(row.id, 'Indok', 'admin'), ForbiddenException)
  await assert.rejects(v.service.approve('missing', 'other'), ForbiddenException)
  v.users.get('mod').role = Role.MODERATOR
  await assert.rejects(v.service.approve('missing', 'mod'), NotFoundException)
})

for (const change of ['timestamp', 'audit', 'nutrition']) test(`changed FoodItem ${change} blocks approval and keeps PENDING`, async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, 'user')
  if (change === 'timestamp') v.foods.get('food').updatedAt = new Date('2027-01-01')
  if (change === 'audit') v.audits.push({ tableName: 'food_items', recordId: 'food' })
  if (change === 'nutrition') v.foods.get('food').nutrition.protein = 21
  await assert.rejects(v.service.approve(row.id, 'mod'), ConflictException)
  assert.equal(v.corrections.get(row.id).status, 'PENDING')
})

test('approval revalidates the full stored proposal before touching FoodItem', async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, 'user')
  for (const proposed of [{ foo: 1 }, { sugar: 101 }, { carbs: 1, sugar: 2 }, { unit: 'ml' }, null]) {
    v.corrections.get(row.id).proposedNutrition = proposed
    await assert.rejects(v.service.approve(row.id, 'mod'), BadRequestException)
    assert.equal(v.corrections.get(row.id).status, 'PENDING'); assert.equal(v.audits.length, 1)
  }
})

for (const failure of ['food', 'food_items', 'correction', 'decision']) test(`approval rolls back all writes when ${failure} fails`, async () => {
  const v = correctionTestStore(); const row = await v.service.submit('food', proposal, 'user')
  const before = structuredClone({ food: v.foods.get('food'), row: v.corrections.get(row.id), audits: v.audits })
  v.state.failure = failure
  await assert.rejects(v.service.approve(row.id, 'mod'), /forced/)
  assert.deepEqual({ food: v.foods.get('food'), row: v.corrections.get(row.id), audits: v.audits }, before)
})

test('submission and rejection roll back when their audit fails; rejection otherwise leaves food unchanged', async () => {
  const v = correctionTestStore(); v.state.failure = 'food_nutrition_corrections'
  await assert.rejects(v.service.submit('food', proposal, 'user'), /forced audit/); assert.equal(v.corrections.size, 0)
  v.state.failure = ''; const row = await v.service.submit('food', proposal, 'user'); const food = structuredClone(v.foods.get('food'))
  v.state.failure = 'decision'; await assert.rejects(v.service.reject(row.id, 'Indok', 'mod'), /forced audit/)
  assert.equal(v.corrections.get(row.id).status, 'PENDING')
  v.state.failure = ''; const rejected = await v.service.reject(row.id, '  Nem igazolható.  ', 'admin')
  assert.equal(rejected.status, 'REJECTED'); assert.equal(rejected.rejectionReason, 'Nem igazolható.'); assert.equal(rejected.reviewedById, 'admin')
  assert.deepEqual(v.foods.get('food'), food)
  await assert.rejects(v.service.reject(row.id, 'Új indok', 'mod'), ConflictException)
  assert.equal(v.audits.at(-1).newValue.status, 'REJECTED')
})

for (const code of ['P2002', 'P2003', 'P2028', 'P2034', 'P2010']) test(`database race ${code} maps to 409`, async () => {
  const v = correctionTestStore()
  const prisma = { $transaction: async () => { throw new Prisma.PrismaClientKnownRequestError('race', { code, clientVersion: '5.22.0', meta: { code: '40P01' } }) } } as any
  const service = new NutritionCorrectionsService(prisma, v.audit, v.foodService)
  await assert.rejects(service.submit('food', proposal, 'user'), httpError(409))
})
