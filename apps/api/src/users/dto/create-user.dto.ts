import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator'
import { Role } from '@kajai/db'

export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @IsEnum(Role)
  role?: Role
}
