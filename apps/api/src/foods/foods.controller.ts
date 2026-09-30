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
import { FoodItemType } from '@kajai/db'
import type { FoodItem, Prisma } from '@kajai/db'
import { FoodsService } from './foods.service'
import { CreateFoodDto } from './dto/create-food.dto'
import { UpdateFoodDto } from './dto/update-food.dto'
import { HttpCode, HttpStatus } from '@nestjs/common'
import { DevAuthGuard } from '../auth/guards/dev-auth.guard'
import { RolesGuard } from '../auth/guards/role.guard'
import { UseGuards } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
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
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image', foodImageUploadOptions))
  create(
    @Body() dto: CreateFoodDto,
    @CurrentUser() user: RequestUser,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<FoodItem> {
    return this.foodsService.create(dto, user.id, image)
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: FoodItemType,
  ): Promise<FoodItem[]> {
    return this.foodsService.findAll(search, type)
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<FoodItemWithDetailsResponse> {
    return this.foodsService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image', foodImageUploadOptions))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFoodDto,
    @CurrentUser() user: RequestUser,
  ): Promise<FoodItem> {
    return this.foodsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<FoodItem> {
    return this.foodsService.remove(id, user.id)
  }

  @Patch(':id/image')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image', foodImageUploadOptions))
  updateImage(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() image: Express.Multer.File,
  ): Promise<FoodItem> {
    return this.foodsService.updateImage(id, image, user.id)
  }

  @Delete(':id/image')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<FoodItem> {
    return this.foodsService.deleteImage(id, user.id)
  }
}
