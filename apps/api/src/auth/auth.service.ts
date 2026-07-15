import { ConflictException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import {JwtService} from '@nestjs/jwt' ;
import {MailService} from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {


constructor(
 private usersService:UsersService,
 private jwtService:JwtService,
 private mailService:MailService
){}



async register(dto:RegisterDto){


const exists =
 await this.usersService.findByEmail(dto.email);


if(exists){

 throw new ConflictException(
  'Ezzel az email címmel már létezik regisztráció'
 );

}



const passwordHash = await bcrypt.hash(dto.password,12);

const user = await this.usersService.create({

 email:dto.email,

 password:passwordHash,


 });



await this.mailService.sendVerificationEmail(user.email);



const token =
 this.jwtService.sign({
   sub:user.id,
   email:user.email
 });



return {

 message:'Sikeres regisztráció',

 accessToken:token,

 user:{
   id:user.id,
   email:user.email
 }

};


}

}
