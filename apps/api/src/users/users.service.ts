import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailTokenService } from '../mail-token/mail-token.service';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class UsersService {

  constructor(
    private readonly prisma: PrismaService,
    private mailTokenService: MailTokenService,
    private jwtService:JwtService
  ) {}

  create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        image: createUserDto.image,
        password: createUserDto.password,
      },
  })
}

  findAll() {
     return this.prisma.user.findMany();
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: {
        id,
      },
      data: updateUserDto,
    });
  }

  remove(id: string) {
   return this.prisma.user.delete({
      where: {
        id,
      },
    });
  }

  async findByEmail(email:string){
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
 };

 async verifyEmail(mailToken:string){
  
  const uToken=await this.mailTokenService.findByToken(mailToken);
  if(!uToken) throw new NotFoundException("Nincs ilyem validálható felhasználó");
  const data:UpdateUserDto={
    isVerified:true
  };
  const user=await this.update(uToken.userId,data);
  if(!user) {
    throw new NotFoundException("A felhasználó nem található")
  }
  const token = this.jwtService.sign({
   sub:user.id,
   email:user.email,
 });
  await this.mailTokenService.delete(uToken.id);
  return {
 message:'Sikeres email validáció és bejelentkezés',
 accessToken:token,
 user:{
   id:user.id,
   email:user.email,
   name:user.name,
 }
};
 }
}
