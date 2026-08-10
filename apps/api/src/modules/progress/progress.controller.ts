import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('api/v1/progress/exercises/:exerciseId')
  @ApiOperation({
    summary:
      'Progression temporelle d’un exercice (dérivée des séances terminées)',
  })
  @ApiQuery({ name: 'metric', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'equipmentId', required: false, type: String })
  async getExerciseProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const data = await this.progressService.getExerciseProgress(
      user.id,
      exerciseId,
      query,
    );
    return createSuccessResponse(data);
  }
}
