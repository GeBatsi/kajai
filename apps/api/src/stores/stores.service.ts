import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@kajai/db'
import { PrismaService } from '../prisma/prisma.service'
import { CreateStoreDto } from './dto/create-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateStoreDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdStore = await tx.store.create({
          data: {
            name: dto.name.trim(),
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'stores',
          recordId: createdStore.id,
          action: 'CREATE',
          newValue: createdStore,
          userId,
        })

        return createdStore
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ilyen nevű bolt már létezik.')
      }

      throw error
    }
  }

  async findAll(search?: string) {
    try {
      return await this.prisma.store.findMany({
        where: search
          ? {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : undefined,
        orderBy: {
          name: 'asc',
        },
      })
    } catch (error) {
      this.logError('A boltok lekérése sikertelen.', error)
      throw error
    }
  }

  async findOne(id: string) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id },
        include: {
          products: {
            include: {
              foodItem: true,
            },
          },
        },
      })

      if (!store) {
        throw new NotFoundException('Store nem található.')
      }

      return store
    } catch (error) {
      this.logError(`A bolt lekérése sikertelen: ${id}`, error)
      throw error
    }
  }

  async update(id: string, dto: UpdateStoreDto, userId: string) {
    const oldStore = await this.findOne(id)

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedStore = await tx.store.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
          },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'stores',
          recordId: id,
          action: 'UPDATE',
          oldValue: oldStore,
          newValue: updatedStore,
          userId,
        })

        return updatedStore
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ilyen nevű bolt már létezik.')
      }

      throw error
    }
  }

  async remove(id: string, userId: string) {
    const oldStore = await this.findOne(id)

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.store.delete({
          where: { id },
        })

        await this.auditService.logWithTx(tx, {
          tableName: 'stores',
          recordId: id,
          action: 'DELETE',
          oldValue: oldStore,
          userId,
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Ez a bolt nem törölhető, mert termékelérhetőségi rekordok kapcsolódnak hozzá.',
        )
      }

      throw error
    }
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(message, error instanceof Error ? error.stack : String(error))
  }
}
