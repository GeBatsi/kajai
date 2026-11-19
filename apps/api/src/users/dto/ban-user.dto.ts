import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export const MAX_BAN_REASON_LENGTH = 500

export class BanUserDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BAN_REASON_LENGTH)
  reason!: string
}

export class UnbanUserDto {}
