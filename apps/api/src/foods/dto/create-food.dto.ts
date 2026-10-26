import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { FoodItemType } from '@kajai/db'
import { parseAllergens, parseNutrition } from '../food-json.schema'

export class CreateFoodDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Az élelmiszer neve szöveg kell legyen.' })
  @IsNotEmpty({ message: 'Az élelmiszer neve kötelező.' })
  @MaxLength(200, { message: 'Az élelmiszer neve legfeljebb 200 karakter lehet.' })
  name!: string

  @IsOptional()
  @IsEnum(FoodItemType)
  type?: FoodItemType

  @IsOptional()
  @IsString()
  brand?: string

  @IsOptional()
  @IsString()
  eanBarcode?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @Type(() => Object)
  @Transform(({ obj, key }) => parseNutrition(obj[key]))
  @IsObject()
  nutrition?: Record<string, unknown>

  @IsOptional()
  @Type(() => Object)
  @Transform(({ obj, key }) => parseAllergens(obj[key]))
  @IsObject()
  allergens?: Record<string, unknown>
}
