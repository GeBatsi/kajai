import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common'
import { FoodItemType, Prisma } from '@kajai/db'
import { FoodsService } from './foods.service'
import { CreateFoodDto } from './dto/create-food.dto'

function setup() {
  const food = {
    id: 'food-id',
    name: 'Élelmiszer',
    category: 'Kategória' as string | null,
    type: FoodItemType.BASIC as FoodItemType,
    productAvailability: [],
    nutrition: null as Record<string, unknown> | null,
  }
  const save = mock.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...food,
    ...data,
  }))
  const tx = { foodItem: { create: save, update: save } }
  const prisma = {
    foodItem: { findUnique: mock.fn(async () => food) },
    $queryRaw: mock.fn<(query: Prisma.Sql) => Promise<{ id: string }[]>>(async () => []),
    $transaction: mock.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  }
  const audit = {
    logWithTx: mock.fn<(tx: unknown, params: unknown) => Promise<void>>(async () => undefined),
  }
  const storage = {
    uploadFoodImage: mock.fn<
      (image: Express.Multer.File, foodItemId?: string) => Promise<{ url: string }>
    >(async () => ({
      url: 'https://images.example/foods/basic/upload-id/main.png',
    })),
    deleteFileByUrl: mock.fn<(url: string) => Promise<void>>(async () => undefined),
  }
  type Dependencies = ConstructorParameters<typeof FoodsService>
  const service = new FoodsService(
    prisma as unknown as Dependencies[0],
    audit as unknown as Dependencies[1],
    storage as unknown as Dependencies[2],
  )
  service['logger'].error = () => undefined

  return { service, prisma, audit, storage, save, tx, food }
}

const image = { buffer: Buffer.from('image'), mimetype: 'image/png' } as Express.Multer.File
const createDto = { name: 'Élelmiszer' }

for (const method of ['create', 'update'] as const) {
  test(`${method} rejects a duplicate before writes, audit or image upload`, async () => {
    const { service, prisma, storage, save, audit } = setup()
    prisma.$queryRaw.mock.mockImplementation(async () => [{ id: 'other-food-id' }])

    await assert.rejects(
      method === 'create'
        ? service.create(createDto, 'user-id', image)
        : service.update('food-id', createDto, 'user-id'),
      (error) => {
        assert.ok(error instanceof ConflictException)
        assert.equal(error.getStatus(), 409)
        assert.equal(error.message, 'Ilyen nevű alapanyag már létezik ebben a kategóriában.')
        return true
      },
    )

    assert.equal(prisma.$transaction.mock.callCount(), 0)
    assert.equal(storage.uploadFoodImage.mock.callCount(), 0)
    assert.equal(storage.deleteFileByUrl.mock.callCount(), 0)
    assert.equal(save.mock.callCount(), 0)
    assert.equal(audit.logWithTx.mock.callCount(), 0)
  })

  for (const target of [
    ['lower(btrim(name))', 'lower(btrim(COALESCE(category', "''::text)))"],
    'food_items_basic_name_category_key',
    ['eanBarcode'],
  ]) {
    test(`${method} maps unique constraint ${JSON.stringify(target)} to the correct conflict`, async () => {
      const { service, storage, save } = setup()
      save.mock.mockImplementation(async () => {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
          meta: { target },
        })
      })

      await assert.rejects(
        method === 'create'
          ? service.create(createDto, 'user-id', image)
          : service.update('food-id', createDto, 'user-id'),
        (error) => {
          assert.ok(error instanceof ConflictException)
          assert.equal(error.getStatus(), 409)
          assert.equal(
            error.message,
            Array.isArray(target) && target[0] === 'eanBarcode'
              ? 'Ez az EAN vonalkód már létezik.'
              : 'Ilyen nevű alapanyag már létezik ebben a kategóriában.',
          )
          return true
        },
      )

      assert.equal(storage.deleteFileByUrl.mock.callCount(), method === 'create' ? 1 : 0)
    })
  }
}

test('create passes name and category as SQL parameters, including SQL metacharacters', async () => {
  const { service, prisma } = setup()
  const dto = { name: " QA19'; DROP TABLE food_items;-- ", category: ' HÚS_% ' }

  await service.create(dto, 'user-id')

  const query = prisma.$queryRaw.mock.calls[0].arguments[0]
  assert.deepEqual(query.values, [dto.name, dto.category])
  assert.ok(!query.text.includes(dto.name))
  assert.ok(!query.text.includes(dto.category))
})

