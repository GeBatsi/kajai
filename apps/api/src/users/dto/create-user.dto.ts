import { Role } from '@prisma/client';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsEnum,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { REGISTERED_ROLES } from '../../auth/role-hierarchy';


export class CreateUserDto {

  @IsEmail({}, {
    message: 'Érvényes email címet adj meg'
  })
  email!: string;


  @IsOptional()
  @IsString()
 
  name?: string;


  @IsOptional()
  @IsString()
  image?: string;


  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'A jelszónak minimum 8 karakter hosszúnak kell lennie'
  })
  @Matches(/.*[0-9].*/, {
    message: 'A jelszónak legalább egy számot tartalmaznia kell'
  })
  password?: string;

   @IsOptional()
   isVerified?:boolean

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Role)
  @IsIn(REGISTERED_ROLES)
  role?: Role

}
