import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { TrainingSharesService } from './training-shares.service';

@ApiTags('training-shares')
@Controller('api/v1')
export class TrainingSharesController {
  constructor(private readonly trainingSharesService: TrainingSharesService) {}

  @Post('programs/:programId/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Créer un lien de partage temporaire (programme)' })
  async shareProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    const data = await this.trainingSharesService.createProgramShare(
      user.id,
      programId,
    );
    return createSuccessResponse(data);
  }

  @Post('programs/:programId/workout-templates/:workoutTemplateId/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Créer un lien de partage temporaire (séance)' })
  async shareWorkoutTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('workoutTemplateId', ParseUUIDPipe) workoutTemplateId: string,
  ) {
    const data = await this.trainingSharesService.createWorkoutTemplateShare(
      user.id,
      programId,
      workoutTemplateId,
    );
    return createSuccessResponse(data);
  }

  @Get('shares/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Preview d’un partage (public, sans auth)',
  })
  async preview(@Param('token') token: string) {
    const data = await this.trainingSharesService.getPreview(token);
    return createSuccessResponse(data);
  }

  @Post('shares/:token/import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Importer un programme ou une séance partagée' })
  async importShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
    @Body() body: unknown,
  ) {
    const data = await this.trainingSharesService.importShare(
      user.id,
      token,
      body,
    );
    return createSuccessResponse(data);
  }
}
