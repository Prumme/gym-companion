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

type Startable = {
  templateId: string;
  exerciseId: string;
};

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
): Promise<Startable> {
  const exercise = await prisma.exercise.findFirstOrThrow({
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
      exerciseId: exercise.id,
      equipmentTypeId: exercise.defaultEquipmentTypeId,
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
  return { templateId, exerciseId: exercise.id };
}

async function startWorkout(
  app: INestApplication,
  token: string,
  templateId: string,
  localDate: string,
) {
  const created = await request(app.getHttpServer())
    .post('/api/v1/workouts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      sourceWorkoutTemplateId: templateId,
      localDate,
      timezone: 'Europe/Paris',
    })
    .expect(201);
  return created.body.data as {
    id: string;
    version: number;
    exercises: Array<{ id: string; sets: Array<{ id: string }> }>;
  };
}

async function completeWeightSession(
  app: INestApplication,
  token: string,
  templateId: string,
  localDate: string,
  weight: number,
  reps: number,
  cmd: string,
) {
  const session = await startWorkout(app, token, templateId, localDate);
  const exercise = session.exercises[0]!;
  const set = exercise.sets[0]!;
  const patched = await request(app.getHttpServer())
    .patch(
      `/api/v1/workouts/${session.id}/exercises/${exercise.id}/sets/${set.id}`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({
      status: 'COMPLETED',
      actualWeightKg: weight,
      actualReps: reps,
      actualDurationSeconds: null,
      actualDistanceMeters: null,
      actualRir: 1,
      actualRpe: null,
      reachedFailure: false,
      notes: null,
      expectedVersion: session.version,
      clientCommandId: `${cmd}-set`,
    })
    .expect(200);
  session.version = patched.body.data.workoutSessionVersion as number;
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${session.id}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion: session.version,
      notes: null,
      clientCommandId: `${cmd}-complete`,
    })
    .expect(200);
  return session.id;
}

describe('Progress overview API (4.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let tpl: Startable;
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
    tokenA = await registerUser(app, `ov-a-${stamp}@example.com`, 'OV A');
    tokenB = await registerUser(app, `ov-b-${stamp}@example.com`, 'OV B');
    tpl = await createStartableTemplate(app, tokenA, prisma, `OV-${stamp}`);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('dashboard vide + auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/progress/overview').expect(401);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/progress/overview?from=2026-01-01&to=2026-01-31')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(empty.body.data.totals.workoutCount).toBe(0);
    expect(empty.body.data.timeline.points.length).toBeGreaterThan(0);
    expect(empty.body.data.timeline.points.every((p: { workoutCount: number }) => p.workoutCount === 0)).toBe(
      true,
    );
    expect(empty.body.data.recentRecords).toEqual([]);
    expect(empty.body.data.topExercises).toEqual([]);
  });

  it('agrège séances, exclut annulée/active, buckets, tops, isolation', async () => {
    await completeWeightSession(
      app,
      tokenA,
      tpl.templateId,
      '2026-06-02',
      80,
      8,
      `ov1-${stamp}`,
    );
    await completeWeightSession(
      app,
      tokenA,
      tpl.templateId,
      '2026-06-02',
      90,
      6,
      `ov2-${stamp}`,
    );
    await completeWeightSession(
      app,
      tokenA,
      tpl.templateId,
      '2026-06-10',
      100,
      5,
      `ov3-${stamp}`,
    );

    const active = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-06-15',
    );
    const activePatched = await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${active.id}/exercises/${active.exercises[0]!.id}/sets/${active.exercises[0]!.sets[0]!.id}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 200,
        actualReps: 1,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: active.version,
        clientCommandId: `ov-active-${stamp}`,
      })
      .expect(200);

    const whileActive = await request(app.getHttpServer())
      .get('/api/v1/progress/overview?from=2026-06-15&to=2026-06-15')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(whileActive.body.data.totals.workoutCount).toBe(0);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${active.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: activePatched.body.data.workoutSessionVersion,
        keepRecordedData: true,
        reason: 'cleanup',
        clientCommandId: `ov-active-cancel-${stamp}`,
      })
      .expect(200);

    const cancelled = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-06-16',
    );
    const cancelledPatch = await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${cancelled.id}/exercises/${cancelled.exercises[0]!.id}/sets/${cancelled.exercises[0]!.sets[0]!.id}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 210,
        actualReps: 1,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: cancelled.version,
        clientCommandId: `ov-cancel-set-${stamp}`,
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${cancelled.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: cancelledPatch.body.data.workoutSessionVersion,
        keepRecordedData: true,
        reason: 'test',
        clientCommandId: `ov-cancel-${stamp}`,
      })
      .expect(200);

    const overview = await request(app.getHttpServer())
      .get(
        '/api/v1/progress/overview?from=2026-06-01&to=2026-06-30&metric=WORKING_EXTERNAL_VOLUME',
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(overview.body.data.totals.workoutCount).toBe(3);
    expect(overview.body.data.frequency.activeDayCount).toBe(2);
    expect(overview.body.data.totals.workingExternalVolumeKg).toBe(
      80 * 8 + 90 * 6 + 100 * 5,
    );
    expect(overview.body.data.timeline.bucket).toBe('DAY');
    expect(
      overview.body.data.timeline.points.some(
        (p: { workoutCount: number }) => p.workoutCount === 0,
      ),
    ).toBe(true);
    expect(overview.body.data.topExercises[0].exerciseId).toBe(tpl.exerciseId);
    expect(overview.body.data.topExercises[0].workoutCount).toBe(3);
    expect(overview.body.data.comparison).not.toBeNull();
    expect(overview.body.data.selectedMetric).toBe('WORKING_EXTERNAL_VOLUME');

    // Cohérence 4.2 : somme des volumes = total dashboard.
    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        ownerUserId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: `ov-a-${stamp}@example.com` },
          })
        ).id,
        status: 'COMPLETED',
        localDate: {
          gte: new Date(Date.UTC(2026, 5, 1)),
          lte: new Date(Date.UTC(2026, 5, 30)),
        },
      },
      select: { id: true },
    });
    let sumVolume = 0;
    for (const row of completedSessions) {
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/workouts/${row.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      sumVolume +=
        detail.body.data.metrics.performance.workingExternalVolumeKg as number;
    }
    expect(sumVolume).toBe(overview.body.data.totals.workingExternalVolumeKg);

    const isolated = await request(app.getHttpServer())
      .get('/api/v1/progress/overview?from=2026-06-01&to=2026-06-30')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(isolated.body.data.totals.workoutCount).toBe(0);

    await request(app.getHttpServer())
      .get('/api/v1/progress/overview?from=2026-06-30&to=2026-06-01')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('PROGRESS_INVALID_DATE_RANGE');
      });

    const json = JSON.stringify(overview.body);
    expect(json).not.toContain('ownerUserId');
    expect(json).not.toContain('passwordHash');
  });

  it('granularité WEEK sur plage moyenne', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/progress/overview?from=2026-01-01&to=2026-06-30')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data.timeline.bucket).toBe('WEEK');
  });
});
