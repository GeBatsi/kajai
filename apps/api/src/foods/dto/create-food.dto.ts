import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { FoodItemType } from '@kajai/db';

export class CreateFoodDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(FoodItemType)
  type?: FoodItemType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  eanBarcode?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsObject()
  nutrition?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  allergens?: Record<string, unknown>;
}

