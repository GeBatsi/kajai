import { BadGatewayException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
// import {JwtService} from '@nestjs/jwt' ;
import {MailService} from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import crypto from "crypto";
import { MailTokenService } from '../mail-token/mail-token.service';
import { NotFoundException } from '@nestjs/common'
// import { PrismaService } from '../prisma/prisma.service'
import { TokenService } from '../token/token.service'
import { UpdateUserDto } from '../users/dto/update-user.dto';

export interface AuthUser {
  id: string
  role: string
}

@Injectable()
export class AuthService {


constructor(
 private usersService:UsersService,
 // private jwtService:JwtService,
 private mailService:MailService,
 private mailTokenService:MailTokenService,
 // private readonly prisma: PrismaService,
 private tokenService:TokenService,
){}



async register(dto:RegisterDto){

  const exists = await this.usersService.findByEmail(dto.email);
  if(exists){
  throw new ConflictException(
    'Ezzel az email címmel már létezik regisztráció'
  );
  }

  const mailToken = crypto.randomBytes(32).toString("base64url");
  try{
    const passwordHash = await bcrypt.hash(dto.password,12);
    await this.mailService.sendVerificationEmail(dto.email,mailToken);
    const user = await this.usersService.create({
      email:dto.email,
      password:passwordHash,
      name:dto.name ? dto.name : undefined
    });
    
    await this.mailTokenService.create(user.id, mailToken,'EMAIL_VERIFICATION');
    return {
    message:'Sikeres regisztráció',
    user:{
      id:user.id,
      email:user.email,
      name:user.name,
    }
  };
  }catch{
    throw new BadGatewayException("Validációs email küldése sikertelen");    
  }
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
// const token = this.tokenService.generateToken(user.id,user.email);

return {
 message:'Sikeres bejelentkezés',
 // accessToken:token,
 user:{
   id:user.id,
   email:user.email,
   name:user.name,
   role:user.role
 }
};
}

  async getUserById(id: string) {
    const user= await this.usersService.getUserWithProfilById(id);
    if (!user) throw new NotFoundException('Felhasználó nem található')
    return user
  }

  async verifyEmail(token: string) {
  const mailToken = await this.mailTokenService.findByToken(token)
    console.log("mailtokem:",mailToken)
  if (!mailToken) {
    throw new UnauthorizedException(
      'Érvénytelen email megerősítő token.',
    )
  }

  const result = await this.usersService.verifyEmail(token)
  // console.log("eredmény::: ",result)
  if(!result) {
    throw new UnauthorizedException('sikertelen email validáció.')
  }
  // await this.mailTokenService.delete(mailToken.id)

  return result
}

async forgotPassword(email:string){
  const mailToken = crypto.randomBytes(32).toString("base64url");
  try{
    const user=await this.usersService.findByEmail(email,)
    if(user){
      await this.mailService.sendNewPasswordEmail(user.email,mailToken);
      await this.mailTokenService.create(user.id, mailToken,'PASSWORD_RESET');
    }
  }catch{console.log("gyanús új jelszó kérés vagy az emailcím elérhetetlen")}
 return {message:'Email küldtünk a további teendőkröl'}
}

async resetPassword(email:string, password:string, token:string){
  let success=true;
  try{
    const passwordHash = await bcrypt.hash(password,12);  
    const mailToken = await this.mailTokenService.findByToken(token)

    if (!mailToken) throw new Error() 

    const user = await this.usersService.findByEmail(email)
    console.log(user,email)
    if (!user || user.password === null) {
      throw new Error()
    }

    if (user.id !== mailToken.userId) throw new Error()

    if (Date.now()-mailToken.createdAt.getTime() <= 3600*1000) {
      const data:UpdateUserDto={password:passwordHash}
      await this.usersService.update(user.id,data)
    }
    else success=false
    console.log("siker: ",success)

    await this.mailTokenService.delete(mailToken.id)
    if(!success) throw new Error()
} catch {throw new ConflictException("Sikertelen jelszó módosítás")}
return {message:'Jelszómódosítás sikeres'}
}

async changePassword( token: string, currentPassword: string, newPassword: string) {
  try {
    const mailToken = await this.mailTokenService.findByToken(token);

    if (!mailToken) {
      throw new UnauthorizedException(
        'Érvénytelen vagy lejárt jelszómódosító link.',
      );
    }
/*
    if (mailToken.type !== 'PASSWORD_RESET') {
      throw new UnauthorizedException(
        'Érvénytelen jelszómódosító token.',
      );
    }
*/

    const tokenAge = Date.now() - mailToken.createdAt.getTime();
    const experied = 24 * 3600 * 1000; // 1 nap érvényesség

    if (tokenAge > experied) {
      await this.mailTokenService.delete(mailToken.id);

      throw new UnauthorizedException(
        'A jelszómódosító link lejárt.',
      );
    }

    const user = mailToken.user;

    if (!user) {
      throw new UnauthorizedException( 'A felhasználó nem található.' );
    }

    if (!user.password) {
      throw new UnauthorizedException( 'Google felhasznlók jelszava itt nem módosítható' );
    }

    const currentPasswordValid = await bcrypt.compare( currentPassword, user.password );

    if (!currentPasswordValid) {
      throw new UnauthorizedException( 'A jelenlegi jelszó hibás.' );
    }

    const samePassword = await bcrypt.compare( newPassword, user.password );

    if (samePassword) { 
      throw new ConflictException( 'Az új jelszó nem lehet azonos a jelenlegi jelszóval.' ); 
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const data: UpdateUserDto = { password: passwordHash };

    await this.usersService.update( user.id, data );

    await this.mailTokenService.delete( mailToken.id );

    return { message: 'Jelszómódosítás sikeres' };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new ConflictException( 'Sikertelen jelszómódosítás' );
   }
  }

  async requestPasswordChange(userId: string) {
    const user = await this.usersService.findOne(userId)

    if (!user) { throw new NotFoundException( 'Felhasználó nem található' ) }

    if (user.password === null) {
      throw new ConflictException( 'Google-fiókkal bejelentkező felhasználó jelszava itt nem módosítható' )
    }

    try {
      await this.mailTokenService.deleteAllPasswordResetTokens( user.id )

      const mailToken = crypto.randomBytes(32).toString('base64url')

      await this.mailTokenService.create( user.id, mailToken, 'PASSWORD_RESET' )

      await this.mailService.sendChangePasswordEmail( user.email, mailToken )

      return {
        message: 'A jelszómódosításhoz szükséges emailt elküldtük.',
      }
      } catch (error) {
        console.error( 'Password change email error:', error)
        throw new BadGatewayException('A jelszómódosító email küldése sikertelen.')
    }
  }
}