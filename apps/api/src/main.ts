import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors({ origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000' })

  const port = process.env.API_PORT ?? 3001
  await app.listen(port)
  console.log(`KajAI API running on http://localhost:${port}/api`)
}

bootstrap()
