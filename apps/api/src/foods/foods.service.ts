import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma, FoodItemType } from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFoodDto } from './dto/create-food.dto'
import { UpdateFoodDto } from './dto/update-food.dto'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateFoodDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdFood = await tx.foodItem.create({
          data: {
            name: dto.name,
            type: dto.type ?? FoodItemType.BASIC,
            brand: dto.brand,
            eanBarcode: dto.eanBarcode,
            category: dto.category,
            nutrition: dto.nutrition as Prisma.InputJsonValue | undefined,
            allergens: dto.allergens as Prisma.InputJsonValue | undefined,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'food_items',
          recordId: createdFood.id,
          action: 'CREATE',
          newValue: createdFood,
          userId,
        })

        return createdFood
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ez az EAN vonalkód már létezik.')
      }

      throw error
    }
  }

  async findAll(search?: string, type?: FoodItemType) {
    try {
      return await this.prisma.foodItem.findMany({
        where: {
          ...(type ? { type } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { brand: { contains: search, mode: 'insensitive' } },
                  { category: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { name: 'asc' },
        take: 50,
      })
    } catch (error) {
      this.logError('A food itemek lekérése sikertelen.', error)
      throw error
    }
  }

  async findOne(id: string) {
    try {
      const food = await this.prisma.foodItem.findUnique({
        where: { id },
        include: {
          ingredient: true,
          productAvailability: {
            include: { store: true },
          },
        },
      })

      if (!food) {
        throw new NotFoundException('Food item nem található.')
      }

      return food
    } catch (error) {
      this.logError(`A food item lekérése sikertelen: ${id}`, error)
      throw error
    }
  }

  async update(id: string, dto: UpdateFoodDto, userId: string) {
    try {
      const oldFood = await this.findOne(id)

      return await this.prisma.$transaction(async (tx) => {
        const updatedFood = await tx.foodItem.update({
          where: { id },
          data: {
            ...dto,
            nutrition: dto.nutrition as Prisma.InputJsonValue | undefined,
            allergens: dto.allergens as Prisma.InputJsonValue | undefined,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'food_items',
          recordId: id,
          action: 'UPDATE',
          oldValue: oldFood,
          newValue: updatedFood,
          userId,
        })

        return updatedFood
      })
    } catch (error) {
      this.logError(`A food item frissítése sikertelen: ${id}`, error)
      throw error
    }
  }

  async remove(id: string, userId: string) {
    try {
      const oldFood = await this.findOne(id)

      return await this.prisma.$transaction(async (tx) => {
        await tx.foodItem.delete({
          where: { id },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'food_items',
          recordId: id,
          action: 'DELETE',
          oldValue: oldFood,
          userId,
        })
      })
    } catch (error) {
      this.logError(`A food item törlése sikertelen: ${id}`, error)
      throw error
    }
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(message, error instanceof Error ? error.stack : String(error))
  }
}
