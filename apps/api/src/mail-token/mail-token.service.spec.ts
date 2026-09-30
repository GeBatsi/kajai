import { Test, TestingModule } from '@nestjs/testing';
import { MailTokenService } from './mail-token.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MailTokenService', () => {
  let service: MailTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailTokenService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<MailTokenService>(MailTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
