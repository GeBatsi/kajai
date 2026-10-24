import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { NextAuthGuard } from './guards/nextauth.guard'

import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
// import { JwtModule } from '@nestjs/jwt';
import { MailTokenService } from '../mail-token/mail-token.service';
import { TokenModule } from '../token/token.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, NextAuthGuard, MailTokenService,],
  exports: [NextAuthGuard, AuthService],
  imports: [
    UsersModule,
    TokenModule,
    MailModule,
  ],
})
export class AuthModule {}
