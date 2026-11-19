import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailTokenService } from '../mail-token/mail-token.service';
import { TokenService } from '../token/token.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: AuditService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: MailTokenService, useValue: {} },
        { provide: TokenService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
