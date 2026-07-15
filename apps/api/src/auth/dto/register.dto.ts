import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {

  @IsEmail({}, {
    message: 'Érvényes email címet adj meg'
  })
  email!: string;


  @IsString()
  @MinLength(8, {
    message: 'A jelszónak minimum 8 karakter hosszúnak kell lennie'
  })
  @Matches(/.*[0-9].*/, {
    message: 'A jelszónak legalább egy számot tartalmaznia kell'
  })
  password!: string;
}