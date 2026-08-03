import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { ProgramsService } from './programs.service';

@ApiTags('programs')
@ApiBearerAuth()
@Controller('api/v1/programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste paginée des programmes de l’utilisateur' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.programsService.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un programme' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = await this.programsService.create(user.id, body);
    return createSuccessResponse(data);
  }

  @Get(':programId')
  @ApiOperation({ summary: 'Détail d’un programme avec modèles ordonnés' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    const data = await this.programsService.getById(user.id, programId);
    return createSuccessResponse(data);
  }

  @Patch(':programId')
  @ApiOperation({ summary: 'Modifier les informations générales d’un programme' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.update(user.id, programId, body);
    return createSuccessResponse(data);
  }

  @Delete(':programId')
  @ApiOperation({ summary: 'Archiver un programme' })
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    const data = await this.programsService.archive(user.id, programId);
    return createSuccessResponse(data);
  }

  @Post(':programId/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restaurer un programme archivé' })
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    const data = await this.programsService.restore(user.id, programId);
    return createSuccessResponse(data);
  }

  @Post(':programId/workout-templates')
  @ApiOperation({ summary: 'Ajouter un modèle de séance vide à la fin' })
  async createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.createWorkoutTemplate(
      user.id,
      programId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Put(':programId/workout-templates/order')
  @ApiOperation({ summary: 'Réordonner les modèles de séance' })
  async reorderTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.reorderWorkoutTemplates(
      user.id,
      programId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Patch(':programId/workout-templates/:workoutTemplateId')
  @ApiOperation({ summary: 'Modifier un modèle de séance' })
  async updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.updateWorkoutTemplate(
      user.id,
      programId,
      workoutTemplateId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Delete(':programId/workout-templates/:workoutTemplateId')
  @ApiOperation({
    summary: 'Supprimer un modèle de séance et compacter les positions',
  })
  async deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
  ) {
    const data = await this.programsService.deleteWorkoutTemplate(
      user.id,
      programId,
      workoutTemplateId,
    );
    return createSuccessResponse(data);
  }

  @Post(':programId/workout-templates/:workoutTemplateId/exercises')
  @ApiOperation({ summary: 'Ajouter un exercice accessible à un modèle' })
  async addExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.addExercise(
      user.id,
      programId,
      workoutTemplateId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Put(':programId/workout-templates/:workoutTemplateId/exercises/order')
  @ApiOperation({ summary: 'Réordonner les exercices d’un modèle' })
  async reorderExercises(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.reorderExercises(
      user.id,
      programId,
      workoutTemplateId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Patch(
    ':programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId',
  )
  @ApiOperation({ summary: 'Modifier la configuration d’un exercice du modèle' })
  async updateExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Param('templateExerciseId', ParseUUIDPipe) templateExerciseId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.updateExercise(
      user.id,
      programId,
      workoutTemplateId,
      templateExerciseId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Delete(
    ':programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId',
  )
  @ApiOperation({ summary: 'Retirer un exercice du modèle et ses séries' })
  async removeExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Param('templateExerciseId', ParseUUIDPipe) templateExerciseId: string,
  ) {
    const data = await this.programsService.removeExercise(
      user.id,
      programId,
      workoutTemplateId,
      templateExerciseId,
    );
    return createSuccessResponse(data);
  }

  @Post(
    ':programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets',
  )
  @ApiOperation({ summary: 'Ajouter une série cible à la fin' })
  async createSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Param('templateExerciseId', ParseUUIDPipe) templateExerciseId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.createSet(
      user.id,
      programId,
      workoutTemplateId,
      templateExerciseId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Put(
    ':programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets/order',
  )
  @ApiOperation({ summary: 'Réordonner les séries cibles' })
  async reorderSets(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Param('templateExerciseId', ParseUUIDPipe) templateExerciseId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.reorderSets(
      user.id,
      programId,
      workoutTemplateId,
      templateExerciseId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Patch(
    ':programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets/:setId',
  )
  @ApiOperation({ summary: 'Modifier une série cible' })
  async updateSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Param('templateExerciseId', ParseUUIDPipe) templateExerciseId: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @Body() body: unknown,
  ) {
    const data = await this.programsService.updateSet(
      user.id,
      programId,
      workoutTemplateId,
      templateExerciseId,
      setId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Delete(
    ':programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets/:setId',
  )
  @ApiOperation({ summary: 'Supprimer une série cible et compacter les positions' })
  async deleteSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
    @Param('templateExerciseId', ParseUUIDPipe) templateExerciseId: string,
    @Param('setId', ParseUUIDPipe) setId: string,
  ) {
    const data = await this.programsService.deleteSet(
      user.id,
      programId,
      workoutTemplateId,
      templateExerciseId,
      setId,
    );
    return createSuccessResponse(data);
  }
}
