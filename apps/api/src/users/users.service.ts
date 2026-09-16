import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { PrismaService } from '../prisma/prisma.service'
import { MailTokenService } from '../mail-token/mail-token.service'
import { Prisma } from '@kajai/db'
import { TokenService } from '../token/token.service'
import { calculateNutritionTargets, type ProfileInput } from './nutrition.util'

@Injectable()
export class UsersService {

  constructor(
    private readonly prisma: PrismaService,
    private mailTokenService: MailTokenService,
    private tokenService: TokenService
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

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } })
    if (!profile) throw new NotFoundException('Profil nem található')
    return profile
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } })
    if (!existing) throw new NotFoundException('Profil nem található')

    const merged: ProfileInput = {
      gender: dto.gender ?? existing.gender,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : existing.dateOfBirth,
      heightCm: dto.heightCm ?? existing.heightCm,
      weightKg: dto.weightKg ?? existing.weightKg,
      activityLevel: dto.activityLevel ?? existing.activityLevel,
      goalType: dto.goalType ?? existing.goalType,
    }
    const targets = calculateNutritionTargets(merged)

    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        gender: merged.gender,
        dateOfBirth: merged.dateOfBirth,
        heightCm: merged.heightCm,
        weightKg: merged.weightKg,
        bodyFatPct: dto.bodyFatPct ?? existing.bodyFatPct,
        activityLevel: merged.activityLevel,
        goalType: merged.goalType,
        tdeeKcal: targets?.tdeeKcal ?? null,
        dailyKcal: targets?.dailyKcal ?? null,
        proteinG: targets?.proteinG ?? null,
        carbsG: targets?.carbsG ?? null,
        fatG: targets?.fatG ?? null,
      },
    })
  }
}
