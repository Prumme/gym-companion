import { describe, expect, it, vi } from 'vitest';

import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma/prisma.service';

describe('HealthService', () => {
  it('reports live status without dependencies', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    } as unknown as PrismaService;

    const service = new HealthService(prisma);
    expect(service.getLive()).toEqual({ status: 'ok' });
  });
});
