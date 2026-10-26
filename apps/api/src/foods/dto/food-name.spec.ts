import 'reflect-metadata'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { CreateFoodDto } from './create-food.dto'
import { UpdateFoodDto } from './update-food.dto'

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})

for (const metatype of [CreateFoodDto, UpdateFoodDto]) {
  const validate = (body: Record<string, unknown>) =>
    pipe.transform(body, { type: 'body', metatype })

  for (const [label, name] of [
    ['empty', ''],
    ['spaces only', '   '],
    ['tabs and newlines only', '\t\r\n'],
    ['Unicode whitespace only', '\u00a0\u2003'],
    ['201 characters', 'a'.repeat(201)],
    ['5000 characters', 'a'.repeat(5000)],
    ['null', null],
    ['number', 123],
    ['array', ['Alma']],
    ['object', { name: 'Alma' }],
  ] as const) {
    test(`${metatype.name} rejects ${label} with 400`, async () => {
      await assert.rejects(validate({ name }), (error: unknown) => {
        assert.ok(error instanceof BadRequestException)
        assert.equal(error.getStatus(), 400)
        return true
      })
    })
  }

  for (const name of ['A', 'a'.repeat(200), 'Árvíztűrő tükörfúrógép']) {
    test(`${metatype.name} accepts a valid ${name.length}-character name`, async () => {
      assert.equal((await validate({ name })).name, name)
    })
  }

  test(`${metatype.name} trims surrounding whitespace and preserves internal spaces`, async () => {
    assert.equal(
      (await validate({ name: '\t  Csirkemell  filé \u00a0\n' })).name,
      'Csirkemell  filé',
    )
    assert.equal((await validate({ name: ` ${'a'.repeat(200)} ` })).name, 'a'.repeat(200))
  })
}

test('create requires a name', async () => {
  await assert.rejects(
    pipe.transform({}, { type: 'body', metatype: CreateFoodDto }),
    BadRequestException,
  )
})

test('update allows omitting the name when changing another field', async () => {
  const dto = await pipe.transform(
    { category: 'Gyümölcs' },
    { type: 'body', metatype: UpdateFoodDto },
  )
  assert.equal(dto.name, undefined)
  assert.equal(dto.category, 'Gyümölcs')
})
