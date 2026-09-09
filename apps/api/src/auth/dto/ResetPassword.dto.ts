import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';


export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({message: 'hiányzó token'})
  token!: string;

 @IsString()
   @MinLength(8, {
     message: 'A jelszónak minimum 8 karakter hosszúnak kell lennie'
   })
   @Matches(/.*[0-9].*/, {
     message: 'A jelszónak legalább egy számot tartalmaznia kell'
   })
   password!: string;

   @IsNotEmpty({message: 'Hiányzó email cím'})
   @IsEmail({},{message:'Érvényes Email címet adj meg'})
   email!:string
}