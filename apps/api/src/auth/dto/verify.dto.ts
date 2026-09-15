import { IsNotEmpty, IsString } from "class-validator";

export class verifyEmail{

@IsString()
@IsNotEmpty({
    message: 'ellenőrző kulcs megadása kötelező'
  })
id!:string
}
