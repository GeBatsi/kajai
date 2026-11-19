import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator'
import { Role } from '@kajai/db'
import { REGISTERED_ROLES, type RegisteredRole } from '../../auth/role-hierarchy'

// Reject empty strings, arrays, decimals and scientific notation instead of coercing them.
const integerQuery = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value

export class UsersQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(200)
  search?: string

  @IsOptional()
  @IsEnum(Role)
  @IsIn(REGISTERED_ROLES)
  role?: RegisteredRole

  @IsOptional()
  @IsIn(['active', 'banned'])
  status?: 'active' | 'banned'

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page?: number

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
