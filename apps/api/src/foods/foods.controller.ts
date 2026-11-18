import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FoodItemType, Role } from '@kajai/db'
import type { FoodItem, Prisma } from '@kajai/db'
import { FoodsService } from './foods.service'
import { CreateFoodDto } from './dto/create-food.dto'
import { UpdateFoodDto } from './dto/update-food.dto'
import { FoodHistoryQueryDto, RestoreFoodDto } from './dto/food-history.dto'
import { HttpCode, HttpStatus } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { MinRole } from '../auth/decorators/min-role.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RequestUser } from '../auth/types/request-user.type'
import type { ProductAvailabilityResponse } from '../product-availability/product-availability-response.mapper'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { BadRequestException } from '@nestjs/common'

const MAX_FOOD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const foodImageUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FOOD_IMAGE_SIZE_BYTES,
  },
  fileFilter: (
    req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          'Érvénytelen képformátum. Engedélyezett formátumok: jpg, png, webp.',
        ),
        false,
      )
    }

    callback(null, true)
  },
}

type FoodItemWithDetails = Prisma.FoodItemGetPayload<{
  include: {
    ingredient: true
    productAvailability: {
      include: { store: true }
    }
  }
}>

type FoodItemWithDetailsResponse = Omit<FoodItemWithDetails, 'productAvailability'> & {
  productAvailability: ProductAvailabilityResponse<
    FoodItemWithDetails['productAvailability'][number]
  >[]
}

@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post()
  @MinRole(Role.MODERATOR)
  @UseInterceptors(FileInterceptor('image', foodImageUploadOptions))
  create(
    @Body() dto: CreateFoodDto,
    @CurrentUser() user: RequestUser,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<FoodItem> {
    return this.foodsService.create(dto, user.id, image)
  }

  @Get()
  @Public()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: FoodItemType,
  ): Promise<FoodItem[]> {
    return this.foodsService.findAll(search, type)
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string): Promise<FoodItemWithDetailsResponse> {
    return this.foodsService.findOne(id)
  }

  @Patch(':id')
  @MinRole(Role.MODERATOR)
  @UseInterceptors(FileInterceptor('image', foodImageUploadOptions))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFoodDto,
    @CurrentUser() user: RequestUser,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<FoodItem> {
    if (image) {
      throw new BadRequestException('A képet külön kell menteni. Használd a Kép mentése gombot.')
    }
    return this.foodsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @MinRole(Role.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<FoodItem> {
    return this.foodsService.remove(id, user.id)
  }

  @Get(':id/history')
  @MinRole(Role.MODERATOR)
  history(@Param('id') id: string, @Query() query: FoodHistoryQueryDto) {
    return this.foodsService.history(id, query)
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @MinRole(Role.MODERATOR)
  restore(@Param('id') id: string, @Body() dto: RestoreFoodDto, @CurrentUser() user: RequestUser) {
    return this.foodsService.restore(id, dto, user.id)
  }

  @Patch(':id/image')
  @MinRole(Role.MODERATOR)
  @UseInterceptors(FileInterceptor('image', foodImageUploadOptions))
  updateImage(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() image: Express.Multer.File,
  ): Promise<FoodItem> {
    return this.foodsService.updateImage(id, image, user.id)
  }

  @Delete(':id/image')
  @MinRole(Role.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<FoodItem> {
    return this.foodsService.deleteImage(id, user.id)
  }
}
