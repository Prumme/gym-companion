import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { seedReferenceData } from '../src/modules/reference/reference.seed';
import { seedSystemExercises } from '../src/modules/exercises/exercises.seed';

function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.PUBLIC_APP_URL = 'http://localhost:5173';
  process.env.API_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://gym:gym@localhost:5433/gym_companion?schema=public';
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'error';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret-at-least-32-chars!!';
  process.env.COOKIE_SECRET =
    process.env.COOKIE_SECRET ?? 'test-cookie-secret-at-least-32-characters';
  process.env.EMAIL_PROVIDER = 'none';
}

async function registerUser(app: INestApplication, email: string, displayName: string) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'Password123!',
      acceptedTermsVersion: '2026-08',
      displayName,
    })
    .expect(201);
  return response.body.data.accessToken as string;
}

type DetailBody = {
  id: string;
  name: string;
  status: string;
  version: number;
  localDate: string;
  source: { programId: string | null; workoutTemplateId: string | null } | null;
  exercises: Array<{ id: string; sourceExerciseId: string | null; sets: Array<{ id: string }> }>;
};

describe('Free workout session API (docs/09 §19.3)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let exerciseId = '';
  let session: DetailBody;
  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    applyTestEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    const config = app.get(AppConfigService);
    app.use(cookieParser(config.cookieSecret));
    app.useGlobalFilters(new GlobalExceptionFilter(config));
    await app.listen(0, '127.0.0.1');
    const prisma = app.get(PrismaService);

    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);

    tokenA = await registerUser(app, `free-a-${stamp}@example.com`, 'Free A');
    tokenB = await registerUser(app, `free-b-${stamp}@example.com`, 'Free B');

    const exercise = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null, measurementType: 'WEIGHT_REPS' },
    });
    exerciseId = exercise.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .send({ localDate: today, timezone: 'UTC' })
      .expect(401);
  });

  it('rejects an unknown key or a missing date', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ localDate: today, timezone: 'UTC', sourceWorkoutTemplateId: null })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ timezone: 'UTC' })
      .expect(400);
  });

  it('creates an ACTIVE session without template nor exercise', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ localDate: today, timezone: 'UTC' })
      .expect(201);
    session = response.body.data as DetailBody;
    expect(session).toMatchObject({
      name: 'Séance libre',
      status: 'ACTIVE',
      version: 1,
      localDate: today,
      exercises: [],
    });
    expect(session.source?.programId ?? null).toBeNull();
    expect(session.source?.workoutTemplateId ?? null).toBeNull();

    const active = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(active.body.data.id).toBe(session.id);
  });

  it('refuses a second open session (double tap)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ localDate: today, timezone: 'UTC' })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_ACTIVE_ALREADY_EXISTS');
    expect(response.body.error.details.activeWorkoutSessionId).toBe(session.id);
  });

  it('isolates users', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${session.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/exercises`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ exerciseId, expectedVersion: 1 })
      .expect(404);
    const own = await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ localDate: today, timezone: 'UTC' })
      .expect(201);
    expect(own.body.data.id).not.toBe(session.id);
  });

  it('adds an ad hoc exercise with version control', async () => {
    const stale = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ exerciseId, expectedVersion: session.version + 5 })
      .expect(409);
    expect(stale.body.error.code).toBe('WORKOUT_VERSION_CONFLICT');

    const added = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ exerciseId, expectedVersion: session.version })
      .expect(201);
    session = added.body.data as DetailBody;
    expect(session.version).toBe(2);
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0]!.sourceExerciseId).toBe(exerciseId);
    expect(session.exercises[0]!.sets.length).toBeGreaterThanOrEqual(1);
  });

  it('records a set, completes, then allows a new free session', async () => {
    const exercise = session.exercises[0]!;
    const recorded = await request(app.getHttpServer())
      .patch(`/api/v1/workouts/${session.id}/exercises/${exercise.id}/sets/${exercise.sets[0]!.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: session.version,
        status: 'COMPLETED',
        actualWeightKg: 50,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: recorded.body.data.workoutSessionVersion,
        clientCommandId: `free-complete-${stamp}`,
      })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${session.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data.status).toBe('COMPLETED');
    expect(detail.body.data.metrics.performance.workingExternalVolumeKg).toBe(400);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/workouts?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(history.body.data.map((item: { id: string }) => item.id)).toContain(session.id);

    await request(app.getHttpServer())
      .post('/api/v1/workouts/free')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ localDate: today, timezone: 'UTC' })
      .expect(201);
  });
});
