import { Injectable } from '@nestjs/common';
import { type ApiEnv, parseApiEnv } from '@gym-companion/validation';

@Injectable()
export class AppConfigService {
  private readonly env: ApiEnv;

  constructor() {
    this.env = parseApiEnv(process.env);
  }

  get nodeEnv(): ApiEnv['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get port(): number {
    return this.env.PORT;
  }

  get publicAppUrl(): string {
    return this.env.PUBLIC_APP_URL;
  }

  get apiBaseUrl(): string {
    return this.env.API_BASE_URL;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get corsAllowedOrigins(): string[] {
    return this.env.CORS_ALLOWED_ORIGINS;
  }

  get logLevel(): ApiEnv['LOG_LEVEL'] {
    return this.env.LOG_LEVEL;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtAccessExpiresIn(): string {
    return this.env.JWT_ACCESS_EXPIRES_IN;
  }

  get refreshTokenExpiresIn(): string {
    return this.env.REFRESH_TOKEN_EXPIRES_IN;
  }

  get cookieSecret(): string {
    return this.env.COOKIE_SECRET;
  }

  get emailProvider(): ApiEnv['EMAIL_PROVIDER'] {
    return this.env.EMAIL_PROVIDER;
  }

  get emailFrom(): string {
    return this.env.EMAIL_FROM ?? 'noreply@gym-companion.local';
  }

  get smtpHost(): string {
    return this.env.SMTP_HOST ?? 'localhost';
  }

  get smtpPort(): number {
    return this.env.SMTP_PORT ?? 1025;
  }
}
