import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
@IsNotEmpty({message: 'Az email cím nem lehet üres'})
@IsEmail({},{message: 'Érvényes email címet adj meg'})
  email!: string;
}