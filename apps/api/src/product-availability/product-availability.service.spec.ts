import { Test, TestingModule } from '@nestjs/testing';
import { ProductAvailabilityService } from './product-availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('ProductAvailabilityService', () => {
  let service: ProductAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductAvailabilityService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductAvailabilityService>(ProductAvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
