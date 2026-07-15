import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface AuthUser {
  id: string
  role: string
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserById(id: string) {
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
