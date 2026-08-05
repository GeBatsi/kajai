import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { NextAuthGuard } from './guards/nextauth.guard'

import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { MailTokenService } from '../mail-token/mail-token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, NextAuthGuard, MailTokenService,],
  exports: [NextAuthGuard, AuthService],
  imports: [
    UsersModule,

    MailModule,

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions:{
        expiresIn:'7d'
      }
    }),
  ],
})
export class AuthModule {}
