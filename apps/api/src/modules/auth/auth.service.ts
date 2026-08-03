import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Response } from 'express';

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@gym-companion/validation';

import { parseDurationToMs, parseDurationToSeconds } from '../../common/utils/duration';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from './mail.service';

const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(input: unknown, response: Response, userAgent?: string) {
    const data = registerSchema.parse(input);
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_USED',
        message: 'Cette adresse email est déjà utilisée.',
      });
    }

    const passwordHash = await argon2.hash(data.password);
    const displayName = data.displayName ?? data.email.split('@')[0] ?? 'Athlete';

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        status: 'ACTIVE',
        profile: {
          create: {
            displayName,
          },
        },
      },
    });

    return this.issueSession(user.id, user.email, user.status, response, userAgent);
  }

  async login(input: unknown, response: Response, userAgent?: string) {
    const data = loginSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user || user.status === 'DISABLED') {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect.',
      });
    }

    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(user.id, user.email, user.status, response, userAgent);
  }

  async refresh(refreshToken: string | undefined, response: Response, userAgent?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Session expirée.',
      });
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.authSession.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || session.user.status === 'DISABLED') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Session expirée.',
      });
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(
      session.user.id,
      session.user.email,
      session.user.status,
      response,
      userAgent,
    );
  }

  async logout(refreshToken: string | undefined, response: Response) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.authSession.updateMany({
        where: { refreshTokenHash: tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.clearRefreshCookie(response);
  }

  async logoutAll(userId: string, response: Response) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.clearRefreshCookie(response);
  }

  async forgotPassword(input: unknown) {
    const data = forgotPasswordSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const resetUrl = `${this.config.publicAppUrl}/reset-password?token=${token}`;
      await this.mailService.sendPasswordReset(user.email, resetUrl);
    }

    return {
      message: 'Si un compte existe, un email de réinitialisation a été envoyé.',
    };
  }

  async resetPassword(input: unknown) {
    const data = resetPasswordSchema.parse(input);
    const tokenHash = this.hashToken(data.token);
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Le lien de réinitialisation est invalide ou expiré.',
      });
    }

    const passwordHash = await argon2.hash(data.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Mot de passe mis à jour.' };
  }

  private async issueSession(
    userId: string,
    email: string,
    status: string,
    response: Response,
    userAgent?: string,
  ) {
    const refreshToken = randomBytes(48).toString('hex');
    const expiresInSeconds = parseDurationToSeconds(this.config.jwtAccessExpiresIn);
    const refreshExpiresMs = parseDurationToMs(this.config.refreshTokenExpiresIn);

    await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: userAgent ?? null,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
        lastUsedAt: new Date(),
      },
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.config.jwtAccessSecret,
        expiresIn: expiresInSeconds,
      },
    );

    this.setRefreshCookie(response, refreshToken, refreshExpiresMs);

    return {
      user: {
        id: userId,
        email,
        status,
        emailVerified: false,
      },
      accessToken,
      expiresInSeconds,
    };
  }

  private setRefreshCookie(response: Response, token: string, maxAgeMs: number) {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: maxAgeMs,
      signed: true,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(REFRESH_COOKIE, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      signed: true,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export { REFRESH_COOKIE };
