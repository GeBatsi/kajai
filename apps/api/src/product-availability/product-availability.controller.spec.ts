import { Test, TestingModule } from '@nestjs/testing';
import { ProductAvailabilityController } from './product-availability.controller';
import { ProductAvailabilityService } from './product-availability.service';

describe('ProductAvailabilityController', () => {
  let controller: ProductAvailabilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductAvailabilityController],
      providers: [ProductAvailabilityService],
    }).compile();

    controller = module.get<ProductAvailabilityController>(ProductAvailabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
