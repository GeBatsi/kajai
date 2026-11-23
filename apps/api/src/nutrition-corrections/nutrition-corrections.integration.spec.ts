import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { ValidationPipe } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import cookieParser from 'cookie-parser'
import { Role } from '@kajai/db'
import { NextAuthGuard } from '../auth/guards/nextauth.guard'
import { RolesGuard } from '../auth/guards/role.guard'
import { PrismaService } from '../prisma/prisma.service'
import { correctionTestStore } from './corrections-test-store.spec'
import { NutritionCorrectionModerationController, NutritionCorrectionSubmissionController, OwnNutritionCorrectionsController } from './nutrition-corrections.controller'
import { NutritionCorrectionsService } from './nutrition-corrections.service'
import { CorrectionBodyInterceptor } from './correction-body.interceptor'

const secret = 'nutrition-correction-http-test-secret'
const origin = 'http://localhost:4000'
const { encode } = createRequire(resolve(__dirname, '../../../web/package.json'))('next-auth/jwt') as {
  encode: (params: { token: Record<string, unknown>; secret: string }) => Promise<string>
}

async function application(rateLimit = false) {
  const v = correctionTestStore()
  const builder = Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
    controllers: [NutritionCorrectionSubmissionController, OwnNutritionCorrectionsController, NutritionCorrectionModerationController],
    providers: [
      CorrectionBodyInterceptor,
      { provide: NutritionCorrectionsService, useValue: v.service },
      { provide: PrismaService, useValue: v.prisma },
      { provide: ConfigService, useValue: { get: (key: string) => ({ NEXTAUTH_SECRET: secret, NEXTAUTH_URL: origin })[key] } },
      { provide: APP_GUARD, useClass: NextAuthGuard }, { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
  if (!rateLimit) builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })
  const module = await builder.compile()
  const app = module.createNestApplication({ logger: false })
  app.use(cookieParser()); app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  await app.listen(0, '127.0.0.1')
  const base = `${await app.getUrl()}/api`
  const request = async (path: string, method = 'GET', body?: unknown, actor: string | null = 'user', badCookie = false, requestOrigin = origin) => {
    const cookie = actor ? `kajai-session=${badCookie ? 'invalid' : await encode({ token: { userId: actor, role: 'ADMIN' }, secret })}` : null
    return fetch(`${base}${path}`, { method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'x-user-role': 'ADMIN', 'x-user-id': 'admin', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  return { ...v, app, request }
}

test('nutrition correction HTTP API uses real global session/RBAC guards, DTOs and service workflow', async (t) => {
  const v = await application(); t.after(() => v.app.close())
  const body = { nutrition: { protein: 31 }, reason: 'Gyártói adatlap.' }
  const baseFood = structuredClone(v.foods.get('food'))
  const reset = () => { v.corrections.clear(); v.audits.splice(0); v.foods.set('food', structuredClone(baseFood)); v.users.get('user').role = Role.USER; v.users.get('user').bannedAt = null }

  for (const actor of ['user', 'mod', 'admin']) await t.test(`${actor} can submit and only sees their own proposals`, async () => {
    reset()
    const response = await v.request('/foods/food/nutrition-corrections', 'POST', body, actor)
    assert.equal(response.status, 201); const row = await response.json() as any
    assert.equal(row.submittedById, actor); assert.equal(row.status, 'PENDING')
    const mine = await v.request('/nutrition-corrections/mine', 'GET', undefined, actor)
    assert.equal(mine.status, 200); assert.equal((await mine.json() as any).meta.total, 1)
    assert.equal((await (await v.request('/nutrition-corrections/mine', 'GET', undefined, actor === 'other' ? 'user' : 'other')).json() as any).meta.total, 0)
    assert.deepEqual(v.foods.get('food'), baseFood)
  })

  for (const endpoint of ['/foods/food/nutrition-corrections', '/nutrition-corrections/mine', '/moderation/nutrition-corrections', '/moderation/nutrition-corrections/missing', '/moderation/nutrition-corrections/missing/approve', '/moderation/nutrition-corrections/missing/reject']) {
    const post = endpoint.includes('/foods/') || /\/(approve|reject)$/.test(endpoint)
    for (const mode of ['anonymous', 'invalid', 'guest', 'banned']) await t.test(`${mode} cannot access ${endpoint}`, async () => {
      reset(); v.users.get('user').role = mode === 'guest' ? Role.GUEST : Role.USER
      if (mode === 'banned') v.users.get('user').bannedAt = new Date()
      const response = await v.request(endpoint, post ? 'POST' : 'GET', post ? body : undefined, mode === 'anonymous' ? null : 'user', mode === 'invalid')
      assert.equal(response.status, mode === 'anonymous' || mode === 'invalid' ? 401 : 403)
      assert.equal(v.corrections.size, 0)
    })
  }

  for (const endpoint of ['', '/missing', '/missing/approve', '/missing/reject']) await t.test(`USER cannot moderate ${endpoint || 'list'} with forged role/actor headers`, async () => {
    reset(); const post = /\/(approve|reject)$/.test(endpoint)
    assert.equal((await v.request(`/moderation/nutrition-corrections${endpoint}`, post ? 'POST' : 'GET', post ? {} : undefined)).status, 403)
  })

  for (const extra of ['actorId', 'submittedById', 'reviewedById', 'status', 'name', 'allergens', 'imageUrl']) await t.test(`submission rejects forged/unknown field ${extra}`, async () => {
    reset(); assert.equal((await v.request('/foods/food/nutrition-corrections', 'POST', { ...body, [extra]: 'forged' })).status, 400)
  })
  for (const invalid of [{ nutrition: { unknown: 1 } }, { nutrition: { protein: -1 } }, { nutrition: { sugar: 31 } }, { nutrition: { saturatedFat: 6 } }, { nutrition: { per: 50 } }, { nutrition: { unit: 'ml' } }, { nutrition: null }, { nutrition: [] }, { nutrition: '{}' }, { reason: '  ' }, { reason: 'x'.repeat(1001) }]) await t.test(`DTO/nutrition validation rejects ${JSON.stringify(invalid).slice(0, 65)}`, async () => {
    reset(); assert.equal((await v.request('/foods/food/nutrition-corrections', 'POST', { ...body, ...invalid })).status, 400)
    assert.equal(v.corrections.size, 0)
  })

  await t.test('unknown query parameters, role coercion and invalid paging/dates are rejected', async () => {
    reset()
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'limit=abc', 'status=UNKNOWN', 'submittedById=other', 'actorId=admin']) {
      assert.equal((await v.request(`/nutrition-corrections/mine?${query}`)).status, 400)
    }
    for (const query of ['submittedFrom=wrong', 'submittedTo=wrong', 'submittedFrom=2030-01-01&submittedTo=2020-01-01', 'foodItemId=']) {
      assert.equal((await v.request(`/moderation/nutrition-corrections?${query}`, 'GET', undefined, 'mod')).status, 400)
    }
  })

  await t.test('raw nutrition keys cannot disappear through class-transformer before validation', async () => {
    reset()
    for (const key of ['constructor', '__proto__', 'prototype']) {
      const nutrition = JSON.parse(`{"protein":31,"${key}":{}}`)
      assert.equal((await v.request('/foods/food/nutrition-corrections', 'POST', { ...body, nutrition })).status, 400)
    }
    assert.equal(v.corrections.size, 0)
  })

  for (const reviewer of ['mod', 'admin']) await t.test(`${reviewer} can list, inspect, approve or reject with actual state/audits`, async () => {
    reset()
    const row = await v.service.submit('food', body, 'user')
    const list = await v.request('/moderation/nutrition-corrections?status=PENDING&foodItemId=food&page=1&limit=20', 'GET', undefined, reviewer)
    assert.equal(list.status, 200); assert.equal((await list.json() as any).meta.total, 1)
    const detail = await v.request(`/moderation/nutrition-corrections/${row.id}`, 'GET', undefined, reviewer)
    assert.equal(detail.status, 200); assert.equal((await detail.json() as any).canApprove, true)
    for (const route of ['approve', 'reject']) {
      assert.equal((await v.request(`/moderation/nutrition-corrections/${row.id}/${route}`, 'POST', { actorId: 'user', reason: 'x' }, reviewer)).status, 400)
    }
    const response = await v.request(`/moderation/nutrition-corrections/${row.id}/approve`, 'POST', {}, reviewer)
    assert.equal(response.status, 200); const approved = await response.json() as any
    assert.equal(approved.status, 'APPROVED'); assert.equal(approved.reviewedById, reviewer)
    assert.ok(!JSON.stringify(approved).includes('SECRET_HASH')); assert.ok(!JSON.stringify(approved).includes('PRIVATE'))
    assert.equal((await v.request(`/moderation/nutrition-corrections/${row.id}/approve`, 'POST', {}, reviewer)).status, 409)
    const next = await v.service.submit('food', { ...body, nutrition: { protein: 29 } }, 'user')
    const reject = await v.request(`/moderation/nutrition-corrections/${next.id}/reject`, 'POST', { reason: '  Nem igazolható.  ' }, reviewer)
    assert.equal(reject.status, 200); assert.equal((await reject.json() as any).rejectionReason, 'Nem igazolható.')
    assert.equal((await v.request(`/moderation/nutrition-corrections/${next.id}/reject`, 'POST', { reason: 'x' }, reviewer)).status, 409)
  })

  await t.test('self decisions, duplicates, stale foods, missing targets and invalid Origin retain exact error semantics', async () => {
    reset()
    const own = await v.service.submit('food', body, 'mod')
    for (const route of ['approve', 'reject']) assert.equal((await v.request(`/moderation/nutrition-corrections/${own.id}/${route}`, 'POST', route === 'approve' ? {} : { reason: 'x' }, 'mod')).status, 403)
    assert.equal((await v.request('/foods/food/nutrition-corrections', 'POST', body, 'mod')).status, 409)
    v.foods.get('food').updatedAt = new Date('2030-01-01')
    assert.equal((await v.request(`/moderation/nutrition-corrections/${own.id}/approve`, 'POST', {}, 'admin')).status, 409)
    assert.equal(v.corrections.get(own.id).status, 'PENDING')
    assert.equal((await v.request('/foods/missing/nutrition-corrections', 'POST', body)).status, 404)
    assert.equal((await v.request('/moderation/nutrition-corrections/missing', 'GET', undefined, 'mod')).status, 404)
    assert.equal((await v.request('/moderation/nutrition-corrections/missing/approve', 'POST', {}, 'mod')).status, 404)
    assert.equal((await v.request('/foods/food/nutrition-corrections', 'POST', body, 'user', false, 'https://untrusted.invalid')).status, 403)
  })
})

test('submission alone has a real targeted 10/minute Throttler guard', async (t) => {
  const v = await application(true); t.after(() => v.app.close())
  for (let i = 0; i < 10; i++) assert.equal((await v.request('/foods/missing/nutrition-corrections', 'POST', { nutrition: { protein: 31 }, reason: 'x' })).status, 404)
  assert.equal((await v.request('/foods/missing/nutrition-corrections', 'POST', { nutrition: { protein: 31 }, reason: 'x' })).status, 429)
  assert.equal((await v.request('/nutrition-corrections/mine')).status, 200)
})
