import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { type AuthUser } from '../auth/auth.service'


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateAdmin(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createAdmin(dto)
  }

  @Get('me/profile')
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id)
  }

  @Post('me/profile/preview')
  @HttpCode(HttpStatus.OK)
  previewMyProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.usersService.previewProfile(user.id, dto)
  }

  @Patch('me/profile')
  updateMyProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateProfile(user.id, dto)
  }
}
