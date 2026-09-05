import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { FoodItemType } from '@kajai/db'
import type { Prisma } from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { CreateIngredientDto } from './dto/create-ingredient.dto'
import { UpdateIngredientDto } from './dto/update-ingredient.dto'
import { AuditService } from '../audit/audit.service'

type IngredientWithFoodItem = Prisma.IngredientGetPayload<{
  include: {
    foodItem: true
  }
}>

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateIngredientDto, userId: string): Promise<IngredientWithFoodItem> {
    try {
      const foodItem = await this.prisma.foodItem.findUnique({
        where: { id: dto.foodItemId },
      })

      if (!foodItem) {
        throw new NotFoundException('A kapcsolódó FoodItem nem található.')
      }

      // Javasolt üzleti szabály:
      // Ingredient rekord csak BASIC típusú FoodItemhez tartozhat.
      if (foodItem.type !== FoodItemType.BASIC) {
        throw new ConflictException('Ingredient csak BASIC típusú FoodItemhez hozható létre.')
      }

      const existingIngredient = await this.prisma.ingredient.findUnique({
        where: { foodItemId: dto.foodItemId },
      })

      if (existingIngredient) {
        throw new ConflictException('Ehhez a FoodItemhez már tartozik Ingredient rekord.')
      }

      return await this.prisma.$transaction(async (tx) => {
        const createdIngredient = await tx.ingredient.create({
          data: {
            foodItemId: dto.foodItemId,
            defaultUnit: dto.defaultUnit,
            density: dto.density,
            isGeneric: dto.isGeneric ?? true,
          },
          include: {
            foodItem: true,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'ingredients',
          recordId: createdIngredient.id,
          action: 'CREATE',
          newValue: createdIngredient,
          userId,
        })

        return createdIngredient
      })
    } catch (error) {
      this.logError('Ingredient létrehozása sikertelen.', error)
      throw error
    }
  }

  async findAll(): Promise<IngredientWithFoodItem[]> {
    try {
      return await this.prisma.ingredient.findMany({
        include: {
          foodItem: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    } catch (error) {
      this.logError('Az ingredientek lekérése sikertelen.', error)
      throw error
    }
  }

  async findOne(id: string): Promise<IngredientWithFoodItem> {
    try {
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { id },
        include: {
          foodItem: true,
        },
      })

      if (!ingredient) {
        throw new NotFoundException('Ingredient nem található.')
      }

      return ingredient
    } catch (error) {
      this.logError(`Az ingredient lekérése sikertelen: ${id}`, error)
      throw error
    }
  }

  async findByFoodItemId(foodItemId: string): Promise<IngredientWithFoodItem> {
    try {
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { foodItemId },
        include: {
          foodItem: true,
        },
      })

      if (!ingredient) {
        throw new NotFoundException('Ehhez a FoodItemhez nem tartozik Ingredient rekord.')
      }

      return ingredient
    } catch (error) {
      this.logError(`Az ingredient lekérése FoodItem alapján sikertelen: ${foodItemId}`, error)
      throw error
    }
  }

  async update(
    id: string,
    dto: UpdateIngredientDto,
    userId: string,
  ): Promise<IngredientWithFoodItem> {
    try {
      const oldIngredient = await this.findOne(id)

      return await this.prisma.$transaction(async (tx) => {
        const updatedIngredient = await tx.ingredient.update({
          where: { id },
          data: {
            defaultUnit: dto.defaultUnit,
            density: dto.density,
            isGeneric: dto.isGeneric,
          },
          include: {
            foodItem: true,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'ingredients',
          recordId: id,
          action: 'UPDATE',
          oldValue: oldIngredient,
          newValue: updatedIngredient,
          userId,
        })

        return updatedIngredient
      })
    } catch (error) {
      this.logError(`Az ingredient frissítése sikertelen: ${id}`, error)
      throw error
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      const oldIngredient = await this.findOne(id)

      return await this.prisma.$transaction(async (tx) => {
        await tx.ingredient.delete({
          where: { id },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'ingredients',
          recordId: id,
          action: 'DELETE',
          oldValue: oldIngredient,
          userId,
        })
      })
    } catch (error) {
      this.logError(`Az ingredient törlése sikertelen: ${id}`, error)
      throw error
    }
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(message, error instanceof Error ? error.stack : String(error))
  }
}
