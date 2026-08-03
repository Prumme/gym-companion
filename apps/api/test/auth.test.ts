import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';

function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.PUBLIC_APP_URL = 'http://localhost:5173';
  process.env.API_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://gym:gym@localhost:5433/gym_companion?schema=public';
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'error';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret-at-least-32-chars!!';
  process.env.COOKIE_SECRET =
    process.env.COOKIE_SECRET ?? 'test-cookie-secret-at-least-32-characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.REFRESH_TOKEN_EXPIRES_IN = '30d';
  process.env.EMAIL_PROVIDER = 'none';
}

describe('Auth and profile flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `user-${Date.now()}@example.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    applyTestEnv();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const config = app.get(AppConfigService);
    app.use(cookieParser(config.cookieSecret));
    app.useGlobalFilters(new GlobalExceptionFilter(config));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers, refreshes, reads profile and logs out', async () => {
    const agent = request.agent(app.getHttpServer());

    const register = await agent
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        acceptedTermsVersion: '2026-08',
        displayName: 'Test User',
      })
      .expect(201);

    expect(register.body.data.accessToken).toBeTruthy();
    const accessToken = register.body.data.accessToken as string;

    const me = await agent
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe(email);
    expect(me.body.data.profile.displayName).toBe('Test User');

    const patched = await agent
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        primaryGoal: 'STRENGTH',
        experienceLevel: 'INTERMEDIATE',
      })
      .expect(200);

    expect(patched.body.data.profile.primaryGoal).toBe('STRENGTH');

    const refreshed = await agent.post('/api/v1/auth/refresh').expect(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();

    await agent.post('/api/v1/auth/logout').expect(204);
  }, 30_000);
});
