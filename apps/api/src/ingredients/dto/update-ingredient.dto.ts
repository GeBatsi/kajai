import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateIngredientDto {
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
