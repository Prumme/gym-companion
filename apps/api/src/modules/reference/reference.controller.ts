import { Controller, Get } from '@nestjs/common';
import { createSuccessResponse } from '@gym-companion/shared';

import { ReferenceService } from './reference.service';

@Controller('api/v1/reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('muscle-groups')
  async listMuscleGroups() {
    const data = await this.referenceService.listMuscleGroups();
    return createSuccessResponse(data);
  }

  @Get('equipment-types')
  async listEquipmentTypes() {
    const data = await this.referenceService.listEquipmentTypes();
    return createSuccessResponse(data);
  }
}
