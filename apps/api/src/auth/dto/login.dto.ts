import { IsEmail, IsNotEmpty, IsString,MinLength } from 'class-validator';

export class LoginDto {

  @IsEmail({}, {
    message: 'Érvényes email címet adjon meg'
  })
  @IsNotEmpty({
    message: 'Az email megadása kötelező'
  })
  email!: string;


  @IsString()
  @MinLength(8, {
      message: 'A jelszónak minimum 8 karakter hosszúnak kell lennie'
    })
  @IsNotEmpty({
    message: 'A jelszó megadása kötelező'
  })
  password!: string;

}