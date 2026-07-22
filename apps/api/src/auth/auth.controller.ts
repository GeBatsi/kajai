import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { NextAuthGuard } from './guards/nextauth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthService, type AuthUser } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(NextAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getUserById(user.id)
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('kajai-session', { path: '/' })
    return { message: 'Sikeres kijelentkezés' }
  }
}
