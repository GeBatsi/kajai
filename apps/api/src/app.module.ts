import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { FoodsModule } from './foods/foods.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { ProductAvailabilityModule } from './product-availability/product-availability.module';
import { StoresModule } from './stores/stores.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    FoodsModule,
    IngredientsModule,
    ProductAvailabilityModule,
    StoresModule,
    AuditModule,
    AuthModule,
    UsersModule,
    MailModule,
  ],
})
export class AppModule {}
