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
    where: {
      source: 'SYSTEM',
      archivedAt: null,
      measurementType: 'WEIGHT_REPS',
    },
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
  return { templateId, exerciseId: system.id };
}

describe('Workout metrics API (4.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let templateA = '';
  const stamp = Date.now();

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
    tokenA = await registerUser(app, `wm-a-${stamp}@example.com`, 'WM A');
    tokenB = await registerUser(app, `wm-b-${stamp}@example.com`, 'WM B');
    templateA = (await createStartableTemplate(app, tokenA, prisma, `A-${stamp}`))
      .templateId;
    await createStartableTemplate(app, tokenB, prisma, `B-${stamp}`);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  async function start(localDate: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate,
        timezone: 'Europe/Paris',
      })
      .expect(201);
    return created.body.data as {
      id: string;
      version: number;
      metrics: unknown;
      exercises: Array<{
        id: string;
        measurementType: string;
        sets: Array<{ id: string }>;
      }>;
    };
  }

  async function patchSet(
    session: {
      id: string;
      version: number;
      exercises: Array<{ id: string; sets: Array<{ id: string }> }>;
    },
    actuals: Record<string, unknown>,
    cmd: string,
  ) {
    const exercise = session.exercises[0];
    const set = exercise?.sets[0];
    if (!exercise || !set) {
      throw new Error('missing set');
    }
    const response = await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${session.id}/exercises/${exercise.id}/sets/${set.id}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        ...actuals,
        notes: null,
        expectedVersion: session.version,
        clientCommandId: cmd,
      })
      .expect(200);
    session.version = response.body.data.workoutSessionVersion as number;
  }

  it('ACTIVE / PAUSED / CANCELLED → metrics null ; COMPLETED → métriques', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .expect(401);

    const session = await start('2026-08-10');
    expect(session.metrics).toBeNull();

    await patchSet(
      session,
      {
        status: 'COMPLETED',
        actualWeightKg: 62.5,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
      },
      `wm-set-${stamp}`,
    );

    const paused = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: session.version,
        clientCommandId: `wm-pause-${stamp}`,
      })
      .expect(200);
    expect(paused.body.data.workoutSession.metrics).toBeNull();
    session.version = paused.body.data.workoutSessionVersion as number;

    const resumed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: session.version,
        clientCommandId: `wm-resume-${stamp}`,
      })
      .expect(200);
    session.version = resumed.body.data.workoutSessionVersion as number;

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: session.version,
        notes: null,
        clientCommandId: `wm-complete-${stamp}`,
      })
      .expect(200);

    const metrics = completed.body.data.workoutSession.metrics;
    expect(metrics).toBeTruthy();
    expect(metrics.performance.totalReps).toBe(8);
    expect(metrics.performance.workingExternalVolumeKg).toBe(500);
    expect(metrics.performance.totalExternalVolumeKg).toBe(500);
    expect(metrics.sets.performed).toBe(1);
    expect(metrics.elapsedDurationSeconds).toBeTypeOf('number');
    expect(completed.body.data.workoutSession).not.toHaveProperty('ownerUserId');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${session.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data.metrics.performance.workingExternalVolumeKg).toBe(
      500,
    );

    const history = await request(app.getHttpServer())
      .get('/api/v1/workouts?status=COMPLETED')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const item = history.body.data.find(
      (row: { id: string }) => row.id === session.id,
    );
    expect(item.summary.totalReps).toBe(8);
    expect(item.summary.workingExternalVolumeKg).toBe(500);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${session.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    const cancelled = await start('2026-08-11');
    await patchSet(
      cancelled,
      {
        status: 'COMPLETED',
        actualWeightKg: 100,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `wm-cancel-set-${stamp}`,
    );
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${cancelled.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: cancelled.version,
        keepRecordedData: true,
        reason: null,
        clientCommandId: `wm-cancel-${stamp}`,
      })
      .expect(200);
    expect(cancelRes.body.data.workoutSession.metrics).toBeNull();

    const cancelDetail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${cancelled.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(cancelDetail.body.data.metrics).toBeNull();

    const cancelHistory = await request(app.getHttpServer())
      .get('/api/v1/workouts?status=CANCELLED')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const cancelItem = cancelHistory.body.data.find(
      (row: { id: string }) => row.id === cancelled.id,
    );
    expect(cancelItem.summary.totalReps).toBeUndefined();
    expect(cancelItem.summary.workingExternalVolumeKg).toBeUndefined();
  });

  it('warmup / partial / failed : métriques vs records 4.1', async () => {
    const session = await start('2026-08-12');
    const exercise = session.exercises[0];
    if (!exercise) {
      throw new Error('missing exercise');
    }

    const ownerUserId = (
      await prisma.workoutSession.findUniqueOrThrow({
        where: { id: session.id },
      })
    ).ownerUserId;

    await prisma.workoutSet.createMany({
      data: [
        {
          workoutSessionExerciseId: exercise.id,
          ownerUserId,
          position: 50,
          setType: 'WARMUP',
          status: 'COMPLETED',
          actualWeightKg: 120,
          actualReps: 5,
          completedAt: new Date(),
        },
        {
          workoutSessionExerciseId: exercise.id,
          ownerUserId,
          position: 51,
          setType: 'WORKING',
          status: 'PARTIAL',
          actualWeightKg: 70,
          actualReps: 6,
          completedAt: new Date(),
        },
        {
          workoutSessionExerciseId: exercise.id,
          ownerUserId,
          position: 52,
          setType: 'WORKING',
          status: 'FAILED',
          actualWeightKg: 90,
          actualReps: 2,
          reachedFailure: true,
          completedAt: new Date(),
        },
      ],
    });

    await patchSet(
      session,
      {
        status: 'COMPLETED',
        actualWeightKg: 80,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
      },
      `wm-ok-${stamp}`,
    );

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${session.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: session.version,
        notes: null,
        clientCommandId: `wm-mix-complete-${stamp}`,
      })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${session.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const setTypes = detail.body.data.exercises[0].sets.map(
      (set: { setType: string }) => set.setType,
    );
    expect(setTypes).toContain('WARMUP');

    const metrics = completed.body.data.workoutSession.metrics;
    // working: partial 70*6=420 + failed 90*2=180 + completed 80*8=640 = 1240
    expect(metrics.performance.workingExternalVolumeKg).toBe(1240);
    // total includes warmup 120*5=600 → 1840
    expect(metrics.performance.totalExternalVolumeKg).toBe(1840);
    expect(metrics.performance.totalReps).toBe(5 + 6 + 2 + 8);
    expect(metrics.sets.reachedFailure).toBe(1);
    expect(metrics.sets.warmup).toBeGreaterThanOrEqual(1);

    const records = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const maxWeight = records.body.data.find(
      (row: { recordType: string }) => row.recordType === 'MAX_WEIGHT',
    );
    // Warmup 120 and PARTIAL/FAILED exclus des records 4.1
    expect(maxWeight.value).toBeGreaterThanOrEqual(80);
    expect(maxWeight.value).toBeLessThan(120);
  });
});
