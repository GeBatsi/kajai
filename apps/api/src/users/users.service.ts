import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { PrismaService } from '../prisma/prisma.service'
import { MailTokenService } from '../mail-token/mail-token.service'
import { Prisma, Role } from '@kajai/db'
import { TokenService } from '../token/token.service'
import { calculateNutritionTargets, type ProfileInput } from './nutrition.util'
import * as bcrypt from 'bcrypt'
import { AuditService } from '../audit/audit.service'
import { REGISTERED_ROLES, type RegisteredRole } from '../auth/role-hierarchy'
import { MAX_BAN_REASON_LENGTH } from './dto/ban-user.dto'
import { UsersQueryDto } from './dto/users-query.dto'

// Only findByEmail (internal authentication) may retrieve the password hash.
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

const ADMIN_USER_SELECT = { ...USER_SELECT, bannedAt: true, banReason: true } satisfies Prisma.UserSelect
type AdminUser = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>

export type InternalUserUpdate = UpdateUserDto &
  Pick<Prisma.UserUpdateInput, 'password' | 'isVerified'>

@Injectable()
export class UsersService {

  constructor(
    private readonly prisma: PrismaService,
    private mailTokenService: MailTokenService,
    private tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async createAdmin(dto: CreateUserDto, actorId: string) {
    const role = dto.role === undefined ? Role.USER : dto.role
    this.assertRegisteredRole(role)
    const password = dto.password == null ? undefined : await bcrypt.hash(dto.password, 12)
    return this.adminTransaction(actorId, async (tx) => {
      const user = await this.create({ ...dto, role, password }, tx)
      await this.auditService.logWithTx(tx, {
        tableName: 'users', recordId: user.id, action: 'CREATE', userId: actorId,
        newValue: { role: user.role },
      })
      return user
    })
  }

  updateAdmin(id: string, dto: UpdateUserDto) {
    // Explicit mapping also prevents mass assignment without the HTTP validation pipe.
    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, image: dto.image },
      select: USER_SELECT,
    })
  }

 async create(dto: CreateUserDto, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    try {
      const user = await client.user.create({
        data: {
          email: dto.email,
          name: dto.name ?? null,
          image: dto.image ?? null,
          role: dto.role,
          profile: { create: {} },
          password:dto.password ?? null
        },
        select: USER_SELECT,
      })
      return user
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ez az e-mail cím már regisztrált')
      }
      throw e
    }
  }

  async findAll(query: UsersQueryDto = {}) {
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'asc' }]
    // Preserve the exact legacy array contract when no supported query is supplied.
    if (Object.values(query).every((value) => value === undefined)) {
      return this.prisma.user.findMany({ select: USER_SELECT, orderBy })
    }
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const where: Prisma.UserWhereInput = {
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { bannedAt: query.status === 'active' ? null : { not: null } } : {}),
    }
    // Both page and total see the same snapshot even during concurrent admin writes.
    return this.prisma.$transaction(async (tx) => {
      const data = await tx.user.findMany({ where, select: ADMIN_USER_SELECT, orderBy, skip: (page - 1) * limit, take: limit })
      const total = await tx.user.count({ where })
      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  async findOne(id: string) {
    return this.targetUser(this.prisma, id)
  }

  update(id: string, updateUserDto: InternalUserUpdate) {
    return this.prisma.user.update({
      where: {
        id,
      },
      data: updateUserDto,
      select: USER_SELECT,
    });
  }

  remove(id: string, actorId: string) {
    return this.adminTransaction(actorId, async (tx) => {
      this.assertNotSelf(id, actorId)
      const user = await this.targetUser(tx, id)
      await this.assertCanRemoveActiveAdmin(tx, user)
      // Freeze the reference graph, including owner/user reassignment, until delete commits.
      // Normal SELECTs still work; no concurrent write can slip past the reference check.
      await tx.$executeRaw`LOCK TABLE "recipes", "recipe_ingredients", "meal_logs", "favorites" IN SHARE ROW EXCLUSIVE MODE`
      const externalReference = await tx.recipe.findFirst({
        where: {
          ownerId: id,
          OR: [
            { mealLogs: { some: { userId: { not: id } } } },
            { favorites: { some: { userId: { not: id } } } },
            { usedIn: { some: { recipe: { ownerId: { not: id } } } } },
          ],
        },
        select: { id: true },
      })
      if (externalReference) {
        throw new ConflictException('A felhasználó receptjeire más felhasználók adatai hivatkoznak; a törlés nem végezhető el.')
      }
      const deleted = await tx.user.delete({ where: { id }, select: USER_SELECT })
      await this.auditService.logWithTx(tx, {
        tableName: 'users', recordId: id, action: 'DELETE', userId: actorId,
        oldValue: { role: user.role, bannedAt: user.bannedAt },
      })
      return deleted
    })
  }

  updateRole(id: string, role: RegisteredRole, actorId: string) {
    this.assertRegisteredRole(role)
    return this.adminTransaction(actorId, async (tx) => {
      this.assertNotSelf(id, actorId)
      const user = await this.targetUser(tx, id)
      if (user.role === role) return user
      if (role !== Role.ADMIN) await this.assertCanRemoveActiveAdmin(tx, user)
      const updated = await tx.user.update({ where: { id }, data: { role }, select: ADMIN_USER_SELECT })
      await this.auditService.logWithTx(tx, {
        tableName: 'users', recordId: id, action: 'UPDATE', userId: actorId,
        oldValue: { role: user.role }, newValue: { role },
      })
      return updated
    })
  }

  ban(id: string, reason: string, actorId: string) {
    const trimmed = typeof reason === 'string' ? reason.trim() : ''
    if (!trimmed || trimmed.length > MAX_BAN_REASON_LENGTH) {
      throw new BadRequestException(`A tiltás indoka 1–${MAX_BAN_REASON_LENGTH} karakter legyen.`)
    }
    return this.adminTransaction(actorId, async (tx) => {
      this.assertNotSelf(id, actorId)
      const user = await this.targetUser(tx, id)
      if (user.bannedAt !== null) return user
      await this.assertCanRemoveActiveAdmin(tx, user)
      const updated = await tx.user.update({
        where: { id }, data: { bannedAt: new Date(), banReason: trimmed }, select: ADMIN_USER_SELECT,
      })
      await this.logBanChange(tx, actorId, user, updated)
      return updated
    })
  }

  unban(id: string, actorId: string) {
    return this.adminTransaction(actorId, async (tx) => {
      const user = await this.targetUser(tx, id)
      if (user.bannedAt === null) return user
      const updated = await tx.user.update({
        where: { id }, data: { bannedAt: null, banReason: null }, select: ADMIN_USER_SELECT,
      })
      await this.logBanChange(tx, actorId, user, updated)
      return updated
    })
  }

  private logBanChange(tx: Prisma.TransactionClient, actorId: string, before: AdminUser, after: AdminUser) {
    return this.auditService.logWithTx(tx, {
      tableName: 'users', recordId: before.id, action: 'UPDATE', userId: actorId,
      oldValue: { bannedAt: before.bannedAt, banReason: before.banReason },
      newValue: { bannedAt: after.bannedAt, banReason: after.banReason },
    })
  }

  private async targetUser(client: PrismaService | Prisma.TransactionClient, id: string) {
    const user = await client.user.findUnique({ where: { id }, select: ADMIN_USER_SELECT })
    if (!user) throw new NotFoundException('Felhasználó nem található.')
    return user
  }

  private assertNotSelf(id: string, actorId: string) {
    if (id === actorId) throw new ForbiddenException('A saját fiókon ez az adminművelet nem engedélyezett.')
  }

  private assertRegisteredRole(role: Role) {
    if (!REGISTERED_ROLES.includes(role as RegisteredRole)) {
      throw new BadRequestException('Csak USER, MODERATOR vagy ADMIN szerepkör adható meg.')
    }
  }

  private async assertCanRemoveActiveAdmin(tx: Prisma.TransactionClient, user: AdminUser) {
    if (user.role === Role.ADMIN && user.bannedAt === null) {
      const count = await tx.user.count({ where: { role: Role.ADMIN, bannedAt: null } })
      if (count <= 1) throw new ConflictException('Az utolsó aktív admin nem távolítható el.')
    }
  }

  private async adminTransaction<T>(actorId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Conflicts with every users INSERT/UPDATE/DELETE, including concurrent admin operations.
        // Acquire BEFORE reading actor/count; ReadCommitted then sees the preceding commit.
        await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`
        const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, bannedAt: true } })
        if (!actor || actor.role !== Role.ADMIN || actor.bannedAt !== null) {
          throw new ForbiddenException('Aktív admin jogosultság szükséges.')
        }
        return operation(tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new NotFoundException('Felhasználó nem található.')
        if (error.code === 'P2003') throw new ConflictException('A felhasználóhoz kapcsolódó hivatkozások megakadályozzák a műveletet.')
        if (
          ['P2034', 'P2028'].includes(error.code) ||
          (error.code === 'P2010' && ['40P01', '40001', '55P03', '57014'].includes(String(error.meta?.code)))
        ) {
          throw new ConflictException('Párhuzamos vagy elhúzódó művelet miatt a kérés nem teljesült. Próbáld újra.')
        }
      }
      throw error
    }
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
  const data:InternalUserUpdate={
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

  // A mentett profil és a (még nem mentett) módosítások összefésülése.
  private mergeProfile(
    existing: {
      gender: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
      bodyFatPct: number | null
      activityLevel: ProfileInput['activityLevel']
      goalType: ProfileInput['goalType']
    },
    dto: UpdateProfileDto,
  ): ProfileInput {
    return {
      gender: dto.gender ?? existing.gender,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : existing.dateOfBirth,
      heightCm: dto.heightCm ?? existing.heightCm,
      weightKg: dto.weightKg ?? existing.weightKg,
      bodyFatPct: dto.bodyFatPct ?? existing.bodyFatPct,
      activityLevel: dto.activityLevel ?? existing.activityLevel,
      goalType: dto.goalType ?? existing.goalType,
    }
  }

  // Előnézet: kiszámolja a kalória- és makrókeretet a megadott adatokkal, mentés nélkül.
  async previewProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } })
    if (!existing) throw new NotFoundException('Profil nem található')

    return calculateNutritionTargets(this.mergeProfile(existing, dto))
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } })
    if (!existing) throw new NotFoundException('Profil nem található')

    const merged = this.mergeProfile(existing, dto)
    const targets = calculateNutritionTargets(merged)

    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        gender: merged.gender,
        dateOfBirth: merged.dateOfBirth,
        heightCm: merged.heightCm,
        weightKg: merged.weightKg,
        bodyFatPct: merged.bodyFatPct,
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
