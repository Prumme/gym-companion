import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { PersonalRecordsService } from './personal-records.service';

@ApiTags('personal-records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PersonalRecordsController {
  constructor(private readonly personalRecordsService: PersonalRecordsService) {}

  @Get('api/v1/personal-records')
  @ApiOperation({
    summary:
      'Records personnels courants (calculés à la demande depuis l’historique)',
  })
  @ApiQuery({ name: 'exerciseId', required: false, type: String })
  @ApiQuery({ name: 'recordType', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.personalRecordsService.list(user.id, query);
  }

  @Get('api/v1/exercises/:exerciseId/personal-records')
  @ApiOperation({
    summary: 'Records personnels courants pour un exercice accessible',
  })
  async listForExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ) {
    const data = await this.personalRecordsService.listForExercise(
      user.id,
      exerciseId,
    );
    return createSuccessResponse(data);
  }
}
