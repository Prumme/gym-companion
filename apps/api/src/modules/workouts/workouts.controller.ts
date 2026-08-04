import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
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

  @Get(':workoutSessionId')
  @ApiOperation({ summary: 'Détail d’une séance (snapshot)' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutSessionId', ParseUUIDPipe) workoutSessionId: string,
  ) {
    const data = await this.workoutsService.getById(user.id, workoutSessionId);
    return createSuccessResponse(data);
  }
}
