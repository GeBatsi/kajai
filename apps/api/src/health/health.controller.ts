import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

// Docker healthcheck, CI füstteszt és a staging deploy ellenőrzése használja.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' })
    }
    return { status: 'ok', database: 'ok' }
  }
}
