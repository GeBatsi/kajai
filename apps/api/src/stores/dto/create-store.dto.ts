import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}