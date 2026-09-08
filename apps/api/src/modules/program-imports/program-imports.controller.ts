import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createSuccessResponse } from '@gym-companion/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/jwt-auth.guard';
import { ProgramImportsService } from './program-imports.service';

@ApiTags('program-imports')
@ApiBearerAuth()
@Controller('api/v1/program-imports')
@UseGuards(JwtAuthGuard)
export class ProgramImportsController {
  constructor(private readonly programImportsService: ProgramImportsService) {}

  @Post('validate')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Valider un JSON d’import de programme (aucune persistance, revalidation métier)',
  })
  async validate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.programImportsService.validate(user.id, body);
    return createSuccessResponse(data);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Importer un programme depuis un JSON V1 (revalidation complète, DRAFT)',
  })
  async importProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.programImportsService.import(user.id, body);
    return createSuccessResponse(data);
  }
}
