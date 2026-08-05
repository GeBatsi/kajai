import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { Prisma } from '@kajai/db'
import { calculateNutritionTargets, type ProfileInput } from './nutrition.util'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name ?? null,
          image: dto.image ?? null,
          role: dto.role,
          profile: { create: {} },
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
