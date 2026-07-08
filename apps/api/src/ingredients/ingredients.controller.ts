import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Ingredient, Prisma } from '@kajai/db';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

type IngredientWithFoodItem = Prisma.IngredientGetPayload<{
  include: {
    foodItem: true;
  };
}>;

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  create(@Body() dto: CreateIngredientDto): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.create(dto);
  }

  @Get()
  findAll(): Promise<IngredientWithFoodItem[]> {
    return this.ingredientsService.findAll();
  }

  // Fontos: ez legyen a :id route ELŐTT.
  @Get('food/:foodItemId')
  findByFoodItemId(
    @Param('foodItemId') foodItemId: string,
  ): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.findByFoodItemId(foodItemId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
  ): Promise<IngredientWithFoodItem> {
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Ingredient> {
    return this.ingredientsService.remove(id);
  }
}
