import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenType } from '@prisma/client';

@Injectable()
export class MailTokenService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  create(userId: string, token: string,tokenType:TokenType) {
    return this.prisma.mailToken.create({
      data: {
        userId,
        mailToken: token,
        type: tokenType
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

  createPasswordToken(){
    
  }
}
