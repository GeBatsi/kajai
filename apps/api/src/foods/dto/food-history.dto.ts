import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

export class FoodHistoryQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20
}

export class RestoreFoodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  auditId!: string

  @IsIn(['before', 'after'])
  side!: 'before' | 'after'

  @IsDateString({ strict: true })
  expectedUpdatedAt!: string

  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  expectedLatestAuditId!: string | null
}
