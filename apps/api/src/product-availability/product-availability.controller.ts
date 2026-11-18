import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import type { Prisma } from '@kajai/db'
import { ProductAvailabilityService } from './product-availability.service'
import { CreateProductAvailabilityDto } from './dto/create-product-availability.dto'
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto'
import type { ProductAvailabilityResponse } from './product-availability-response.mapper'
import { HttpCode, HttpStatus } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/types/request-user.type';

type ProductAvailabilityWithDetails = Prisma.ProductAvailabilityGetPayload<{
  include: {
    foodItem: true
    store: true
  }
}>

type ProductAvailabilityWithDetailsResponse =
  ProductAvailabilityResponse<ProductAvailabilityWithDetails>

@Controller('product-availability')
export class ProductAvailabilityController {
  constructor(private readonly productAvailabilityService: ProductAvailabilityService) {}

  @Post()
  @Roles('ADMIN')
  create(
    @Body() dto: CreateProductAvailabilityDto,
    @CurrentUser() user: RequestUser
  ): Promise<ProductAvailabilityWithDetailsResponse> {
    return this.productAvailabilityService.create(dto, user.id)
  }

  @Get()
  @Public()
  findAll(
    @Query('foodItemId') foodItemId?: string,
    @Query('storeId') storeId?: string,
    @Query('onlyAvailable', new ParseBoolPipe({ optional: true }))
    onlyAvailable?: boolean,
  ): Promise<ProductAvailabilityWithDetailsResponse[]> {
    return this.productAvailabilityService.findAll(foodItemId, storeId, onlyAvailable)
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string): Promise<ProductAvailabilityWithDetailsResponse> {
    return this.productAvailabilityService.findOne(id)
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductAvailabilityDto,
    @CurrentUser() user: RequestUser
  ): Promise<ProductAvailabilityWithDetailsResponse> {
    return this.productAvailabilityService.update(id, dto, user.id)
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.productAvailabilityService.remove(id, user.id)
  }
}
