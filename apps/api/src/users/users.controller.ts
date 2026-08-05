import { Body, Controller, ForbiddenException, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { NextAuthGuard } from '../auth/guards/nextauth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { type AuthUser } from '../auth/auth.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(NextAuthGuard)
  create(@Body() dto: CreateUserDto, @CurrentUser() caller: AuthUser) {
    if (caller.role !== 'ADMIN') {
      throw new ForbiddenException('Csak admin hozhat létre felhasználót')
    }
    return this.usersService.create(dto)
  }

  @Get('me/profile')
  @UseGuards(NextAuthGuard)
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id)
  }

  @Patch('me/profile')
  @UseGuards(NextAuthGuard)
  updateMyProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateProfile(user.id, dto)
  }
}
