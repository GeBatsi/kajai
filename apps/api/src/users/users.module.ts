import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailTokenModule } from '../mail-token/mail-token.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
    PrismaModule,
    MailTokenModule,
    JwtModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
   exports: [UsersService],
})
export class UsersModule {}
