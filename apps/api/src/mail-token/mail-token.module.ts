import { Module } from '@nestjs/common';
import { MailTokenService } from './mail-token.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MailTokenService],
   exports: [MailTokenService],
})
export class MailTokenModule {}
