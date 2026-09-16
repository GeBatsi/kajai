import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { ActivityLevel, GoalType } from '@kajai/db'
import { IsNotFutureDate } from './validators/is-not-future-date.validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  gender?: string

  @IsOptional()
  @IsDateString()
  @IsNotFutureDate()
  dateOfBirth?: string

  @IsOptional()
  @IsNumber()
  @Min(50)
  heightCm?: number

  @IsOptional()
  @IsNumber()
  @Min(20)
  weightKg?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bodyFatPct?: number

  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel

  @IsOptional()
  @IsEnum(GoalType)
  goalType?: GoalType
}
