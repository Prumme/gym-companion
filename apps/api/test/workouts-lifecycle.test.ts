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
    process.env.DATABASE_URL ??
    'postgresql://gym:gym@localhost:5433/gym_companion?schema=public';
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'error';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret-at-least-32-chars!!';
  process.env.COOKIE_SECRET =
    process.env.COOKIE_SECRET ?? 'test-cookie-secret-at-least-32-characters';
  process.env.EMAIL_PROVIDER = 'none';
}

async function registerUser(
  app: INestApplication,
  email: string,
  displayName: string,
) {
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

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
) {
  const system = await prisma.exercise.findFirstOrThrow({
    where: { source: 'SYSTEM', archivedAt: null, measurementType: 'WEIGHT_REPS' },
  });
  const program = await request(app.getHttpServer())
    .post('/api/v1/programs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Prog ${name}`, goal: 'HYPERTROPHY' })
    .expect(201);
  const programId = program.body.data.id as string;
  const tpl = await request(app.getHttpServer())
    .post(`/api/v1/programs/${programId}/workout-templates`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Séance ${name}` })
    .expect(201);
  const templateId = tpl.body.data.workoutTemplates[0].id as string;
  const ex = await request(app.getHttpServer())
    .post(
      `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({
      exerciseId: system.id,
      equipmentTypeId: system.defaultEquipmentTypeId,
      restSecondsOverride: 90,
      notes: null,
    })
    .expect(201);
  const teId = ex.body.data.workoutTemplates[0].exercises[0].id as string;
  await request(app.getHttpServer())
    .post(
      `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${teId}/sets`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({
      setType: 'WORKING',
      targetRepMin: 8,
      targetRepMax: 10,
      targetDurationSeconds: null,
      targetDistanceMeters: null,
      targetWeightKg: 60,
      targetIntensityPercent: null,
      targetRir: 2,
      targetRpe: null,
      restSeconds: 120,
    })
    .expect(201);
  return templateId;
}

async function startWorkout(
  app: INestApplication,
  token: string,
  templateId: string,
) {
  const created = await request(app.getHttpServer())
    .post('/api/v1/workouts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      sourceWorkoutTemplateId: templateId,
      localDate: '2026-08-04',
      timezone: 'Europe/Paris',
    })
    .expect(201);
  return created.body.data as {
    id: string;
    version: number;
    exercises: Array<{
      id: string;
      sets: Array<{ id: string; status: string; actualReps: number | null }>;
    }>;
    permissions: Record<string, boolean>;
  };
}

describe('Workout lifecycle API (3.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let templateA = '';
  let templateB = '';

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
    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);
    tokenA = await registerUser(app, `life-a-${Date.now()}@example.com`, 'Life A');
    tokenB = await registerUser(app, `life-b-${Date.now()}@example.com`, 'Life B');
    templateA = await createStartableTemplate(app, tokenA, prisma, 'A');
    templateB = await createStartableTemplate(app, tokenB, prisma, 'B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workouts/00000000-0000-4000-8000-000000000001/pause')
      .send({ expectedVersion: 1 })
      .expect(401);
  });

  it('pauses, blocks set edits, resumes, then completes', async () => {
    const session = await startWorkout(app, tokenA, templateA);
    const setPath = `/api/v1/workouts/${session.id}/exercises/${session.exercises[0]?.id}/sets/${session.exercises[0]?.sets[0]?.id}`;

    const paused = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1, clientCommandId: 'life-pause-1' })
      .expect(200);

    expect(paused.body.data.workoutSession.status).toBe('PAUSED');
    expect(paused.body.data.workoutSessionVersion).toBe(2);
    expect(paused.body.data.workoutSession.pausedAt).toBeTruthy();
    expect(paused.body.data.workoutSession.permissions).toEqual({
      canPause: false,
      canResume: true,
      canComplete: true,
      canCancel: true,
      canRecordSets: false,
    });

    const activePaused = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(activePaused.body.data.status).toBe('PAUSED');

    await request(app.getHttpServer())
      .patch(setPath)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 2,
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_NOT_EDITABLE');
      });

    const resumed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 2 })
      .expect(200);
    expect(resumed.body.data.workoutSession.status).toBe('ACTIVE');
    expect(resumed.body.data.workoutSession.pausedAt).toBeNull();
    expect(resumed.body.data.workoutSessionVersion).toBe(3);

    await request(app.getHttpServer())
      .patch(setPath)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 3,
      })
      .expect(200);

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 4,
        notes: 'Bonne séance',
        clientCommandId: 'life-complete-1',
      })
      .expect(200);

    expect(completed.body.data.workoutSession.status).toBe('COMPLETED');
    expect(completed.body.data.workoutSession.completedAt).toBeTruthy();
    expect(completed.body.data.workoutSession.notes).toBe('Bonne séance');
    expect(completed.body.data.workoutSession.permissions.canRecordSets).toBe(
      false,
    );

    const activeAfter = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(activeAfter.body.data).toBeNull();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${session.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data.status).toBe('COMPLETED');
    expect(detail.body.data.exercises[0].sets[0].actualReps).toBe(10);
    expect(detail.body.data).not.toHaveProperty('ownerUserId');

    const next = await startWorkout(app, tokenA, templateA);
    expect(next.id).not.toBe(session.id);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${next.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 1,
        keepRecordedData: true,
        reason: 'cleanup',
      })
      .expect(200);
  });

  it('cancels from pause, keeps set data, frees active slot', async () => {
    const session = await startWorkout(app, tokenA, templateA);
    const setPath = `/api/v1/workouts/${session.id}/exercises/${session.exercises[0]?.id}/sets/${session.exercises[0]?.sets[0]?.id}`;

    await request(app.getHttpServer())
      .patch(setPath)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'PARTIAL',
        actualWeightKg: 55,
        actualReps: 6,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
        notes: 'garder',
        expectedVersion: 1,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 2 })
      .expect(200);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 3,
        keepRecordedData: true,
        reason: 'Interrompue',
        clientCommandId: 'life-cancel-1',
      })
      .expect(200);

    expect(cancelled.body.data.workoutSession.status).toBe('CANCELLED');
    expect(cancelled.body.data.workoutSession.cancellationReason).toBe(
      'Interrompue',
    );
    expect(cancelled.body.data.workoutSession.cancelledAt).toBeTruthy();
    expect(
      cancelled.body.data.workoutSession.exercises[0].sets[0].actualReps,
    ).toBe(6);

    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/workouts/active')
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200)
      ).body.data,
    ).toBeNull();

    const next = await startWorkout(app, tokenA, templateA);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${next.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1 })
      .expect(200);
  });

  it('rejects stale version, invalid transition, foreign users and conflicts', async () => {
    const session = await startWorkout(app, tokenA, templateA);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 99 })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_VERSION_CONFLICT');
      });

    const first = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1, clientCommandId: 'idem-pause' })
      .expect(200);
    expect(first.body.data.workoutSessionVersion).toBe(2);

    const idem = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1, clientCommandId: 'idem-pause' })
      .expect(200);
    expect(idem.body.data.workoutSessionVersion).toBe(2);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 2, clientCommandId: 'idem-pause' })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_COMMAND_CONFLICT');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 2 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 3 })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_INVALID_STATUS_TRANSITION');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        expectedVersion: 3,
        keepRecordedData: true,
        reason: null,
      })
      .expect(404);

    const foreign = await startWorkout(app, tokenB, templateB);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${foreign.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${foreign.id}/complete`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ expectedVersion: 1 })
      .expect(200);
  });

  it('blocks creating a second session while paused', async () => {
    const session = await startWorkout(app, tokenA, templateA);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_ACTIVE_ALREADY_EXISTS');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 2,
        keepRecordedData: true,
        reason: null,
      })
      .expect(200);
  });
});
