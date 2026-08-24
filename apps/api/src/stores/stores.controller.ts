import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import type { Prisma, Store } from '@kajai/db'
import { StoresService } from './stores.service'
import { CreateStoreDto } from './dto/create-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'
import { HttpCode, HttpStatus } from '@nestjs/common'
import { DevAuthGuard } from '../auth/guards/dev-auth.guard'
import { RolesGuard } from '../auth/guards/role.guard'
import { UseGuards } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/types/request-user.type';

type StoreWithProducts = Prisma.StoreGetPayload<{
  include: {
    products: {
      include: {
        foodItem: true
      }
    }
  }
}>

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateStoreDto, @CurrentUser() user: RequestUser): Promise<Store> {
    return this.storesService.create(dto, user.id)
  }

  @Get()
  findAll(@Query('search') search?: string): Promise<Store[]> {
    return this.storesService.findAll(search)
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StoreWithProducts> {
    return this.storesService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto, @CurrentUser() user: RequestUser): Promise<Store> {
    return this.storesService.update(id, dto, user.id)
  }

  @Delete(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.storesService.remove(id, user.id)
  }
}
