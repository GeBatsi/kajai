import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { ConfigService } from '@nestjs/config'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { StorageService } from './storage.service'

function setup() {
  const config: Record<string, string> = {
    S3_ENDPOINT: 'https://storage.example',
    S3_ACCESS_KEY_ID: 'test-key',
    S3_SECRET_ACCESS_KEY: 'test-secret',
    S3_BUCKET: 'test-bucket',
    S3_PUBLIC_BASE_URL: 'https://images.example',
  }
  const service = new StorageService({
    get: (name: string) => config[name],
  } as ConfigService)
  const send = mock.method(service['s3Client'], 'send', async (command: unknown) => {
    assert.ok(command instanceof PutObjectCommand)
    assert.equal(command.input.Bucket, 'test-bucket')
    assert.equal(command.input.ContentType, 'image/png')
    return {}
  })
  return { service, send }
}

async function makeImage(): Promise<Express.Multer.File> {
  const buffer = await sharp({
    create: { width: 300, height: 300, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer()
  return { buffer, size: buffer.length, mimetype: 'image/png' } as Express.Multer.File
}

test('uploadFoodImage works before a food exists and gives each upload a unique key', async () => {
  const { service, send } = setup()
  const image = await makeImage()

  const first = await service.uploadFoodImage(image)
  const second = await service.uploadFoodImage(image)

  assert.match(first.key, /^foods\/basic\/[0-9a-f-]{36}\/main-.+\.png$/)
  assert.notEqual(first.key.split('/')[2], second.key.split('/')[2])
  assert.equal(first.url, `https://images.example/${first.key}`)
  assert.equal(first.width, 300)
  assert.equal(first.height, 300)
  assert.equal(send.mock.callCount(), 2)
  const command = send.mock.calls[0].arguments[0]
  assert.ok(command instanceof PutObjectCommand)
  assert.equal(command.input.Key, first.key)
  assert.equal(command.input.Body, image.buffer)
})

test('uploadFoodImage preserves the food ID in the key for existing foods', async () => {
  const { service, send } = setup()

  const uploaded = await service.uploadFoodImage(await makeImage(), 'existing-food-id')

  assert.match(uploaded.key, /^foods\/basic\/existing-food-id\/main-.+\.png$/)
  assert.equal(send.mock.callCount(), 1)
})
