import { Body, Controller, Get, Post, Res,Query } from '@nestjs/common'
import type { Response } from 'express'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthService, type AuthUser } from './auth.service'
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { verifyEmail } from './dto/verify.dto'
import { ForgotPasswordDto } from './dto/forgotPassword.dto'
import { ResetPasswordDto } from './dto/ResetPassword.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getUserById(user.id)
  }

  @Get('verify')
  @Public()
verify(@Query() dto:verifyEmail) {
  return this.authService.verifyEmail(dto.id)
}

  @Post('logout')
  @Public()
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('kajai-session', { path: '/' })
    return { message: 'Sikeres kijelentkezés' }
  }

  @Post('login')
  @Public()
  login(@Body() dto: LoginDto){
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  @Public()
  register(
    @Body() dto: RegisterDto,
  ) {
    return this.authService.register(dto);
  }

  @Post('forgotpassword')
  @Public()
  forgotpassword(@Body() dto:ForgotPasswordDto){
    return this.authService.forgotPassword(dto.email)
  }

  @Post('resetpassword')
  @Public()
  resetpassword(@Body() dto:ResetPasswordDto){
    return this.authService.resetPassword(dto.email, dto.password, dto.token)
  }
}
