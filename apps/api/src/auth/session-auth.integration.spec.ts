import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { Controller, Get, UseGuards, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Role } from '@kajai/db'
import cookieParser from 'cookie-parser'
import { FoodsController } from '../foods/foods.controller'
import { FoodsService } from '../foods/foods.service'
import { IngredientsController } from '../ingredients/ingredients.controller'
import { IngredientsService } from '../ingredients/ingredients.service'
import { StoresController } from '../stores/stores.controller'
import { StoresService } from '../stores/stores.service'
import { ProductAvailabilityController } from '../product-availability/product-availability.controller'
import { ProductAvailabilityService } from '../product-availability/product-availability.service'
import { PrismaService } from '../prisma/prisma.service'
import { CurrentUser } from './decorators/current-user.decorator'
import { NextAuthGuard } from './guards/nextauth.guard'
import { RequestUser } from './types/request-user.type'

const { encode } = createRequire(resolve(__dirname, '../../../web/package.json'))(
  'next-auth/jwt',
) as {
  encode: (params: {
    token: Record<string, unknown>
    secret: string
    maxAge?: number
  }) => Promise<string>
}

@Controller('session-test')
class SessionTestController {
  @Get()
  @UseGuards(NextAuthGuard)
  currentUser(@CurrentUser() user: RequestUser) {
    return user
  }
}

