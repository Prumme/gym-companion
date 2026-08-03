import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma/prisma.service';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(
        token,
        { secret: this.config.jwtAccessSecret },
      );

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status === 'DISABLED' || user.status === 'DELETION_PENDING') {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Session invalide.',
        });
      }

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Session invalide.',
      });
    }
  }
}
