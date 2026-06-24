import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { NextAuthGuard } from './guards/nextauth.guard'

@Module({
  controllers: [AuthController],
  providers: [AuthService, NextAuthGuard],
  exports: [NextAuthGuard],
})
export class AuthModule {}
