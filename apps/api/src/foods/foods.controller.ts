import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { FoodItemType } from '@kajai/db'
import type { FoodItem, Prisma } from '@kajai/db'
import { FoodsService } from './foods.service'
import { CreateFoodDto } from './dto/create-food.dto'
import { UpdateFoodDto } from './dto/update-food.dto'
import { HttpCode, HttpStatus } from '@nestjs/common'
import { DevAuthGuard } from '../auth/guards/dev-auth.guard'
import { RolesGuard } from '../auth/guards/role.guard'
import { UseGuards } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RequestUser } from '../auth/types/request-user.type'
import type { ProductAvailabilityResponse } from '../product-availability/product-availability-response.mapper'

type FoodItemWithDetails = Prisma.FoodItemGetPayload<{
  include: {
    ingredient: true
    productAvailability: {
      include: { store: true }
    }
  }
}>

type FoodItemWithDetailsResponse = Omit<FoodItemWithDetails, 'productAvailability'> & {
  productAvailability: ProductAvailabilityResponse<
    FoodItemWithDetails['productAvailability'][number]
  >[]
}

@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post()
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateFoodDto, @CurrentUser() user: RequestUser): Promise<FoodItem> {
    return this.foodsService.create(dto, user.id)
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: FoodItemType,
  ): Promise<FoodItem[]> {
    return this.foodsService.findAll(search, type)
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<FoodItemWithDetailsResponse> {
    return this.foodsService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateFoodDto, @CurrentUser() user: RequestUser,): Promise<FoodItem> {
    return this.foodsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser,): Promise<void> {
    return this.foodsService.remove(id, user.id)
  }
}
