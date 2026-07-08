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

type ProductAvailabilityWithDetails = Prisma.ProductAvailabilityGetPayload<{
  include: {
    foodItem: true;
    store: true;
  };
}>;

@Controller('product-availability')
export class ProductAvailabilityController {
  constructor(
    private readonly productAvailabilityService: ProductAvailabilityService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateProductAvailabilityDto,
  ): Promise<ProductAvailabilityWithDetails> {
    return this.productAvailabilityService.create(dto);
  }

  @Get()
  findAll(
    @Query('foodItemId') foodItemId?: string,
    @Query('storeId') storeId?: string,
    @Query('onlyAvailable', new ParseBoolPipe({ optional: true }))
    onlyAvailable?: boolean,
  ): Promise<ProductAvailabilityWithDetails[]> {
    return this.productAvailabilityService.findAll(
      foodItemId,
      storeId,
      onlyAvailable,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductAvailabilityWithDetails> {
    return this.productAvailabilityService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductAvailabilityDto,
  ): Promise<ProductAvailabilityWithDetails> {
    return this.productAvailabilityService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<ProductAvailability> {
    return this.productAvailabilityService.remove(id);
  }
}
