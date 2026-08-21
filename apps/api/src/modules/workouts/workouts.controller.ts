import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@ApiBearerAuth()
@Controller('api/v1/workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get()
  @ApiOperation({
    summary: 'Historique des séances terminées ou annulées (pagination cursor)',
  })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.workoutsService.listHistory(user.id, query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Séance active ou en pause de l’utilisateur' })
  async getActive(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.workoutsService.getActive(user.id);
    return createSuccessResponse(data);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer une séance active depuis un modèle (snapshot immuable)',
  })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = await this.workoutsService.create(user.id, body);
    return createSuccessResponse(data);
  }

  @Post(':workoutSessionId/pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mettre une séance en pause' })
  async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
    @Body() body: unknown,
  ) {
    const data = await this.workoutsService.pause(
      user.id,
      workoutSessionId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':workoutSessionId/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reprendre une séance en pause' })
  async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
    @Body() body: unknown,
  ) {
    const data = await this.workoutsService.resume(
      user.id,
      workoutSessionId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':workoutSessionId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Terminer une séance' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
    @Body() body: unknown,
  ) {
    const data = await this.workoutsService.complete(
      user.id,
      workoutSessionId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':workoutSessionId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annuler une séance' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
    @Body() body: unknown,
  ) {
    const data = await this.workoutsService.cancel(
      user.id,
      workoutSessionId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Get(':workoutSessionId')
  @ApiOperation({ summary: 'Détail d’une séance (snapshot)' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
  ) {
    const data = await this.workoutsService.getById(user.id, workoutSessionId);
    return createSuccessResponse(data);
  }

  @Patch(':workoutSessionId/exercises/:sessionExerciseId/exercise')
  @ApiOperation({
    summary:
      'Remplacer l’exercice catalogue d’une ligne de séance (snapshot session uniquement)',
  })
  async replaceExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
    @Param('sessionExerciseId', ParseUUIDPipe) sessionExerciseId: string,
    @Body() body: unknown,
  ) {
    const data = await this.workoutsService.replaceExercise(
      user.id,
      workoutSessionId,
      sessionExerciseId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Patch(':workoutSessionId/exercises/:sessionExerciseId/sets/:workoutSetId')
  @ApiOperation({ summary: 'Enregistrer le résultat réel d’une série' })
  async updateSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
    @Param('sessionExerciseId', ParseUUIDPipe) sessionExerciseId: string,
    @Param('workoutSetId', ParseUUIDPipe) workoutSetId: string,
    @Body() body: unknown,
  ) {
    const data = await this.workoutsService.updateSet(
      user.id,
      workoutSessionId,
      sessionExerciseId,
      workoutSetId,
      body,
    );
    return createSuccessResponse(data);
  }
}
