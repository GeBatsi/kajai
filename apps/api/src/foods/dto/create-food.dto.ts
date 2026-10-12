import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { FoodItemType } from '@kajai/db';

function parseJsonFormField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

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
  @Transform(({ value }) => parseJsonFormField(value))
  @IsObject()
  nutrition?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => parseJsonFormField(value))
  @IsObject()
  allergens?: Record<string, unknown>;
}

