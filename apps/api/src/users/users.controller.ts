import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
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
}
