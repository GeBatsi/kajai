import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, FoodItemType } from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFoodDto } from './dto/create-food.dto'
import { UpdateFoodDto } from './dto/update-food.dto'
import { AuditService } from '../audit/audit.service'
import { mapProductAvailabilityResponse } from '../product-availability/product-availability-response.mapper'
import { StorageService } from '../storage/storage.service'
import { normalizeStoredNutrition, parseAllergens, parseNutrition } from './food-json.schema'

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateFoodDto, userId: string, image?: Express.Multer.File) {
    const nutrition = parseNutrition(dto.nutrition)

    this.validateNutrition(nutrition)

    const allergens = parseAllergens(dto.allergens)

    let uploadedImageUrl: string | undefined

    try {
      await this.assertUniqueBasicFood(dto.name, dto.category, dto.type ?? FoodItemType.BASIC)

      if (image) {
        const uploadedImage = await this.storageService.uploadFoodImage(image)
        uploadedImageUrl = uploadedImage.url
      }

      return await this.prisma.$transaction(async (tx) => {
        const createdFood = await tx.foodItem.create({
          data: {
            name: dto.name,
            type: dto.type ?? FoodItemType.BASIC,
            brand: dto.brand,
            eanBarcode: dto.eanBarcode,
            category: dto.category,
            imageUrl: uploadedImageUrl,
            nutrition: nutrition as Prisma.InputJsonValue | undefined,
            allergens: allergens as Prisma.InputJsonValue | undefined,
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
      if (uploadedImageUrl) {
        try {
          await this.storageService.deleteFileByUrl(uploadedImageUrl)
        } catch (storageError) {
          this.logError(
            'A feltöltött élelmiszerkép törlése a sikertelen létrehozás után nem sikerült.',
            storageError,
          )
        }
      }

      this.rethrowFoodError(error)
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
      this.logError('Az élelmiszerek lekérése sikertelen.', error)
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
        throw new NotFoundException('Az élelmiszer nem található.')
      }

      return {
        ...food,
        productAvailability: food.productAvailability.map(mapProductAvailabilityResponse),
      }
    } catch (error) {
      this.logError(`Az élelmiszer lekérése sikertelen: ${id}`, error)
      throw error
    }
  }

  async update(id: string, dto: UpdateFoodDto, userId: string) {
    try {
      const nutritionPatch = parseNutrition(dto.nutrition)
      const allergens = parseAllergens(dto.allergens)
      if (
        nutritionPatch !== undefined &&
        (nutritionPatch === null ||
          typeof nutritionPatch !== 'object' ||
          Array.isArray(nutritionPatch))
      ) {
        throw new BadRequestException('A tápértékeket objektumként kell megadni.')
      }

      const oldFood = await this.findOne(id)
      let nutrition: Record<string, unknown> | undefined
      if (nutritionPatch !== undefined && Object.keys(nutritionPatch).length > 0) {
        const previousNutrition = normalizeStoredNutrition(oldFood.nutrition)
        nutrition = { ...previousNutrition, ...nutritionPatch }
        this.validateNutrition(nutrition)
      }

      await this.assertUniqueBasicFood(
        dto.name ?? oldFood.name,
        dto.category === undefined ? oldFood.category : dto.category,
        dto.type ?? oldFood.type,
        id,
      )

      return await this.prisma.$transaction(async (tx) => {
        const updatedFood = await tx.foodItem.update({
          where: { id },
          data: {
            ...dto,
            nutrition: nutrition as Prisma.InputJsonValue | undefined,
            allergens: allergens as Prisma.InputJsonValue | undefined,
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
      this.logError(`Az élelmiszer frissítése sikertelen: ${id}`, error)
      this.rethrowFoodError(error)
    }
  }

  async remove(id: string, userId: string) {
    try {
      const oldFood = await this.findOne(id)
      const imageUrlToDelete = oldFood.imageUrl

      const deletedFood = await this.prisma.$transaction(async (tx) => {
        const deletedFood = await tx.foodItem.delete({
          where: { id },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'food_items',
          recordId: id,
          action: 'DELETE',
          oldValue: oldFood,
          newValue: null,
          userId,
        })

        return deletedFood
      })

      if (imageUrlToDelete) {
        try {
          await this.storageService.deleteFileByUrl(imageUrlToDelete)
        } catch (storageError) {
          this.logError(
            `Az élelmiszer képfájljának törlése a tárhelyről sikertelen: ${id}`,
            storageError,
          )
        }
      }

      return deletedFood
    } catch (error) {
      this.logError(`Az élelmiszer törlése sikertelen: ${id}`, error)
      throw error
    }
  }

  async updateImage(id: string, image: Express.Multer.File, userId: string) {
    if (!image) {
      throw new BadRequestException('Képfájl megadása kötelező.')
    }

    const existingFood = await this.prisma.foodItem.findUnique({
      where: { id },
    })

    if (!existingFood) {
      throw new NotFoundException('Az élelmiszer nem található.')
    }

    if (existingFood.type !== FoodItemType.BASIC) {
      throw new BadRequestException('Kép módosítása csak alap típusú élelmiszereknél lehetséges.')
    }

    let uploadedImageUrl: string | undefined

    try {
      const uploadedImage = await this.storageService.uploadFoodImage(image, existingFood.id)

      uploadedImageUrl = uploadedImage.url

      const updatedFood = await this.prisma.$transaction(async (tx) => {
        const result = await tx.foodItem.update({
          where: { id },
          data: {
            imageUrl: uploadedImage.url,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'food_items',
          recordId: result.id,
          action: 'UPDATE',
          oldValue: existingFood,
          newValue: result,
          userId,
        })

        return result
      })

      if (existingFood.imageUrl) {
        try {
          await this.storageService.deleteFileByUrl(existingFood.imageUrl)
        } catch {
          this.logger.warn(
            `Az élelmiszer régi képét nem sikerült törölni a tárhelyről. foodItemId=${id}`,
          )
        }
      }

      return updatedFood
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.storageService.deleteFileByUrl(uploadedImageUrl)
        } catch {
          this.logger.warn(
            `A feltöltött élelmiszerkép törlése a sikertelen módosítás után nem sikerült. foodItemId=${id}`,
          )
        }
      }

      throw error
    }
  }

  async deleteImage(id: string, userId: string) {
    const existingFood = await this.prisma.foodItem.findUnique({
      where: { id },
    })

    if (!existingFood) {
      throw new NotFoundException('Az élelmiszer nem található.')
    }

    if (existingFood.type !== FoodItemType.BASIC) {
      throw new BadRequestException('Kép törlése csak alap típusú élelmiszereknél lehetséges.')
    }

    if (!existingFood.imageUrl) {
      return existingFood
    }

    const updatedFood = await this.prisma.$transaction(async (tx) => {
      const result = await tx.foodItem.update({
        where: { id },
        data: {
          imageUrl: null,
        },
      })

      await this.auditService.logWithTx(tx, {
        tableName: 'food_items',
        recordId: result.id,
        action: 'UPDATE',
        oldValue: existingFood,
        newValue: result,
        userId,
      })

      return result
    })

    try {
      await this.storageService.deleteFileByUrl(existingFood.imageUrl)
    } catch {
      this.logger.warn(`Az élelmiszer képét nem sikerült törölni a tárhelyről. foodItemId=${id}`)
    }

    return updatedFood
  }

  private async assertUniqueBasicFood(
    name: string,
    category: string | null | undefined,
    type: FoodItemType,
    excludeId?: string,
  ): Promise<void> {
    if (type !== FoodItemType.BASIC) {
      return
    }

    // Keep normalization identical to the partial unique index, including legacy rows.
    const duplicates = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "food_items"
      WHERE "type" = 'BASIC'
        AND lower(btrim("name")) = lower(btrim(${name}))
        AND lower(btrim(COALESCE("category", ''))) = lower(btrim(${category ?? ''}))
        ${excludeId === undefined ? Prisma.empty : Prisma.sql`AND "id" <> ${excludeId}`}
      LIMIT 1
    `)

    if (duplicates.length > 0) {
      throw new ConflictException('Ilyen nevű alapanyag már létezik ebben a kategóriában.')
    }
  }

  private rethrowFoodError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Expression indexes can report SQL expressions instead of Prisma field names.
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(',')
        : String(error.meta?.target ?? '')

      if (target.includes('name') && target.includes('category')) {
        throw new ConflictException('Ilyen nevű alapanyag már létezik ebben a kategóriában.')
      }

      if (target.includes('eanBarcode')) {
        throw new ConflictException('Ez az EAN vonalkód már létezik.')
      }
    }

    throw error
  }

  private validateNutrition(nutrition?: Record<string, unknown> | null): void {
    if (!nutrition) {
      return
    }

    const amount = (field: string): number => {
      const value = nutrition[field] ?? 0

      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException(
          'A tápanyagmennyiségek csak nemnegatív, véges számok lehetnek.',
        )
      }

      return value
    }

    const energyKcal = amount('energyKcal')
    if (energyKcal > 900) {
      throw new BadRequestException('Az energia mennyisége legfeljebb 900 kcal lehet.')
    }
    const protein = amount('protein')
    const carbs = amount('carbs')
    const fat = amount('fat')
    const fiber = amount('fiber')
    const salt = amount('salt')
    const sugar = amount('sugar')
    const saturatedFat = amount('saturatedFat')
    const total = new Prisma.Decimal(protein).plus(carbs).plus(fat).plus(fiber).plus(salt)

    if (total.greaterThan(100)) {
      throw new BadRequestException(
        'A fehérje, szénhidrát, zsír, rost és só együttes mennyisége legfeljebb 100 g lehet.',
      )
    }

    if (sugar > carbs) {
      throw new BadRequestException(
        'A cukor mennyisége nem haladhatja meg a szénhidrát mennyiségét.',
      )
    }

    if (saturatedFat > fat) {
      throw new BadRequestException(
        'A telített zsír mennyisége nem haladhatja meg a zsír mennyiségét.',
      )
    }
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(message, error instanceof Error ? error.stack : String(error))
  }
}