test('real HTTP authorization on every formerly header-authenticated endpoint', async (t) => {
  const secret = 'http-test-session-secret-not-for-production'
  const origin = 'http://localhost:4000'
  const config: Record<string, string> = { NEXTAUTH_SECRET: secret, NEXTAUTH_URL: origin }
  let role: Role = Role.USER
  let userExists = true
  const calls: { area: string; method: string; args: unknown[] }[] = []
  const service = (area: string) =>
    Object.fromEntries(
      ['create', 'update', 'remove', 'updateImage', 'deleteImage', 'findAll'].map((method) => [
        method,
        async (...args: unknown[]) => {
          calls.push({ area, method, args })
          return method === 'findAll' ? [] : { id: 'test-record' }
        },
      ]),
    )
  const module = await Test.createTestingModule({
    controllers: [
      FoodsController,
      IngredientsController,
      StoresController,
      ProductAvailabilityController,
      SessionTestController,
    ],
    providers: [
      { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      {
        provide: PrismaService,
        useValue: {
          user: {
            findUnique: async ({ where }: { where: { id: string } }) => {
              assert.equal(where.id, 'real-user')
              return userExists ? { id: where.id, role } : null
            },
          },
        },
      },
      { provide: FoodsService, useValue: service('foods') },
      { provide: IngredientsService, useValue: service('ingredients') },
      { provide: StoresService, useValue: service('stores') },
      { provide: ProductAvailabilityService, useValue: service('product-availability') },
    ],
  }).compile()
  const app = module.createNestApplication({ logger: false })
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )
  await app.listen(0, '127.0.0.1')
  t.after(() => app.close())
  const base = await app.getUrl()
  const token = await encode({ token: { userId: 'real-user', role: 'ADMIN' }, secret })
  const cookie = `kajai-session=${token}`
  const routes = [
    { method: 'POST', path: '/foods', body: { name: 'Test food' }, status: 201 },
    { method: 'PATCH', path: '/foods/test-id', body: { name: 'Updated food' }, status: 200 },
    { method: 'DELETE', path: '/foods/test-id', status: 204 },
    { method: 'PATCH', path: '/foods/test-id/image', image: true, status: 200 },
    { method: 'DELETE', path: '/foods/test-id/image', status: 204 },
    { method: 'POST', path: '/ingredients', body: { foodItemId: 'food-id' }, status: 201 },
    { method: 'PATCH', path: '/ingredients/test-id', body: {}, status: 200 },
    { method: 'DELETE', path: '/ingredients/test-id', status: 204 },
    { method: 'POST', path: '/stores', body: { name: 'Test store' }, status: 201 },
    { method: 'PATCH', path: '/stores/test-id', body: {}, status: 200 },
    { method: 'DELETE', path: '/stores/test-id', status: 204 },
    {
      method: 'POST',
      path: '/product-availability',
      body: { foodItemId: 'food-id', storeId: 'store-id' },
      status: 201,
    },
    { method: 'PATCH', path: '/product-availability/test-id', body: {}, status: 200 },
    { method: 'DELETE', path: '/product-availability/test-id', status: 204 },
  ]

  for (const route of routes) {
    for (const scenario of ['forged headers only', 'USER', 'MODERATOR', 'ADMIN'] as const) {
      await t.test(`${route.method} ${route.path}: ${scenario}`, async () => {
        role = scenario === 'forged headers only' ? Role.ADMIN : Role[scenario]
        calls.length = 0
        const headers: Record<string, string> = {
          Origin: origin,
          'x-user-id': 'forged-user',
          'x-user-role': 'ADMIN',
          ...(scenario === 'forged headers only' ? {} : { Cookie: cookie }),
        }
        let body: string | FormData | undefined
        if (route.image) {
          const form = new FormData()
          form.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png')
          body = form
        } else if (route.body) {
          headers['Content-Type'] = 'application/json'
          body = JSON.stringify(route.body)
        }
        const response = await fetch(`${base}/api${route.path}`, {
          method: route.method,
          headers,
          body,
        })
        const expected =
          scenario === 'forged headers only'
            ? 401
            : scenario === 'ADMIN' || (scenario === 'MODERATOR' && route.path.startsWith('/foods'))
              ? route.status
              : 403
        const text = await response.text()
        assert.equal(response.status, expected, text)
        if (expected < 300) {
          assert.equal(calls.length, 1)
          assert.ok(
            calls[0].args.includes('real-user'),
            'service/audit receives the authenticated ID',
          )
          assert.ok(!calls[0].args.includes('forged-user'))
        } else {
          assert.equal(calls.length, 0, 'denied requests never reach business logic')
        }
      })
    }
  }

  await t.test('same session immediately loses permissions after a role downgrade', async () => {
    role = Role.ADMIN
    const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }
    const first = await fetch(`${base}/api/stores`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Allowed' }),
    })
    assert.equal(first.status, 201)
    await first.text()
    role = Role.USER
    const second = await fetch(`${base}/api/stores`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Denied' }),
    })
    assert.equal(second.status, 403)
    await second.text()
  })

  await t.test(
    'protected GET accepts a session without a token role and returns current DB identity',
    async () => {
      role = Role.MODERATOR
      const roleless = await encode({ token: { userId: 'real-user' }, secret })
      const response = await fetch(`${base}/api/session-test`, {
        headers: { Cookie: `kajai-session=${roleless}` },
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { id: 'real-user', role: Role.MODERATOR })
    },
  )

  await t.test('HTTP cookie parsing handles NextAuth-sized session chunks', async () => {
    const large = await encode({
      token: { userId: 'real-user', profile: 'x'.repeat(4000) },
      secret,
    })
    const parts: string[] = []
    for (let start = 0; start < large.length; start += 3933) {
      parts.push(`kajai-session.${parts.length}=${large.slice(start, start + 3933)}`)
    }
    const response = await fetch(`${base}/api/session-test`, {
      headers: { Cookie: parts.reverse().join('; ') },
    })
    assert.equal(response.status, 200)
    await response.text()
  })

  for (const requestOrigin of [undefined, 'https://attacker.example']) {
    await t.test(`valid cookie cannot authorize a write with Origin ${requestOrigin}`, async () => {
      role = Role.ADMIN
      calls.length = 0
      const response = await fetch(`${base}/api/foods`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
          ...(requestOrigin ? { Origin: requestOrigin } : {}),
        },
        body: JSON.stringify({ name: 'Cross-origin write' }),
      })
      assert.equal(response.status, 403)
      await response.text()
      assert.equal(calls.length, 0)
    })
  }

  for (const includeFields of [false, true]) {
    await t.test(
      `general food PATCH rejects an image before saving (fields: ${includeFields})`,
      async () => {
        role = Role.MODERATOR
        calls.length = 0
        const form = new FormData()
        form.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png')
        if (includeFields) {
          form.append('name', 'Must not be saved')
          form.append('nutrition', JSON.stringify({ protein: 25 }))
        }
        const response = await fetch(`${base}/api/foods/test-id`, {
          method: 'PATCH',
          headers: { Cookie: cookie, Origin: origin },
          body: form,
        })
        assert.equal(response.status, 400)
        assert.equal(
          ((await response.json()) as { message: string }).message,
          'A képet külön kell menteni. Használd a Kép mentése gombot.',
        )
        assert.equal(calls.length, 0, 'neither data nor image saving may start')
      },
    )
  }

  await t.test('general food PATCH still accepts multipart fields without an image', async () => {
    role = Role.MODERATOR
    calls.length = 0
    const form = new FormData()
    form.append('name', 'Updated food')
    form.append('nutrition', JSON.stringify({ protein: 25 }))
    const response = await fetch(`${base}/api/foods/test-id`, {
      method: 'PATCH',
      headers: { Cookie: cookie, Origin: origin },
      body: form,
    })
    assert.equal(response.status, 200)
    await response.text()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'update')
    assert.equal((calls[0].args[1] as { name: string }).name, 'Updated food')
    assert.deepEqual((calls[0].args[1] as { nutrition: unknown }).nutrition, { protein: 25 })
  })

  for (const method of ['POST', 'PATCH']) {
    for (const multipart of [false, true]) {
      for (const field of ['nutrition', 'allergens']) {
        await t.test(
          `${method} rejects unknown ${field} keys over ${multipart ? 'multipart' : 'JSON'}`,
          async () => {
            role = Role.MODERATOR
            calls.length = 0
            const headers: Record<string, string> = { Cookie: cookie, Origin: origin }
            let body: string | FormData
            if (multipart) {
              body = new FormData()
              body.append('name', 'Alma')
              body.append(field, JSON.stringify({ foo: 'bar' }))
              if (method === 'POST')
                body.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png')
            } else {
              headers['Content-Type'] = 'application/json'
              body = JSON.stringify({ name: 'Alma', [field]: { foo: 'bar' } })
            }
            const response = await fetch(
              `${base}/api/foods${method === 'PATCH' ? '/test-id' : ''}`,
              {
                method,
                headers,
                body,
              },
            )
            assert.equal(response.status, 400)
            const result = (await response.json()) as { message: string }
            assert.ok(result.message.includes(`${field}.foo`))
            assert.equal(calls.length, 0)
          },
        )
      }
    }
  }

  await t.test('deleted users receive 401 even with an unexpired ADMIN session', async () => {
    userExists = false
    const response = await fetch(`${base}/api/session-test`, { headers: { Cookie: cookie } })
    assert.equal(response.status, 401)
    await response.text()
    userExists = true
  })

  await t.test('existing public food reads remain accessible without a session', async () => {
    const response = await fetch(`${base}/api/foods`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), [])
  })
})
