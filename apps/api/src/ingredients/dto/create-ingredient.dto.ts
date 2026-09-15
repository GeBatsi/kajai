import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  foodItemId!: string;

  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  density?: number;

  @IsOptional()
  @IsBoolean()
  isGeneric?: boolean;
}
