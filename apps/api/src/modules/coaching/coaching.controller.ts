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
import { AiCoachChatService } from './ai/ai-coach-chat.service';
import { AiCoachExplanationService } from './ai/ai-coach-explanation.service';
import { CoachSummaryService } from './coach-summary.service';
import { CoachingService } from './coaching.service';

@ApiTags('coaching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CoachingController {
  constructor(
    private readonly coachingService: CoachingService,
    private readonly coachSummaryService: CoachSummaryService,
    private readonly aiCoachExplanationService: AiCoachExplanationService,
    private readonly aiCoachChatService: AiCoachChatService,
  ) {}

  @Get('api/v1/coaching/overview')
  @ApiOperation({
    summary:
      'Vue Coach globale : exercices récents nécessitant potentiellement attention',
  })
  async getCoachingOverview(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.coachSummaryService.getCoachingOverview(user.id);
    return createSuccessResponse(data);
  }

  @Get('api/v1/coaching/exercises/:exerciseId/summary')
  @ApiOperation({
    summary: 'Synthèse Coach déterministe pour un exercice (lecture seule)',
  })
  @ApiQuery({ name: 'equipmentId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getExerciseCoachSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const data = await this.coachSummaryService.getExerciseCoachSummary(
      user.id,
      exerciseId,
      query,
    );
    return createSuccessResponse(data);
  }

  @Post('api/v1/coaching/exercises/:exerciseId/explanation')
  @ApiOperation({
    summary:
      'Génère une explication IA à partir du ExerciseCoachSummary déterministe (5.5)',
  })
  async generateExerciseCoachExplanation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() body: unknown,
  ) {
    const data =
      await this.aiCoachExplanationService.generateExerciseExplanation(
        user.id,
        exerciseId,
        body ?? {},
      );
    return createSuccessResponse(data);
  }

  @Post('api/v1/coaching/conversations')
  @ApiOperation({ summary: 'Crée une conversation Coach (5.6)' })
  async createAiCoachConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.aiCoachChatService.createConversation(
      user.id,
      body ?? {},
    );
    return createSuccessResponse(data);
  }

  @Get('api/v1/coaching/conversations')
  @ApiOperation({ summary: 'Liste les conversations Coach' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listAiCoachConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.aiCoachChatService.listConversations(user.id, query);
  }

  @Get('api/v1/coaching/conversations/:conversationId')
  @ApiOperation({ summary: 'Détail d’une conversation Coach' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAiCoachConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const data = await this.aiCoachChatService.getConversation(
      user.id,
      conversationId,
      query,
    );
    return createSuccessResponse(data);
  }

  @Post('api/v1/coaching/conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Envoie un message dans une conversation Coach' })
  async sendAiCoachMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: unknown,
  ) {
    const data = await this.aiCoachChatService.sendMessage(
      user.id,
      conversationId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post('api/v1/coaching/conversations/:conversationId/archive')
  @ApiOperation({ summary: 'Archive une conversation Coach' })
  async archiveAiCoachConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    const data = await this.aiCoachChatService.archiveConversation(
      user.id,
      conversationId,
    );
    return createSuccessResponse(data);
  }

  @Get('api/v1/coaching/exercises/:exerciseId/plateau-analysis')
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
