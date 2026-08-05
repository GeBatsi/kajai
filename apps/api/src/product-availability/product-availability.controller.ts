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
} from '@nestjs/common';
import type { Prisma, ProductAvailability } from '@kajai/db';
import { ProductAvailabilityService } from './product-availability.service';
import { CreateProductAvailabilityDto } from './dto/create-product-availability.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';
import type { ProductAvailabilityResponse } from './product-availability-response.mapper';

type ProductAvailabilityWithDetails = Prisma.ProductAvailabilityGetPayload<{
  include: {
    foodItem: true;
    store: true;
  };
}>;

type ProductAvailabilityWithDetailsResponse =
  ProductAvailabilityResponse<ProductAvailabilityWithDetails>;

@Controller('product-availability')
export class ProductAvailabilityController {
  constructor(
    private readonly productAvailabilityService: ProductAvailabilityService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateProductAvailabilityDto,
  ): Promise<ProductAvailabilityWithDetailsResponse> {
    return this.productAvailabilityService.create(dto);
  }

  @Get()
  findAll(
    @Query('foodItemId') foodItemId?: string,
    @Query('storeId') storeId?: string,
    @Query('onlyAvailable', new ParseBoolPipe({ optional: true }))
    onlyAvailable?: boolean,
  ): Promise<ProductAvailabilityWithDetailsResponse[]> {
    return this.productAvailabilityService.findAll(
      foodItemId,
      storeId,
      onlyAvailable,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ): Promise<ProductAvailabilityWithDetailsResponse> {
    return this.productAvailabilityService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductAvailabilityDto,
  ): Promise<ProductAvailabilityWithDetailsResponse> {
    return this.productAvailabilityService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
  ): Promise<ProductAvailabilityResponse<ProductAvailability>> {
    return this.productAvailabilityService.remove(id);
  }
}
