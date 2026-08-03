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
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { ExercisesService } from './exercises.service';

@Controller('api/v1/exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const include =
      includeArchived === 'true' || includeArchived === '1' || includeArchived === 'yes';
    const data = await this.exercisesService.list(user.id, include);
    return createSuccessResponse(data);
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
