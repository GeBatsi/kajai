import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailTokenService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  create(userId: string, token: string) {
    return this.prisma.mailToken.create({
      data: {
        userId,
        mailToken: token,
      },
    });
  }

  findByToken(token: string) {
    return this.prisma.mailToken.findUnique({
      where: {
        mailToken: token,
      },
      include: {
        user: true,
      },
    });
  }

  delete(id: string) {
    return this.prisma.mailToken.delete({
      where: {
        id,
      },
    });
  }
}
