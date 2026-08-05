import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,ForbiddenException} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { NextAuthGuard } from '../auth/guards/nextauth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { type AuthUser } from '../auth/auth.service'


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

    @Post()
  @UseGuards(NextAuthGuard)
  create(@Body() dto: CreateUserDto, @CurrentUser() caller: AuthUser) {
    if (caller.role !== 'ADMIN') {
      throw new ForbiddenException('Csak admin hozhat létre felhasználót')
    }
    return this.usersService.create(dto)
  }
}





