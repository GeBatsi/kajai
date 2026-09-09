import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateProductAvailabilityDto {
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