import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailTokenService } from '../mail-token/mail-token.service';
import { Prisma } from '@kajai/db'
import {TokenService} from '../token/token.service'


@Injectable()
export class UsersService {

  constructor(
    private readonly prisma: PrismaService,
    private mailTokenService: MailTokenService,
    private tokenService:TokenService
  ) {}

 async create(dto: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name ?? null,
          image: dto.image ?? null,
          role: dto.role,
          profile: { create: {} },
          password:dto.password ?? null
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          createdAt: true,
        },
      })
      return user
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ez az e-mail cím már regisztrált')
      }
      throw e
    }
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
  const token = this.tokenService.generateToken(user.id,user.email)
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

 async getUserWithProfilById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            gender: true,
            dateOfBirth: true,
            heightCm: true,
            weightKg: true,
            activityLevel: true,
            goalType: true,
            tdeeKcal: true,
            dailyKcal: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
          },
        },
      },
    })

    if (!user) throw new NotFoundException('Felhasználó nem található')
    return user
  }

}

