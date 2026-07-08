import { Test, TestingModule } from '@nestjs/testing';
import { ProductAvailabilityService } from './product-availability.service';

describe('ProductAvailabilityService', () => {
  let service: ProductAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductAvailabilityService],
    }).compile();

    service = module.get<ProductAvailabilityService>(ProductAvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
