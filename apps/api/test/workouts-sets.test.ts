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

describe('Workout set recording API (3.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let sessionId = '';
  let exerciseId = '';
  let setId = '';
  let targetWeight: number | null = 60;
  const emailA = `set-a-${Date.now()}@example.com`;
  const emailB = `set-b-${Date.now()}@example.com`;

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

    tokenA = await registerUser(app, emailA, 'Set A');
    tokenB = await registerUser(app, emailB, 'Set B');

    const system = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null, measurementType: 'WEIGHT_REPS' },
    });

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Prog sets', goal: 'HYPERTROPHY' })
      .expect(201);
    const programId = program.body.data.id as string;

    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Séance' })
      .expect(201);
    const templateId = tpl.body.data.workoutTemplates[0].id as string;

    const ex = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
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
      .set('Authorization', `Bearer ${tokenA}`)
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

    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateId,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(201);

    sessionId = created.body.data.id;
    exerciseId = created.body.data.exercises[0].id;
    setId = created.body.data.exercises[0].sets[0].id;
    targetWeight = created.body.data.exercises[0].sets[0].targetWeightKg;
    expect(created.body.data.exercises[0].sets[0].status).toBe('PENDING');
  });

  afterAll(async () => {
    await app.close();
  });

  function patchPath() {
    return `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/${setId}`;
  }

  it('requires authentication', async () => {
    await request(app.getHttpServer()).patch(patchPath()).expect(401);
  });

  it('updates a WEIGHT_REPS set to COMPLETED and bumps version', async () => {
    const response = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 62.5,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
        notes: 'Bonne série',
        expectedVersion: 1,
        clientCommandId: 'cmd-complete-1',
      })
      .expect(200);

    expect(response.body.data.workoutSessionVersion).toBe(2);
    expect(response.body.data.workoutSet.status).toBe('COMPLETED');
    expect(response.body.data.workoutSet.actualWeightKg).toBe(62.5);
    expect(response.body.data.workoutSet.actualReps).toBe(10);
    expect(response.body.data.workoutSet.targetWeightKg).toBe(targetWeight);
    expect(response.body.data.workoutSet.completedAt).toBeTruthy();
    expect(response.body.data).not.toHaveProperty('ownerUserId');

    const active = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(active.body.data.version).toBe(2);
    expect(active.body.data.exercises[0].sets[0].actualReps).toBe(10);
  });

  it('rejects missing reps and conflicting RIR/RPE', async () => {
    const missing = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: null,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 2,
      })
      .expect(400);
    expect(missing.body.error.code).toBe('WORKOUT_SET_INVALID');

    const conflict = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: 8,
        reachedFailure: false,
        notes: null,
        expectedVersion: 2,
      })
      .expect(400);
    expect(conflict.body.error.code).toBe(
      'WORKOUT_SET_CONFLICTING_EFFORT_VALUES',
    );
  });

  it('rejects stale version', async () => {
    const response = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'PARTIAL',
        actualWeightKg: 60,
        actualReps: 6,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 1,
      })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_VERSION_CONFLICT');
  });

  it('supports PARTIAL, FAILED, SKIPPED and idempotent command', async () => {
    await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'PARTIAL',
        actualWeightKg: 60,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 2,
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'FAILED',
        actualWeightKg: 60,
        actualReps: 0,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: 'Barre bloquée',
        expectedVersion: 3,
      })
      .expect(200);

    const skipped = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'SKIPPED',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 4,
        clientCommandId: 'cmd-skip-1',
      })
      .expect(200);
    expect(skipped.body.data.workoutSet.status).toBe('SKIPPED');
    expect(skipped.body.data.workoutSet.actualReps).toBeNull();
    expect(skipped.body.data.workoutSessionVersion).toBe(5);

    const idempotent = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'SKIPPED',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 5,
        clientCommandId: 'cmd-skip-1',
      })
      .expect(200);
    expect(idempotent.body.data.workoutSessionVersion).toBe(5);

    const conflictCmd = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 5,
        clientCommandId: 'cmd-skip-1',
      })
      .expect(409);
    expect(conflictCmd.body.error.code).toBe('WORKOUT_SET_COMMAND_CONFLICT');
  });

  it('hides foreign session sets', async () => {
    await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 5,
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejects wrong exercise parent', async () => {
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/sets/${setId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 5,
      })
      .expect(404);
  });

  it('rejects updates when session is completed', async () => {
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const response = await request(app.getHttpServer())
      .patch(patchPath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 5,
      })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_NOT_EDITABLE');
  });
});
