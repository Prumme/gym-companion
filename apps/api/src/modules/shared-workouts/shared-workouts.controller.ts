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
import { SharedWorkoutsService } from './shared-workouts.service';

@ApiTags('shared-workouts')
@ApiBearerAuth()
@Controller('api/v1/shared-workouts')
@UseGuards(JwtAuthGuard)
export class SharedWorkoutsController {
  constructor(private readonly sharedWorkoutsService: SharedWorkoutsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une salle de séance partagée (LOBBY + OWNER)' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = await this.sharedWorkoutsService.createRoom(user.id, body);
    return createSuccessResponse(data);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les salles dont l’utilisateur est membre actif (cursor)',
  })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.sharedWorkoutsService.listRooms(user.id, query);
  }

  @Get(':roomId/invitations')
  @ApiOperation({ summary: 'Lister les invitations d’une salle (owner)' })
  async listRoomInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.sharedWorkoutsService.listRoomInvitations(
      user.id,
      roomId,
      query,
    );
  }

  @Post(':roomId/invitations')
  @ApiOperation({ summary: 'Inviter un compte existant par email (owner)' })
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: unknown,
  ) {
    const data = await this.sharedWorkoutsService.inviteMember(
      user.id,
      roomId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':roomId/invitations/:invitationId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annuler une invitation PENDING (owner)' })
  async cancelInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    const data = await this.sharedWorkoutsService.cancelInvitation(
      user.id,
      roomId,
      invitationId,
    );
    return createSuccessResponse(data);
  }

  @Post(':roomId/leave')
  @HttpCode(200)
  @ApiOperation({ summary: 'Quitter une salle (MEMBER actif)' })
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    const data = await this.sharedWorkoutsService.leaveRoom(user.id, roomId);
    return createSuccessResponse(data);
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Détail d’une salle (membership actif requis)' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    const data = await this.sharedWorkoutsService.getRoom(user.id, roomId);
    return createSuccessResponse(data);
  }

  @Patch(':roomId')
  @ApiOperation({ summary: 'Renommer une salle (owner, LOBBY/ACTIVE)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: unknown,
  ) {
    const data = await this.sharedWorkoutsService.updateRoom(
      user.id,
      roomId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':roomId/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Démarrer une salle (LOBBY → ACTIVE)' })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: unknown,
  ) {
    const data = await this.sharedWorkoutsService.startRoom(
      user.id,
      roomId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':roomId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Terminer une salle (ACTIVE → COMPLETED)' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: unknown,
  ) {
    const data = await this.sharedWorkoutsService.completeRoom(
      user.id,
      roomId,
      body,
    );
    return createSuccessResponse(data);
  }

  @Post(':roomId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annuler une salle (LOBBY|ACTIVE → CANCELLED)' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: unknown,
  ) {
    const data = await this.sharedWorkoutsService.cancelRoom(
      user.id,
      roomId,
      body,
    );
    return createSuccessResponse(data);
  }
}
