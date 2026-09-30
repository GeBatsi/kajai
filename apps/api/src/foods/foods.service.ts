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

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateFoodDto, userId: string, image?: Express.Multer.File) {
    const nutrition = typeof dto.nutrition === 'string' ? JSON.parse(dto.nutrition) : dto.nutrition

    const allergens = typeof dto.allergens === 'string' ? JSON.parse(dto.allergens) : dto.allergens

    let uploadedImageUrl: string | undefined

    try {
      const createdFood = await this.prisma.$transaction(async (tx) => {
        const createdFood = await tx.foodItem.create({
          data: {
            name: dto.name,
            type: dto.type ?? FoodItemType.BASIC,
            brand: dto.brand,
            eanBarcode: dto.eanBarcode,
            category: dto.category,
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

      if (!image) {
        return createdFood
      }

      const uploadedImage = await this.storageService.uploadFoodImage(image, createdFood.id)

      uploadedImageUrl = uploadedImage.url

      const foodWithImage = await this.prisma.$transaction(async (tx) => {
        const oldValue = createdFood

        const updatedFood = await tx.foodItem.update({
          where: { id: createdFood.id },
          data: {
            imageUrl: uploadedImage.url,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'food_items',
          recordId: updatedFood.id,
          action: 'UPDATE',
          oldValue,
          newValue: updatedFood,
          userId,
        })

        return updatedFood
      })

      return foodWithImage
    } catch (error) {
      if (uploadedImageUrl) {
        await this.storageService.deleteFileByUrl(uploadedImageUrl)
      }

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

      return {
        ...food,
        productAvailability: food.productAvailability.map(mapProductAvailabilityResponse),
      }
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
          this.logError(`A food item képfájl törlése sikertelen a storage-ból: ${id}`, storageError)
        }
      }

      return deletedFood
    } catch (error) {
      this.logError(`A food item törlése sikertelen: ${id}`, error)
      throw error
    }
  }

  async updateImage(id: string, image: Express.Multer.File, userId: string) {
    if (!image) {
      throw new BadRequestException('Image file is required.')
    }

    const existingFood = await this.prisma.foodItem.findUnique({
      where: { id },
    })

    if (!existingFood) {
      throw new NotFoundException('Food item not found.')
    }

    if (existingFood.type !== FoodItemType.BASIC) {
      throw new BadRequestException('Image update endpoint is only available for BASIC food items.')
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
        } catch (error) {
          this.logger.warn(`Old food image could not be deleted from storage. foodItemId=${id}`)
        }
      }

      return updatedFood
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.storageService.deleteFileByUrl(uploadedImageUrl)
        } catch (deleteError) {
          this.logger.warn(
            `Uploaded food image cleanup failed after update error. foodItemId=${id}`,
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
      throw new NotFoundException('Food item not found.')
    }

    if (existingFood.type !== FoodItemType.BASIC) {
      throw new BadRequestException('Image delete endpoint is only available for BASIC food items.')
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
    } catch (error) {
      this.logger.warn(`Food image could not be deleted from storage. foodItemId=${id}`)
    }

    return updatedFood
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(message, error instanceof Error ? error.stack : String(error))
  }
}
