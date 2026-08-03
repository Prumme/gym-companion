import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthCheckResult } from '@gym-companion/shared';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  live(): HealthCheckResult {
    return this.healthService.getLive();
  }

  @Get('ready')
  async ready(): Promise<HealthCheckResult> {
    const result = await this.healthService.getReady();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
