import { Module } from '@nestjs/common';
import { ProductAvailabilityService } from './product-availability.service';
import { ProductAvailabilityController } from './product-availability.controller';

@Module({
  controllers: [ProductAvailabilityController],
  providers: [ProductAvailabilityService],
})
export class ProductAvailabilityModule {}
