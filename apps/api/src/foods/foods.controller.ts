import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { FoodItemType } from '@kajai/db';
import type { FoodItem, Prisma } from '@kajai/db';
import { FoodsService } from './foods.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { UpdateFoodDto } from './dto/update-food.dto';

type FoodItemWithDetails = Prisma.FoodItemGetPayload<{
  include: {
    ingredient: true;
    productAvailability: {
      include: { store: true };
    };
  };
}>;

@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post()
  create(@Body() dto: CreateFoodDto): Promise<FoodItem> {
    return this.foodsService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: FoodItemType,
  ): Promise<FoodItem[]> {
    return this.foodsService.findAll(search, type);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<FoodItemWithDetails> {
    return this.foodsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFoodDto): Promise<FoodItem> {
    return this.foodsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<FoodItem> {
    return this.foodsService.remove(id);
  }
}
