import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import type { Prisma } from '@kajai/db'
import { IngredientsService } from './ingredients.service'
import { CreateIngredientDto } from './dto/create-ingredient.dto'
import { UpdateIngredientDto } from './dto/update-ingredient.dto'
import { HttpCode, HttpStatus } from '@nestjs/common'
import { DevAuthGuard } from '../auth/guards/dev-auth.guard'
import { RolesGuard } from '../auth/guards/role.guard'
import { UseGuards } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RequestUser } from '../auth/types/request-user.type'

type IngredientWithFoodItem = Prisma.IngredientGetPayload<{
  include: {
    foodItem: true
  }
}>

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateIngredientDto, @CurrentUser() user: RequestUser): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.create(dto, user.id)
  }

  @Get()
  findAll(): Promise<IngredientWithFoodItem[]> {
    return this.ingredientsService.findAll()
  }

  // Fontos: ez legyen a :id route ELŐTT.
  @Get('food/:foodItemId')
  findByFoodItemId(@Param('foodItemId') foodItemId: string): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.findByFoodItemId(foodItemId)
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: RequestUser,
  ): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.ingredientsService.remove(id, user.id)
  }
}
