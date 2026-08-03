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
import { ExercisesService } from './exercises.service';

@ApiTags('exercises')
@ApiBearerAuth()
@Controller('api/v1/exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des exercices visibles (système + personnels)',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'muscleGroupId', required: false, type: String })
  @ApiQuery({ name: 'equipmentTypeId', required: false, type: String })
  @ApiQuery({ name: 'measurementType', required: false, type: String })
  @ApiQuery({ name: 'source', required: false, enum: ['SYSTEM', 'USER'] })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.exercisesService.list(user.id, query);
  }

  @Get(':exerciseId')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ) {
    const data = await this.exercisesService.getById(user.id, exerciseId);
    return createSuccessResponse(data);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = await this.exercisesService.create(user.id, body);
    return createSuccessResponse(data);
  }

  @Patch(':exerciseId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() body: unknown,
  ) {
    const data = await this.exercisesService.update(user.id, exerciseId, body);
    return createSuccessResponse(data);
  }

  @Delete(':exerciseId')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ) {
    const data = await this.exercisesService.archive(user.id, exerciseId);
    return createSuccessResponse(data);
  }

  @Post(':exerciseId/restore')
  @HttpCode(200)
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ) {
    const data = await this.exercisesService.restore(user.id, exerciseId);
    return createSuccessResponse(data);
  }
}
