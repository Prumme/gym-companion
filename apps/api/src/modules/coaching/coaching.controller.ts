import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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
    'api/v1/coaching/exercises/:exerciseId/plateau-analysis',
  )
  @ApiOperation({
    summary:
      'Analyse déterministe de stagnation / plateau (lecture seule, WEIGHT_REPS)',
  })
  @ApiQuery({ name: 'equipmentId', required: false, type: String })
  async getPlateauAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const data = await this.coachingService.getPlateauAnalysis(
      user.id,
      exerciseId,
      query,
    );
    return createSuccessResponse(data);
  }

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

  @Post(
    'api/v1/coaching/workout-template-exercises/:workoutTemplateExerciseId/load-recommendation/decision',
  )
  @ApiOperation({
    summary:
      'Décision utilisateur (ACCEPTED / ADJUSTED / IGNORED) sur une recommandation de charge',
  })
  async decideLoadRecommendation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutTemplateExerciseId', ParseUUIDPipe)
    workoutTemplateExerciseId: string,
    @Body() body: unknown,
  ) {
    const data = await this.coachingService.decideLoadRecommendation(
      user.id,
      workoutTemplateExerciseId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Get(
    'api/v1/coaching/workout-template-exercises/:workoutTemplateExerciseId/load-recommendation-decisions',
  )
  @ApiOperation({
    summary: 'Historique des décisions de charge pour un exercice du modèle',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listLoadRecommendationDecisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutTemplateExerciseId', ParseUUIDPipe)
    workoutTemplateExerciseId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.coachingService.listLoadRecommendationDecisions(
      user.id,
      workoutTemplateExerciseId,
      query,
    );
  }
}
