import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import {JwtService} from '@nestjs/jwt' ;
import {MailService} from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import crypto from "crypto";
import { MailTokenService } from '../mail-token/mail-token.service';

@Injectable()
export class AuthService {


constructor(
 private usersService:UsersService,
 private jwtService:JwtService,
 private mailService:MailService,
 private mailTokenService:MailTokenService,
){}



async register(dto:RegisterDto){

const exists = await this.usersService.findByEmail(dto.email);
if(exists){
 throw new ConflictException(
  'Ezzel az email címmel már létezik regisztráció'
 );
}

const passwordHash = await bcrypt.hash(dto.password,12);

const user = await this.usersService.create({
 email:dto.email,
 password:passwordHash,
 name:dto.name ? dto.name : undefined
 });

 const mailToken = crypto.randomBytes(32).toString("base64url");
 await this.mailTokenService.create(user.id, mailToken);
 
await this.mailService.sendVerificationEmail(user.email,mailToken);

return {
 message:'Sikeres regisztráció',
 user:{
   id:user.id,
   email:user.email,
   name:user.name,
 }
};
}

async login(email:string, password:string){
  const user = await this.usersService.findByEmail(email);
  if(!user){
    throw new UnauthorizedException('Hibás email vagy jelszó');
  }

  // Google OAuth-os felhasználó
  if(user.password === null){
    throw new UnauthorizedException('jelentkezzen be a google-lal');
  }

  if(!user.isVerified) {
    throw new UnauthorizedException('A felhasználó email címe nem validált');
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if(!passwordValid){
      throw new UnauthorizedException('Hibás email vagy jelszó');
  }
const token = this.jwtService.sign({
   sub:user.id,
   email:user.email,
 });

return {
 message:'Sikeres bejelentkezés',
 accessToken:token,
 user:{
   id:user.id,
   email:user.email,
   name:user.name,
 }
};
}


}


