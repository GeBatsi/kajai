import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { isDeepStrictEqual } from 'node:util'
import {
  NutritionCorrectionStatus,
  Prisma,
  Role,
  type FoodItem,
  type FoodNutritionCorrection,
} from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { FoodsService } from '../foods/foods.service'
import { normalizeStoredNutrition, parseNutrition } from '../foods/food-json.schema'
import { validateNutrition } from '../foods/nutrition-validation'
import { hasMinRole, RegisteredRole } from '../auth/role-hierarchy'
import {
  CorrectionQueryDto,
  ModerationCorrectionQueryDto,
  SubmitNutritionCorrectionDto,
} from './dto/nutrition-correction.dto'

const correctionSelect = {
  id: true,
  foodItemId: true,
  submittedById: true,
  reviewedById: true,
  originalNutrition: true,
  proposedNutrition: true,
  foodUpdatedAt: true,
  foodAuditVersion: true,
  reason: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  foodItem: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.FoodNutritionCorrectionSelect

@Injectable()
export class NutritionCorrectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly foods: FoodsService,
  ) {}

  async submit(foodItemId: string, dto: SubmitNutritionCorrectionDto, actorId: string) {
    const reason = this.reason(dto.reason)
    const patch = this.nutritionObject(dto.nutrition)
    if (!Object.keys(patch).length)
      throw new BadRequestException('A javaslat nem tartalmaz módosítást.')
    return this.transaction(async (tx) => {
      await this.actor(tx, actorId, Role.USER)
      await this.foods.lockForUpdate(tx, foodItemId)
      const food = await tx.foodItem.findUniqueOrThrow({ where: { id: foodItemId } })
      const original = normalizeStoredNutrition(food.nutrition)
      // No implicit g/ml conversion: the stored base must stay unchanged.
      if (patch.unit !== undefined && patch.unit !== (original.unit ?? 'g')) {
        throw new BadRequestException(
          'A tápérték egysége javítási javaslattal nem változtatható meg; ehhez teljes, ellenőrzött egységváltás szükséges.',
        )
      }
      const proposed = this.nutritionObject({ ...original, ...patch })
      if (isDeepStrictEqual(original, proposed))
        throw new BadRequestException('A javaslat megegyezik a jelenlegi tápértékkel.')
      const existing = await tx.foodNutritionCorrection.findFirst({
        where: { foodItemId, submittedById: actorId, status: NutritionCorrectionStatus.PENDING },
        select: { id: true },
      })
      if (existing)
        throw new ConflictException('Ehhez az élelmiszerhez már van függőben lévő javaslatod.')
      const created = await tx.foodNutritionCorrection.create({
        data: {
          foodItemId,
          submittedById: actorId,
          reason,
          originalNutrition: food.nutrition === null ? Prisma.DbNull : food.nutrition,
          proposedNutrition: proposed as Prisma.InputJsonObject,
          foodUpdatedAt: food.updatedAt,
          foodAuditVersion: await this.auditVersion(tx, foodItemId),
        },
        select: correctionSelect,
      })
      await this.audit.logWithTx(tx, {
        tableName: 'food_nutrition_corrections',
        recordId: created.id,
        action: 'CREATE',
        userId: actorId,
        newValue: { status: created.status, foodItemId, submittedAt: created.submittedAt },
      })
      return created
    })
  }

  mine(actorId: string, query: CorrectionQueryDto) {
    return this.page(
      { submittedById: actorId, ...(query.status ? { status: query.status } : {}) },
      query,
      'desc',
    )
  }

  list(query: ModerationCorrectionQueryDto) {
    if (
      query.submittedFrom &&
      query.submittedTo &&
      new Date(query.submittedFrom) > new Date(query.submittedTo)
    ) {
      throw new BadRequestException('A beküldési időszak kezdete nem lehet későbbi a végénél.')
    }
    return this.page(
      {
        status: query.status ?? NutritionCorrectionStatus.PENDING,
        ...(query.foodItemId ? { foodItemId: query.foodItemId } : {}),
        ...(query.submittedFrom || query.submittedTo
          ? {
              submittedAt: {
                ...(query.submittedFrom ? { gte: new Date(query.submittedFrom) } : {}),
                ...(query.submittedTo ? { lte: new Date(query.submittedTo) } : {}),
              },
            }
          : {}),
      },
      query,
      'asc',
    )
  }

  private page(
    where: Prisma.FoodNutritionCorrectionWhereInput,
    query: CorrectionQueryDto,
    order: 'asc' | 'desc',
  ) {
    const { page = 1, limit = 20 } = query
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.foodNutritionCorrection.count({ where })
        const data = await tx.foodNutritionCorrection.findMany({
          where,
          select: correctionSelect,
          orderBy: [{ submittedAt: order }, { id: order }],
          skip: (page - 1) * limit,
          take: limit,
        })
        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }

  detail(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const correction = await tx.foodNutritionCorrection.findUnique({
          where: { id },
          select: correctionSelect,
        })
        if (!correction) throw new NotFoundException('A tápérték-javítási javaslat nem található.')
        const food = correction.foodItemId
          ? await tx.foodItem.findUnique({ where: { id: correction.foodItemId } })
          : null
        const stale = !food || (await this.isStale(tx, correction, food))
        const own = correction.submittedById === actorId
        const approvalBlockedReason =
          correction.status !== NutritionCorrectionStatus.PENDING
            ? 'A javaslatot már elbírálták.'
            : !food
              ? 'Az élelmiszert törölték.'
              : stale
                ? 'Az élelmiszer a beküldés óta megváltozott.'
                : own
                  ? 'Saját javaslatot nem bírálhatsz el.'
                  : null
        return {
          ...correction,
          currentFood: food
            ? { id: food.id, name: food.name, nutrition: food.nutrition, updatedAt: food.updatedAt }
            : null,
          isStale: stale,
          canApprove: approvalBlockedReason === null,
          approvalBlockedReason,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }

  approve(id: string, actorId: string) {
    return this.transaction(async (tx) => {
      await this.actor(tx, actorId, Role.MODERATOR)
      const correction = await this.pending(tx, id, actorId)
      if (!correction.foodItemId)
        throw new ConflictException('A törölt élelmiszer javaslata nem hagyható jóvá.')
      await this.foods.lockForUpdate(tx, correction.foodItemId)
      const food = await tx.foodItem.findUniqueOrThrow({ where: { id: correction.foodItemId } })
      if (await this.isStale(tx, correction, food))
        throw new ConflictException(
          'Az élelmiszer időközben megváltozott. A javaslatot újra meg kell vizsgálni vagy el kell utasítani.',
        )
      const nutrition = this.nutritionObject(correction.proposedNutrition)
      if (
        nutrition.unit !== undefined &&
        nutrition.unit !== (normalizeStoredNutrition(food.nutrition).unit ?? 'g')
      ) {
        throw new BadRequestException('A javaslat nem változtathatja meg a tápérték egységét.')
      }
      await this.foods.updateWithAuditTx(
        tx,
        food,
        { nutrition: nutrition as Prisma.InputJsonObject },
        actorId,
      )
      return this.decide(tx, correction, actorId, NutritionCorrectionStatus.APPROVED)
    })
  }

  async reject(id: string, reason: string, actorId: string) {
    const trimmed = this.reason(reason)
    return this.transaction(async (tx) => {
      await this.actor(tx, actorId, Role.MODERATOR)
      const correction = await this.pending(tx, id, actorId)
      return this.decide(tx, correction, actorId, NutritionCorrectionStatus.REJECTED, trimmed)
    })
  }

  private async decide(
    tx: Prisma.TransactionClient,
    correction: FoodNutritionCorrection,
    actorId: string,
    status: NutritionCorrectionStatus,
    rejectionReason?: string,
  ) {
    const updated = await tx.foodNutritionCorrection.update({
      where: { id: correction.id },
      data: {
        status,
        reviewedById: actorId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason ?? null,
      },
      select: correctionSelect,
    })
    await this.audit.logWithTx(tx, {
      tableName: 'food_nutrition_corrections',
      recordId: correction.id,
      action: 'UPDATE',
      userId: actorId,
      oldValue: { status: correction.status },
      newValue: {
        status,
        reviewedById: actorId,
        reviewedAt: updated.reviewedAt,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    })
    return updated
  }

  private async pending(tx: Prisma.TransactionClient, id: string, actorId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "food_nutrition_corrections" WHERE "id" = ${id} FOR UPDATE`,
    )
    const correction = await tx.foodNutritionCorrection.findUnique({ where: { id } })
    if (!correction) throw new NotFoundException('A tápérték-javítási javaslat nem található.')
    if (correction.submittedById === actorId)
      throw new ForbiddenException('Saját javaslatot nem bírálhatsz el.')
    if (correction.status !== NutritionCorrectionStatus.PENDING)
      throw new ConflictException('A javaslatot már elbírálták.')
    return correction
  }

  private async actor(tx: Prisma.TransactionClient, id: string, minimum: RegisteredRole) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${id} FOR SHARE`)
    const actor = await tx.user.findUnique({
      where: { id },
      select: { role: true, bannedAt: true },
    })
    if (!actor || actor.bannedAt !== null || !hasMinRole(actor.role, minimum))
      throw new ForbiddenException('Aktív, megfelelő jogosultságú felhasználó szükséges.')
  }

  private auditVersion(tx: Prisma.TransactionClient, id: string) {
    return tx.auditLog.count({ where: { tableName: 'food_items', recordId: id } })
  }

  private async isStale(
    tx: Prisma.TransactionClient,
    correction: FoodNutritionCorrection,
    food: FoodItem,
  ) {
    return (
      correction.foodUpdatedAt.getTime() !== food.updatedAt.getTime() ||
      !isDeepStrictEqual(correction.originalNutrition, food.nutrition) ||
      correction.foodAuditVersion !== (await this.auditVersion(tx, food.id))
    )
  }

  private nutritionObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('A nutrition mezőt objektumként kell megadni.')
    const nutrition = parseNutrition(value)!
    validateNutrition(nutrition)
    return nutrition
  }

  private reason(value: string) {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (!trimmed || trimmed.length > 1000)
      throw new BadRequestException('Az indoklás 1–1000 karakter legyen.')
    return trimmed
  }

  private async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Ehhez az élelmiszerhez már van függőben lévő javaslatod.')
        if (error.code === 'P2025')
          throw new NotFoundException('Az érintett rekord már nem található.')
        if (
          ['P2003', 'P2034', 'P2028'].includes(error.code) ||
          (error.code === 'P2010' &&
            ['40P01', '40001', '55P03', '57014'].includes(String(error.meta?.code)))
        ) {
          throw new ConflictException(
            'Párhuzamos vagy elhúzódó művelet miatt a kérés nem teljesült. Frissítsd az adatokat.',
          )
        }
      }
      throw error
    }
  }
}
