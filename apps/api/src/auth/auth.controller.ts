import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { NextAuthGuard } from './guards/nextauth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { type AuthUser } from './auth.service'

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(NextAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return user
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('kajai-session', { path: '/' })
    return { message: 'Sikeres kijelentkezés' }
  }
}
