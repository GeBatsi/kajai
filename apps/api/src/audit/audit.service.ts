import { Injectable } from '@nestjs/common';
import { Prisma } from '@kajai/db';
import { PrismaService } from '../prisma/prisma.service';
import { WriteAuditLogParams } from './audit.types';

type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: WriteAuditLogParams) {
    return this.createAuditLog(this.prisma, params);
  }

  async logWithTx(
    tx: PrismaTransactionClient,
    params: WriteAuditLogParams,
  ) {
    return this.createAuditLog(tx, params);
  }

  private async createAuditLog(
    client: PrismaService | PrismaTransactionClient,
    params: WriteAuditLogParams,
  ) {
    return client.auditLog.create({
      data: {
        tableName: params.tableName,
        recordId: params.recordId,
        action: params.action,
        oldValue: this.toJson(params.oldValue),
        newValue: this.toJson(params.newValue),
        userId: params.userId,
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}