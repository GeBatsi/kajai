import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  foodItemId!: string;

  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
