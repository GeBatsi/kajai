import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { type AuthUser } from '../auth/auth.service'
import { BanUserDto, UnbanUserDto } from './dto/ban-user.dto'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'
import { UsersQueryDto } from './dto/users-query.dto'


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
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
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.usersService.remove(id, actor.id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.usersService.createAdmin(dto, actor.id)
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() actor: AuthUser) {
    return this.usersService.updateRole(id, dto.role, actor.id)
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  ban(@Param('id') id: string, @Body() dto: BanUserDto, @CurrentUser() actor: AuthUser) {
    return this.usersService.ban(id, dto.reason, actor.id)
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  unban(@Param('id') id: string, @Body() _dto: UnbanUserDto, @CurrentUser() actor: AuthUser) {
    return this.usersService.unban(id, actor.id)
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
