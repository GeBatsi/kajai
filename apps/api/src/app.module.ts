import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env.local' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
})
export class AppModule {}