test('update uses unchanged fields and excludes its own ID from duplicate lookup', async () => {
  const { service, prisma, food } = setup()

  await service.update(food.id, { name: 'Új név' }, 'user-id')
  assert.deepEqual(prisma.$queryRaw.mock.calls[0].arguments[0].values, [
    'Új név',
    food.category,
    food.id,
  ])

  await service.update(food.id, { category: 'Új kategória' }, 'user-id')
  assert.deepEqual(prisma.$queryRaw.mock.calls[1].arguments[0].values, [
    food.name,
    'Új kategória',
    food.id,
  ])

  await service.update(food.id, { category: null } as unknown as CreateFoodDto, 'user-id')
  assert.deepEqual(prisma.$queryRaw.mock.calls[2].arguments[0].values, [food.name, '', food.id])
})

test('PRODUCT creation and updates skip BASIC duplicate lookup', async () => {
  const { service, prisma, food } = setup()
  food.type = FoodItemType.PRODUCT

  await service.create({ ...createDto, type: FoodItemType.PRODUCT }, 'user-id')
  await service.update(food.id, { name: 'Más név' }, 'user-id')

  assert.equal(prisma.$queryRaw.mock.callCount(), 0)
})

test('changing PRODUCT to BASIC checks the resulting identity', async () => {
  const { service, prisma, food } = setup()
  food.type = FoodItemType.PRODUCT

  await service.update(food.id, { type: FoodItemType.BASIC }, 'user-id')

  assert.deepEqual(prisma.$queryRaw.mock.calls[0].arguments[0].values, [
    food.name,
    food.category,
    food.id,
  ])
})

for (const [description, error] of [
  ['too small image', new BadRequestException('A kép túl kicsi.')],
  ['unreadable image', new BadRequestException('A feltöltött fájl nem olvasható képként.')],
  ['storage failure', new InternalServerErrorException('Image upload failed.')],
] as const) {
  test(`create rejects ${description} without database writes or audit`, async () => {
    const { service, prisma, audit, storage, save } = setup()
    storage.uploadFoodImage.mock.mockImplementation(async () => {
      throw error
    })

    await assert.rejects(service.create(createDto, 'user-id', image), (actual) => actual === error)

    assert.equal(storage.uploadFoodImage.mock.callCount(), 1)
    assert.equal(prisma.$transaction.mock.callCount(), 0)
    assert.equal(save.mock.callCount(), 0)
    assert.equal(audit.logWithTx.mock.callCount(), 0)
    assert.equal(storage.deleteFileByUrl.mock.callCount(), 0)
  })
}

test('create uploads first and saves the image URL and CREATE audit in one transaction', async () => {
  const { service, prisma, audit, storage, save, tx } = setup()
  const url = 'https://images.example/foods/basic/upload-id/main.png'
  storage.uploadFoodImage.mock.mockImplementation(async () => {
    assert.equal(prisma.$transaction.mock.callCount(), 0)
    return { url }
  })

  const result = await service.create(createDto, 'user-id', image)

  assert.equal(result.imageUrl, url)
  assert.deepEqual(storage.uploadFoodImage.mock.calls[0].arguments, [image])
  assert.equal(prisma.$transaction.mock.callCount(), 1)
  assert.equal(save.mock.callCount(), 1)
  assert.equal(save.mock.calls[0].arguments[0].data.imageUrl, url)
  assert.equal(audit.logWithTx.mock.callCount(), 1)
  assert.deepEqual(audit.logWithTx.mock.calls[0].arguments, [
    tx,
    {
      tableName: 'food_items',
      recordId: result.id,
      action: 'CREATE',
      newValue: result,
      userId: 'user-id',
    },
  ])
  assert.equal(storage.deleteFileByUrl.mock.callCount(), 0)
})

test('create without an image saves and audits without accessing storage', async () => {
  const { service, prisma, audit, storage, save } = setup()

  await service.create(createDto, 'user-id')

  assert.equal(prisma.$transaction.mock.callCount(), 1)
  assert.equal(save.mock.callCount(), 1)
  assert.equal(audit.logWithTx.mock.callCount(), 1)
  assert.equal(storage.uploadFoodImage.mock.callCount(), 0)
  assert.equal(storage.deleteFileByUrl.mock.callCount(), 0)
})

