import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ActivityLevel, GoalType } from '@kajai/db'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  gender?: string

  @IsOptional()
  @IsDateString()
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
  bodyFatPct?: number

  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel

  @IsOptional()
  @IsEnum(GoalType)
  goalType?: GoalType
}
