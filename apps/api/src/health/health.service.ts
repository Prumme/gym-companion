import { Injectable } from '@nestjs/common';
import type { HealthCheckResult } from '@gym-companion/shared';

import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLive(): HealthCheckResult {
    return { status: 'ok' };
  }

  async getReady(): Promise<HealthCheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        checks: {
          database: { status: 'ok' },
        },
      };
    } catch {
      return {
        status: 'error',
        checks: {
          database: {
            status: 'error',
            message: 'Database unreachable',
          },
        },
      };
    }
  }
}
