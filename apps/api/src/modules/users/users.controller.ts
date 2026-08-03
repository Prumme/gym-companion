import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.usersService.getMe(user.id);
    return createSuccessResponse(data);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = await this.usersService.updateProfile(user.id, body);
    return createSuccessResponse(data);
  }
}
