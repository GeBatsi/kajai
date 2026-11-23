import { Transform, Type } from 'class-transformer'
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { NutritionCorrectionStatus } from '@kajai/db'

export class CorrectionReasonDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string
}

export class SubmitNutritionCorrectionDto extends CorrectionReasonDto {
  @Transform(({ obj, key }) => obj[key])
  @IsObject()
  nutrition!: Record<string, unknown>
}

export class CorrectionQueryDto {
  @IsOptional()
  @IsEnum(NutritionCorrectionStatus)
  status?: NutritionCorrectionStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20
}

export class ModerationCorrectionQueryDto extends CorrectionQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  foodItemId?: string

  @IsOptional()
  @IsDateString({ strict: true })
  submittedFrom?: string

  @IsOptional()
  @IsDateString({ strict: true })
  submittedTo?: string
}

// Forbid forged actor/status fields even on the otherwise bodyless approval endpoint.
export class ApproveNutritionCorrectionDto {}
