import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('PATCH /api/v1/me/profile', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `profile-${Date.now()}@example.com`;
  const password = 'Password123!';
  let accessToken = '';

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

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        acceptedTermsVersion: '2026-08',
        displayName: 'Profile User',
      })
      .expect(201);

    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated profile updates', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .send({ displayName: 'Hack' })
      .expect(401);
  });

  it('updates the profile and persists the change', async () => {
    const patched = await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Nom persisté',
        primaryGoal: 'HYPERTROPHY',
        experienceLevel: 'ADVANCED',
        heightCm: 180,
        currentWeightKg: null,
      })
      .expect(200);

    expect(patched.body.data.profile).toMatchObject({
      displayName: 'Nom persisté',
      primaryGoal: 'HYPERTROPHY',
      experienceLevel: 'ADVANCED',
      heightCm: 180,
      currentWeightKg: null,
    });

    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.profile).toMatchObject({
      displayName: 'Nom persisté',
      primaryGoal: 'HYPERTROPHY',
      experienceLevel: 'ADVANCED',
      heightCm: 180,
    });

    const dbProfile = await prisma.userProfile.findFirst({
      where: { user: { email } },
    });
    expect(dbProfile?.displayName).toBe('Nom persisté');
    expect(dbProfile?.primaryGoal).toBe('HYPERTROPHY');
  }, 30_000);
});
