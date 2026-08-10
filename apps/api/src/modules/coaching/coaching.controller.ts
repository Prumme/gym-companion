import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { CoachingService } from './coaching.service';

@ApiTags('coaching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  @Get(
    'api/v1/coaching/workout-template-exercises/:workoutTemplateExerciseId/load-recommendation',
  )
  @ApiOperation({
    summary:
      'Recommandation déterministe de charge (lecture seule, WEIGHT_REPS)',
  })
  async getLoadRecommendation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutTemplateExerciseId', ParseUUIDPipe)
    workoutTemplateExerciseId: string,
  ) {
    const data = await this.coachingService.getLoadRecommendation(
      user.id,
      workoutTemplateExerciseId,
    );
    return createSuccessResponse(data);
  }
}
