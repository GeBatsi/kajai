import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailTokenModule } from '../mail-token/mail-token.module';
// import { JwtModule } from '@nestjs/jwt';
import { TokenModule } from '../token/token.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
    PrismaModule,
    AuditModule,
    MailTokenModule,
    TokenModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
   exports: [UsersService],
})
export class UsersModule {}
