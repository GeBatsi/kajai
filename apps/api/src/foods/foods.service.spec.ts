import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { BadRequestException } from '@nestjs/common'
import { FoodsService } from './foods.service'
import { CreateFoodDto } from './dto/create-food.dto'

function setup() {
  const food = { id: 'food-id', name: 'Élelmiszer', productAvailability: [] }
  const save = mock.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...food, ...data }))
  const tx = { foodItem: { create: save, update: save } }
  const prisma = {
    foodItem: { findUnique: mock.fn(async () => food) },
    $transaction: mock.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  }
  const audit = { logWithTx: mock.fn(async () => undefined) }
  const storage = { uploadFoodImage: mock.fn() }
  type Dependencies = ConstructorParameters<typeof FoodsService>
  const service = new FoodsService(
    prisma as unknown as Dependencies[0],
    audit as unknown as Dependencies[1],
    storage as unknown as Dependencies[2],
  )
  service['logger'].error = () => undefined

  return { service, prisma, audit, storage, save }
}

const validNutrition = {
  energyKcal: 500,
  protein: 20,
  carbs: 40,
  fat: 30,
  fiber: 9,
  salt: 1,
  sugar: 40,
  saturatedFat: 30,
}

for (const method of ['create', 'update'] as const) {
  const invoke = (service: FoodsService, nutrition: unknown) => {
    const dto = { name: 'Élelmiszer', nutrition: nutrition as CreateFoodDto['nutrition'] }
    return method === 'create'
      ? service.create(dto, 'user-id')
      : service.update('food-id', dto, 'user-id')
  }

  const accepted: [string, unknown][] = [
    ['exactly 100 g and equal sugar/carbs and saturated fat/fat', validNutrition],
    ['below all limits', { ...validNutrition, protein: 10, sugar: 5, saturatedFat: 2 }],
    ['decimal amounts totalling 100 g', { protein: 33.3, carbs: 33.3, fat: 33.3, salt: 0.1 }],
    ['omitted nutrition', undefined],
    ['null nutrition', null],
    ['empty nutrition', {}],
    ['null optional amounts', { protein: 20, carbs: 40, fat: 30, fiber: null, salt: null }],
    ['zero amounts', { carbs: 0, sugar: 0, fat: 0, saturatedFat: 0 }],
    ['JSON form data', JSON.stringify(validNutrition)],
  ]

  for (const [description, nutrition] of accepted) {
    test(`${method} accepts ${description}`, async () => {
      const { service, save, audit } = setup()
      await invoke(service, nutrition)
      assert.equal(save.mock.callCount(), 1)
      assert.equal(audit.logWithTx.mock.callCount(), 1)
      assert.deepEqual(
        save.mock.calls[0].arguments[0].data.nutrition,
        typeof nutrition === 'string' ? JSON.parse(nutrition) : nutrition,
      )
    })
  }

  const rejected: [string, unknown, string][] = [
    ['over 100 g', { ...validNutrition, salt: 1.01 }, 'legfeljebb 100 g'],
    ['sugar over carbs', { ...validNutrition, sugar: 40.01 }, 'cukor mennyisége'],
    ['saturated fat over fat', { ...validNutrition, saturatedFat: 30.01 }, 'telített zsír'],
    ['sugar without carbs', { sugar: 1 }, 'cukor mennyisége'],
    ['saturated fat without fat', { saturatedFat: 1 }, 'telített zsír'],
    ['negative amounts', { ...validNutrition, protein: -10, carbs: 50 }, 'nemnegatív'],
    ['string amounts', { ...validNutrition, sugar: '50' }, 'véges számok'],
    ['NaN amounts', { protein: NaN }, 'véges számok'],
    ['infinite amounts', { fat: Infinity }, 'véges számok'],
    ['invalid JSON form nutrition', JSON.stringify({ ...validNutrition, salt: 2 }), 'legfeljebb 100 g'],
  ]

  for (const [description, nutrition, message] of rejected) {
    test(`${method} rejects ${description} before writing`, async () => {
      const { service, prisma, save, audit, storage } = setup()
      await assert.rejects(invoke(service, nutrition), (error: unknown) => {
        assert.ok(error instanceof BadRequestException)
        assert.equal(error.getStatus(), 400)
        assert.ok(error.message.includes(message))
        return true
      })
      assert.equal(prisma.$transaction.mock.callCount(), 0)
      assert.equal(save.mock.callCount(), 0)
      assert.equal(audit.logWithTx.mock.callCount(), 0)
      assert.equal(storage.uploadFoodImage.mock.callCount(), 0)
    })
  }
}
