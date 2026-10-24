import { Test, TestingModule } from '@nestjs/testing';
import { MailTokenService } from './mail-token.service';

describe('MailTokenService', () => {
  let service: MailTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailTokenService],
    }).compile();

    service = module.get<MailTokenService>(MailTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
