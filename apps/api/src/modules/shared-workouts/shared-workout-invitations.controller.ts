import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { SharedWorkoutsService } from './shared-workouts.service';

@ApiTags('shared-workout-invitations')
@ApiBearerAuth()
@Controller('api/v1/shared-workout-invitations')
@UseGuards(JwtAuthGuard)
export class SharedWorkoutInvitationsController {
  constructor(private readonly sharedWorkoutsService: SharedWorkoutsService) {}

  @Get()
  @ApiOperation({ summary: 'Invitations reçues par l’utilisateur courant' })
  async listReceived(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.sharedWorkoutsService.listReceivedInvitations(user.id, query);
  }

  @Post(':invitationId/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accepter une invitation (invitee)' })
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    const data = await this.sharedWorkoutsService.acceptInvitation(
      user.id,
      invitationId,
    );
    return createSuccessResponse(data);
  }

  @Post(':invitationId/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refuser une invitation (invitee)' })
  async decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    const data = await this.sharedWorkoutsService.declineInvitation(
      user.id,
      invitationId,
    );
    return createSuccessResponse(data);
  }
}
