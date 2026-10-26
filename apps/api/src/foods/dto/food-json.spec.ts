import 'reflect-metadata'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { CreateFoodDto } from './create-food.dto'
import { UpdateFoodDto } from './update-food.dto'

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
for (const metatype of [CreateFoodDto, UpdateFoodDto]) {
  for (const multipart of [false, true]) {
    const validate = (field: string, value: unknown) =>
      pipe.transform(
        {
          name: 'Alma',
          [field]: multipart ? JSON.stringify(value) : value,
        },
        { type: 'body', metatype },
      )

    const invalid: [string, unknown][] = [
      ['nutrition', JSON.parse('{"constructor":"bar"}')],
      ['allergens', { toString: 'bar' }],
      ['nutrition', { foo: 'bar' }],
      ['allergens', { foo: 'bar' }],
      ['nutrition', { protein: 20, foo: 'bar' }],
      ['allergens', { milk: true, foo: 'bar' }],
      ['nutrition', { kcal: 120 }],
      ['nutrition', { protein: '25' }],
      ['nutrition', { protein: null }],
      ['nutrition', { energyKcal: -1 }],
      ['nutrition', { energyKcal: 901 }],
      ['nutrition', { carbs: false }],
      ['nutrition', { per: 50 }],
      ['nutrition', { per: '100' }],
      ['nutrition', { unit: 'kg' }],
      ['nutrition', { unit: null }],
      ['allergens', { milk: 'igen' }],
      ['allergens', { milk: 1 }],
      ['allergens', { fish: null }],
      ['allergens', { fish: {} }],
      ['nutrition', []],
      ['allergens', []],
    ]
    for (const [field, value] of invalid) {
      test(`${metatype.name} ${multipart ? 'multipart' : 'JSON'} rejects ${field}=${JSON.stringify(value)}`, async () => {
        await assert.rejects(validate(field, value), (error: unknown) => {
          assert.ok(error instanceof BadRequestException)
          assert.equal(error.getStatus(), 400)
          assert.ok(error.message.includes(field))
          return true
        })
      })
    }

    for (const [field, value] of [
      ['nutrition', { protein: 25 }],
      [
        'nutrition',
        {
          per: 100,
          unit: 'g',
          energyKcal: 900,
          protein: 20,
          carbs: 30,
          fat: 10,
          sugar: null,
          saturatedFat: null,
          fiber: null,
          salt: null,
        },
      ],
      ['nutrition', { per: 100, unit: 'ml', sugar: 0 }],
      [
        'allergens',
        {
          gluten: true,
          milk: false,
          egg: true,
          soy: false,
          nuts: true,
          peanuts: false,
          fish: true,
          shellfish: false,
          sesame: true,
          celery: false,
          mustard: true,
          lupin: false,
        },
      ],
      ['allergens', {}],
    ] as [string, unknown][]) {
      test(`${metatype.name} ${multipart ? 'multipart' : 'JSON'} accepts ${field}=${JSON.stringify(value)}`, async () => {
        assert.deepEqual((await validate(field, value))[field], value)
      })
    }
  }
  test(`${metatype.name} rejects malformed JSON`, async () => {
    await assert.rejects(
      pipe.transform(
        { name: 'Alma', nutrition: '{oops' },
        {
          type: 'body',
          metatype,
        },
      ),
      BadRequestException,
    )
  })

  test(`${metatype.name} never preserves prototype keys removed by the Nest validation pipe`, async () => {
    const dto = await pipe.transform(
      { name: 'Alma', allergens: JSON.parse('{"milk":true,"__proto__":{"foo":"bar"}}') },
      {
        type: 'body',
        metatype,
      },
    )
    assert.deepEqual(dto.allergens, { milk: true })
    assert.equal(dto.allergens.foo, undefined)
  })
}
