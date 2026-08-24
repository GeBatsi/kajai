import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProductAvailabilityDto } from './dto/create-product-availability.dto'
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto'
import { AuditService } from '../audit/audit.service'
import { mapProductAvailabilityResponse } from './product-availability-response.mapper'

@Injectable()
export class ProductAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateProductAvailabilityDto, userId: string) {
    try {
      return this.prisma.$transaction(async (tx) => {
        const [foodItem, store, productAvailability] = await Promise.all([
          tx.foodItem.findUnique({
            where: { id: dto.foodItemId },
          }),
          tx.store.findUnique({
            where: { id: dto.storeId },
          }),
          tx.productAvailability.findUnique({
            where: {
              foodItemId_storeId: {
                foodItemId: dto.foodItemId,
                storeId: dto.storeId,
              },
            },
          }),
        ])

        if (!foodItem) {
          throw new NotFoundException('A kapcsolódó FoodItem nem található.')
        }

        if (!store) {
          throw new NotFoundException('A kapcsolódó Store nem található.')
        }
        if (productAvailability) {
          throw new ConflictException('A kapcsolódó ProductAvailability már létezik.')
        }

        const createdAvailability = await tx.productAvailability.create({
          data: {
            foodItemId: dto.foodItemId,
            storeId: dto.storeId,
            price: dto.price,
            unitPrice: dto.unitPrice,
            isAvailable: dto.isAvailable ?? true,
            priceUpdatedAt:
              dto.price !== undefined || dto.unitPrice !== undefined ? new Date() : undefined,
          },
          include: {
            foodItem: true,
            store: true,
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'product_availability',
          recordId: createdAvailability.id,
          action: 'CREATE',
          newValue: createdAvailability,
          userId,
        })

        return mapProductAvailabilityResponse(createdAvailability)
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Ehhez a termékhez ebben a boltban már létezik elérhetőségi rekord.',
        )
      }

      throw error
    }
  }

  async findAll(foodItemId?: string, storeId?: string, onlyAvailable?: boolean) {
    const availabilities = await this.prisma.productAvailability.findMany({
      where: {
        ...(foodItemId ? { foodItemId } : {}),
        ...(storeId ? { storeId } : {}),
        ...(onlyAvailable !== undefined ? { isAvailable: onlyAvailable } : {}),
      },
      include: {
        foodItem: true,
        store: true,
      },
      orderBy: {
        priceUpdatedAt: 'desc',
      },
    })

    return availabilities.map(mapProductAvailabilityResponse)
  }

  async findOne(id: string) {
    return mapProductAvailabilityResponse(await this.findOneEntity(id))
  }

  private async findOneEntity(id: string) {
    const availability = await this.prisma.productAvailability.findUnique({
      where: { id },
      include: {
        foodItem: true,
        store: true,
      },
    })

    if (!availability) {
      throw new NotFoundException('Product availability nem található.')
    }

    return availability
  }

  async update(id: string, dto: UpdateProductAvailabilityDto, userId: string) {
    const oldAvailability = await this.findOneEntity(id)

    const isPriceChanged = dto.price !== undefined || dto.unitPrice !== undefined

    return this.prisma.$transaction(async (tx) => {
      const updatedAvailability = await tx.productAvailability.update({
        where: { id },
        data: {
          price: dto.price,
          unitPrice: dto.unitPrice,
          isAvailable: dto.isAvailable,
          ...(isPriceChanged ? { priceUpdatedAt: new Date() } : {}),
        },
        include: {
          foodItem: true,
          store: true,
        },
      })

      await this.auditService.logWithTx(tx, {
        tableName: 'product_availability',
        recordId: id,
        action: 'UPDATE',
        oldValue: oldAvailability,
        newValue: updatedAvailability,
        userId,
      })

      return mapProductAvailabilityResponse(updatedAvailability)
    })
  }

  async remove(id: string, userId: string) {
    const oldAvailability = await this.findOneEntity(id)

    return this.prisma.$transaction(async (tx) => {

      await this.auditService.logWithTx(tx, {
        tableName: 'product_availability',
        recordId: id,
        action: 'DELETE',
        oldValue: oldAvailability,
        userId,
      })
    })
  }
}