for (const failure of ['create', 'audit', 'commit', 'EAN conflict'] as const) {
  for (const cleanupFails of [false, true]) {
    test(`create cleans up after ${failure} failure and preserves the error when cleanup ${cleanupFails ? 'fails' : 'succeeds'}`, async () => {
      const { service, prisma, audit, storage, save, tx } = setup()
      const error =
        failure === 'EAN conflict'
          ? new Prisma.PrismaClientKnownRequestError('Duplicate EAN', {
              code: 'P2002',
              clientVersion: '5.22.0',
              meta: { target: ['eanBarcode'] },
            })
          : new Error(`${failure} failed`)
      const reject = async () => {
        throw error
      }
      if (failure === 'audit') {
        audit.logWithTx.mock.mockImplementation(reject)
      } else if (failure === 'commit') {
        prisma.$transaction.mock.mockImplementation(async (callback) => {
          await callback(tx)
          throw error
        })
      } else {
        save.mock.mockImplementation(reject)
      }
      const logError = mock.fn()
      service['logger'].error = logError
      const cleanupError = new Error('Image delete failed')
      if (cleanupFails) {
        storage.deleteFileByUrl.mock.mockImplementation(async () => {
          throw cleanupError
        })
      }

      await assert.rejects(service.create(createDto, 'user-id', image), (actual) => {
        if (failure === 'EAN conflict') {
          assert.ok(actual instanceof ConflictException)
          assert.equal(actual.getStatus(), 409)
          assert.equal(actual.message, 'Ez az EAN vonalkód már létezik.')
        } else {
          assert.equal(actual, error)
        }
        return true
      })

      assert.equal(prisma.$transaction.mock.callCount(), 1)
      assert.equal(storage.deleteFileByUrl.mock.callCount(), 1)
      assert.deepEqual(storage.deleteFileByUrl.mock.calls[0].arguments, [
        'https://images.example/foods/basic/upload-id/main.png',
      ])
      assert.equal(logError.mock.callCount(), cleanupFails ? 1 : 0)
      if (cleanupFails) {
        assert.equal(logError.mock.calls[0].arguments[1], cleanupError.stack)
      }
    })
  }
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
  const invoke = (service: FoodsService, nutrition: unknown, upload?: Express.Multer.File) => {
    const dto = { name: 'Élelmiszer', nutrition: nutrition as CreateFoodDto['nutrition'] }
    return method === 'create'
      ? service.create(dto, 'user-id', upload)
      : service.update('food-id', dto, 'user-id')
  }

  const accepted: [string, unknown][] = [
    ['exactly 100 g and equal sugar/carbs and saturated fat/fat', validNutrition],
    ['below all limits', { ...validNutrition, protein: 10, sugar: 5, saturatedFat: 2 }],
    ['decimal amounts totalling 100 g', { protein: 33.3, carbs: 33.3, fat: 33.3, salt: 0.1 }],
    ['omitted nutrition', undefined],
    ...(method === 'create' ? [['null nutrition', null] as [string, unknown]] : []),
    ['empty nutrition', {}],
    ['null optional amounts', { protein: 20, carbs: 40, fat: 30, fiber: null, salt: null }],
    ['zero amounts', { carbs: 0, sugar: 0, fat: 0, saturatedFat: 0 }],
    ['JSON form data', JSON.stringify(validNutrition)],
    ['zero energy', { energyKcal: 0 }],
    ['maximum energy', { energyKcal: 900 }],
    ['decimal energy', { energyKcal: 899.9 }],
    ['maximum energy in JSON form data', JSON.stringify({ energyKcal: 900 })],
  ]

  for (const [description, nutrition] of accepted) {
    test(`${method} accepts ${description}`, async () => {
      const { service, save, audit } = setup()
      await invoke(service, nutrition)
      assert.equal(save.mock.callCount(), 1)
      assert.equal(audit.logWithTx.mock.callCount(), 1)
      assert.deepEqual(
        save.mock.calls[0].arguments[0].data.nutrition,
        method === 'update' && nutrition && Object.keys(nutrition).length === 0
          ? undefined
          : typeof nutrition === 'string'
            ? JSON.parse(nutrition)
            : nutrition,
      )
    })
  }

  const rejected: [string, unknown, string][] = [
    ...(method === 'update'
      ? [['null nutrition', null, 'objektumként'] as [string, unknown, string]]
      : []),
    ['negative energy', { energyKcal: -500 }, 'nemnegatív'],
    ['energy just above maximum', { energyKcal: 900.1 }, 'legfeljebb 900 kcal'],
    ['excessive energy', { energyKcal: 99999 }, 'legfeljebb 900 kcal'],
    ['text energy', { energyKcal: 'sok' }, 'véges számok'],
    ['numeric string energy', { energyKcal: '500' }, 'véges számok'],
    ['boolean energy', { energyKcal: true }, 'véges számok'],
    ['NaN energy', { energyKcal: NaN }, 'véges számok'],
    ['infinite energy', { energyKcal: Infinity }, 'véges számok'],
    ['negative energy in JSON form data', JSON.stringify({ energyKcal: -500 }), 'nemnegatív'],
    [
      'excessive energy in JSON form data',
      JSON.stringify({ energyKcal: 99999 }),
      'legfeljebb 900 kcal',
    ],
    ['text energy in JSON form data', JSON.stringify({ energyKcal: 'sok' }), 'véges számok'],
    ['over 100 g', { ...validNutrition, salt: 1.01 }, 'legfeljebb 100 g'],
    ['sugar over carbs', { ...validNutrition, sugar: 40.01 }, 'cukor mennyisége'],
    ['saturated fat over fat', { ...validNutrition, saturatedFat: 30.01 }, 'telített zsír'],
    ['sugar without carbs', { sugar: 1 }, 'cukor mennyisége'],
    ['saturated fat without fat', { saturatedFat: 1 }, 'telített zsír'],
    ['negative amounts', { ...validNutrition, protein: -10, carbs: 50 }, 'nemnegatív'],
    ['string amounts', { ...validNutrition, sugar: '50' }, 'véges számok'],
    ['NaN amounts', { protein: NaN }, 'véges számok'],
    ['infinite amounts', { fat: Infinity }, 'véges számok'],
    [
      'invalid JSON form nutrition',
      JSON.stringify({ ...validNutrition, salt: 2 }),
      'legfeljebb 100 g',
    ],
  ]

  for (const [description, nutrition, message] of rejected) {
    test(`${method} rejects ${description} before writing`, async () => {
      const { service, prisma, save, audit, storage } = setup()
      await assert.rejects(invoke(service, nutrition, image), (error: unknown) => {
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

test('partial nutrition update preserves other fields and audits the merged result', async () => {
  const { service, food, save, audit } = setup()
  const previous = {
    energyKcal: 200,
    protein: 20,
    carbs: 10,
    fat: 5,
    sugar: 2,
    per: 100,
    unit: 'g',
    source: { label: 'existing metadata' },
  }
  food.nutrition = previous

  const result = await service.update(food.id, { nutrition: { protein: 25 } }, 'user-id')
  const expected = { ...previous, protein: 25 }

  assert.deepEqual(save.mock.calls[0].arguments[0].data.nutrition, expected)
  assert.deepEqual(result.nutrition, expected)
  assert.deepEqual(food.nutrition, previous)
  assert.equal(previous.protein, 20)
  assert.deepEqual(audit.logWithTx.mock.calls[0].arguments[1], {
    tableName: 'food_items',
    recordId: food.id,
    action: 'UPDATE',
    oldValue: food,
    newValue: result,
    userId: 'user-id',
  })
})

for (const nutrition of [undefined, {}, '{}']) {
  test(`omitted or empty nutrition (${JSON.stringify(nutrition)}) does not write the JSON field`, async () => {
    const { service, food, save } = setup()
    food.nutrition = { energyKcal: 200, protein: 20, carbs: 10, fat: 5 }
    await service.update(
      food.id,
      {
        category: 'Új kategória',
        nutrition: nutrition as CreateFoodDto['nutrition'],
      },
      'user-id',
    )
    assert.equal(save.mock.calls[0].arguments[0].data.nutrition, undefined)
    assert.equal(save.mock.calls[0].arguments[0].data.category, 'Új kategória')
  })
}

for (const nutrition of [{ protein: 0 }, JSON.stringify({ protein: 0 })]) {
  test(`partial nutrition accepts explicit zero (${typeof nutrition})`, async () => {
    const { service, food, save } = setup()
    food.nutrition = { protein: 20, carbs: 10, fat: 5 }
    await service.update(food.id, { nutrition: nutrition as CreateFoodDto['nutrition'] }, 'user-id')
    assert.deepEqual(save.mock.calls[0].arguments[0].data.nutrition, {
      protein: 0,
      carbs: 10,
      fat: 5,
    })
  })
}

test('partial sugar and saturated fat updates are validated against stored carbs and fat', async () => {
  const { service, food, save } = setup()
  food.nutrition = { carbs: 20, fat: 10, sugar: 2, saturatedFat: 1 }
  await service.update(food.id, { nutrition: { sugar: 15, saturatedFat: 5 } }, 'user-id')
  assert.deepEqual(save.mock.calls[0].arguments[0].data.nutrition, {
    carbs: 20,
    fat: 10,
    sugar: 15,
    saturatedFat: 5,
  })
})

for (const [patch, message] of [
  [{ protein: 30 }, 'legfeljebb 100 g'],
  [{ carbs: 5 }, 'cukor mennyisége'],
  [{ fat: 2 }, 'telített zsír'],
] as const) {
  test(`merged nutrition rejects ${JSON.stringify(patch)} without saving or auditing`, async () => {
    const { service, food, save, audit } = setup()
    const previous = { protein: 20, carbs: 40, fat: 30, fiber: 5, sugar: 10, saturatedFat: 5 }
    food.nutrition = previous
    await assert.rejects(
      service.update(food.id, { nutrition: patch }, 'user-id'),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException)
        assert.equal(error.getStatus(), 400)
        assert.ok(error.message.includes(message))
        return true
      },
    )
    assert.equal(save.mock.callCount(), 0)
    assert.equal(audit.logWithTx.mock.callCount(), 0)
    assert.deepEqual(food.nutrition, previous)
  })
}

test('null nutrition cannot clear an existing object', async () => {
  const { service, food, save, audit } = setup()
  food.nutrition = { protein: 20 }
  await assert.rejects(
    service.update(
      food.id,
      {
        nutrition: null as unknown as CreateFoodDto['nutrition'],
      },
      'user-id',
    ),
    BadRequestException,
  )
  assert.equal(save.mock.callCount(), 0)
  assert.equal(audit.logWithTx.mock.callCount(), 0)
  assert.deepEqual(food.nutrition, { protein: 20 })
})

for (const method of ['create', 'update'] as const) {
  for (const field of ['nutrition', 'allergens'] as const) {
    for (const value of [{ foo: 'bar' }, JSON.stringify({ foo: 'bar' }), '{broken']) {
      test(`${method} rejects invalid ${field} before storage or writes (${typeof value})`, async () => {
        const { service, food, save, audit, storage } = setup()
        const dto = { name: 'Alma', [field]: value } as CreateFoodDto
        await assert.rejects(
          method === 'create'
            ? service.create(dto, 'user-id', image)
            : service.update(food.id, dto, 'user-id'),
          BadRequestException,
        )
        assert.equal(save.mock.callCount(), 0)
        assert.equal(audit.logWithTx.mock.callCount(), 0)
        assert.equal(storage.uploadFoodImage.mock.callCount(), 0)
      })
    }
  }
}

test('partial nutrition update normalizes stored legacy keys and retains unrelated stored metadata', async () => {
  const { service, food, save } = setup()
  const previous = { kcal: 120, proteinG: 23, carbsG: 10, fatG: 2, source: 'legacy' }
  food.nutrition = previous
  await service.update(food.id, { nutrition: { protein: 25 } }, 'user-id')
  assert.deepEqual(save.mock.calls[0].arguments[0].data.nutrition, {
    energyKcal: 120,
    protein: 25,
    carbs: 10,
    fat: 2,
    source: 'legacy',
  })
  assert.deepEqual(food.nutrition, previous)
})

test('stored canonical nutrition takes precedence over legacy aliases', async () => {
  const { service, food, save } = setup()
  food.nutrition = { protein: 0, proteinG: 23, carbs: 10, carbsG: 99 }
  await service.update(food.id, { nutrition: { fat: 1 } }, 'user-id')
  assert.deepEqual(save.mock.calls[0].arguments[0].data.nutrition, {
    protein: 0,
    carbs: 10,
    fat: 1,
  })
})

test('merged totals include values stored under legacy keys', async () => {
  const { service, food, save } = setup()
  food.nutrition = { proteinG: 20, carbsG: 70, fatG: 5 }
  await assert.rejects(
    service.update(food.id, { nutrition: { fat: 15 } }, 'user-id'),
    BadRequestException,
  )
  assert.equal(save.mock.callCount(), 0)
})
