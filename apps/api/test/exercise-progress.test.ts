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
  programId: string;
  templateId: string;
  exerciseId: string;
};

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
  measurementType:
    | 'WEIGHT_REPS'
    | 'DURATION'
    | 'DISTANCE_DURATION'
    | 'BODYWEIGHT_REPS' = 'WEIGHT_REPS',
  exerciseOverrideId?: string,
  extraWarmup = false,
): Promise<Startable> {
  const exercise = exerciseOverrideId
    ? await prisma.exercise.findFirstOrThrow({
        where: { id: exerciseOverrideId },
      })
    : await prisma.exercise.findFirstOrThrow({
        where: {
          source: 'SYSTEM',
          archivedAt: null,
          measurementType,
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

  const setPayload =
    measurementType === 'DURATION'
      ? {
          setType: 'WORKING',
          targetRepMin: null,
          targetRepMax: null,
          targetDurationSeconds: 60,
          targetDistanceMeters: null,
          targetWeightKg: null,
          targetIntensityPercent: null,
          targetRir: null,
          targetRpe: null,
          restSeconds: 60,
        }
      : measurementType === 'DISTANCE_DURATION'
        ? {
            setType: 'WORKING',
            targetRepMin: null,
            targetRepMax: null,
            targetDurationSeconds: 300,
            targetDistanceMeters: 1000,
            targetWeightKg: null,
            targetIntensityPercent: null,
            targetRir: null,
            targetRpe: null,
            restSeconds: 60,
          }
        : measurementType === 'BODYWEIGHT_REPS'
          ? {
              setType: 'WORKING',
              targetRepMin: 8,
              targetRepMax: 12,
              targetDurationSeconds: null,
              targetDistanceMeters: null,
              targetWeightKg: null,
              targetIntensityPercent: null,
              targetRir: 2,
              targetRpe: null,
              restSeconds: 90,
            }
          : {
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
            };

  if (extraWarmup && measurementType === 'WEIGHT_REPS') {
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${teId}/sets`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        setType: 'WARMUP',
        targetRepMin: 5,
        targetRepMax: 5,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: 40,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        restSeconds: 60,
      })
      .expect(201);
  }

  await request(app.getHttpServer())
    .post(
      `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${teId}/sets`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send(setPayload)
    .expect(201);

  return {
    programId,
    templateId,
    exerciseId: exercise.id,
  };
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
    exercises: Array<{
      id: string;
      sourceExerciseId: string | null;
      sets: Array<{ id: string; setType: string }>;
    }>;
  };
}

async function patchSet(
  app: INestApplication,
  token: string,
  session: {
    id: string;
    version: number;
    exercises: Array<{ id: string; sets: Array<{ id: string }> }>;
  },
  exerciseIndex: number,
  setIndex: number,
  actuals: Record<string, unknown>,
  cmd: string,
) {
  const exercise = session.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set) {
    throw new Error('Missing set');
  }
  const response = await request(app.getHttpServer())
    .patch(
      `/api/v1/workouts/${session.id}/exercises/${exercise.id}/sets/${set.id}`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({
      ...actuals,
      notes: null,
      expectedVersion: session.version,
      clientCommandId: cmd,
    })
    .expect(200);
  session.version = response.body.data.workoutSessionVersion as number;
}

async function completeWorkout(
  app: INestApplication,
  token: string,
  session: { id: string; version: number },
  cmd: string,
) {
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${session.id}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion: session.version,
      notes: null,
      clientCommandId: cmd,
    })
    .expect(200);
}

async function cancelWorkout(
  app: INestApplication,
  token: string,
  session: { id: string; version: number },
  cmd: string,
) {
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${session.id}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion: session.version,
      keepRecordedData: true,
      reason: 'test',
      clientCommandId: cmd,
    })
    .expect(200);
}

describe('Exercise progress API (4.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let weightTpl: Startable;
  let weightWarmupTpl: Startable;
  let durationTpl: Startable;
  let distanceTpl: Startable;
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

    tokenA = await registerUser(app, `prog-a-${stamp}@example.com`, 'Prog A');
    tokenB = await registerUser(app, `prog-b-${stamp}@example.com`, 'Prog B');
    weightTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `W-${stamp}`,
      'WEIGHT_REPS',
    );
    weightWarmupTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `WU-${stamp}`,
      'WEIGHT_REPS',
      weightTpl.exerciseId,
      true,
    );
    durationTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `D-${stamp}`,
      'DURATION',
    );
    const userAId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: `prog-a-${stamp}@example.com` },
      })
    ).id;
    const muscle = await prisma.muscleGroup.findFirstOrThrow({
      where: { parentId: null },
    });
    const equipment = await prisma.equipmentType.findFirstOrThrow();
    const distanceExercise = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: userAId,
        name: `Course Prog ${stamp}`,
        normalizedName: `course prog ${stamp}`,
        primaryMuscleGroupId: muscle.id,
        measurementType: 'DISTANCE_DURATION',
        defaultEquipmentTypeId: equipment.id,
        compatibleEquipment: {
          create: [{ equipmentTypeId: equipment.id, isPreferred: true }],
        },
      },
    });
    distanceTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `Dist-${stamp}`,
      'DISTANCE_DURATION',
      distanceExercise.id,
    );
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('exercice sans progression → points vides', async () => {
    const emptyTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `Empty-${stamp}`,
      'BODYWEIGHT_REPS',
    );
    const response = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${emptyTpl.exerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data.points).toEqual([]);
    expect(response.body.data.summary).toBeNull();
    expect(response.body.data.selectedMetric).toBe('MAX_REPS');
    expect(response.body.data.availableMetrics).toEqual([
      'MAX_REPS',
      'TOTAL_REPS',
    ]);
  });

  it('authentification obligatoire', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${weightTpl.exerciseId}`)
      .expect(401);
  });

  it('utilisateur B → 404 neutre pour exercice personnel étranger', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${distanceTpl.exerciseId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('EXERCISE_NOT_FOUND');
      });
  });

  it('plusieurs séances, tri, métriques, warmup, partial, failed, plages', async () => {
    const s1 = await startWorkout(app, tokenA, weightTpl.templateId, '2026-06-01');
    await patchSet(
      app,
      tokenA,
      s1,
      0,
      0,
      {
        status: 'COMPLETED',
        actualWeightKg: 80,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-s1-${stamp}`,
    );
    await completeWorkout(app, tokenA, s1, `prog-c1-${stamp}`);

    const s2 = await startWorkout(app, tokenA, weightTpl.templateId, '2026-07-01');
    await patchSet(
      app,
      tokenA,
      s2,
      0,
      0,
      {
        status: 'PARTIAL',
        actualWeightKg: 90,
        actualReps: 4,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-s2-${stamp}`,
    );
    await completeWorkout(app, tokenA, s2, `prog-c2-${stamp}`);

    const s3 = await startWorkout(app, tokenA, weightTpl.templateId, '2026-07-01');
    await patchSet(
      app,
      tokenA,
      s3,
      0,
      0,
      {
        status: 'FAILED',
        actualWeightKg: 95,
        actualReps: 1,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: true,
      },
      `prog-s3-${stamp}`,
    );
    await completeWorkout(app, tokenA, s3, `prog-c3-${stamp}`);

    const s4 = await startWorkout(
      app,
      tokenA,
      weightWarmupTpl.templateId,
      '2026-08-01',
    );
    const warmupIndex = s4.exercises[0]!.sets.findIndex(
      (set) => set.setType === 'WARMUP',
    );
    const workingIndex = s4.exercises[0]!.sets.findIndex(
      (set) => set.setType === 'WORKING',
    );
    await patchSet(
      app,
      tokenA,
      s4,
      0,
      warmupIndex,
      {
        status: 'COMPLETED',
        actualWeightKg: 150,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-wu-${stamp}`,
    );
    await patchSet(
      app,
      tokenA,
      s4,
      0,
      workingIndex,
      {
        status: 'COMPLETED',
        actualWeightKg: 100,
        actualReps: 6,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-wk-${stamp}`,
    );
    await completeWorkout(app, tokenA, s4, `prog-c4-${stamp}`);

    const all = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT&from=2026-06-01&to=2026-08-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(all.body.data.points).toHaveLength(4);
    expect(all.body.data.points.map((p: { localDate: string }) => p.localDate)).toEqual([
      '2026-06-01',
      '2026-07-01',
      '2026-07-01',
      '2026-08-01',
    ]);
    expect(all.body.data.points[3].value).toBe(100);
    expect(all.body.data.summary.firstValue).toBe(80);
    expect(all.body.data.summary.latestValue).toBe(100);
    expect(all.body.data.summary.bestValue).toBe(100);
    expect(all.body.data.summary.absoluteChange).toBe(20);

    const fromOnly = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT&from=2026-07-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(fromOnly.body.data.points).toHaveLength(3);

    const toOnly = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT&to=2026-06-15`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(toOnly.body.data.points).toHaveLength(1);

    const volume = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=WORKING_EXTERNAL_VOLUME&from=2026-08-01&to=2026-08-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(volume.body.data.points[0].value).toBe(600);

    const totalReps = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=TOTAL_REPS&from=2026-08-01&to=2026-08-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(totalReps.body.data.points[0].value).toBe(11);

    const maxReps = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_REPS&from=2026-06-01&to=2026-06-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(maxReps.body.data.points[0].value).toBe(8);
  });

  it('date invalide / plage inversée / métrique incompatible', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?from=not-a-date`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('PROGRESS_INVALID_FROM_DATE');
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?from=2026-08-01&to=2026-01-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('PROGRESS_INVALID_DATE_RANGE');
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_DISTANCE`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('PROGRESS_METRIC_NOT_SUPPORTED');
      });
  });

  it('séance active et annulée exclues', async () => {
    const active = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-10',
    );
    await patchSet(
      app,
      tokenA,
      active,
      0,
      0,
      {
        status: 'COMPLETED',
        actualWeightKg: 200,
        actualReps: 1,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-active-${stamp}`,
    );

    const whileActive = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT&from=2026-08-10&to=2026-08-10`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(whileActive.body.data.points).toHaveLength(0);

    await cancelWorkout(app, tokenA, active, `prog-active-cancel-${stamp}`);

    const cancelled = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-11',
    );
    await patchSet(
      app,
      tokenA,
      cancelled,
      0,
      0,
      {
        status: 'COMPLETED',
        actualWeightKg: 210,
        actualReps: 1,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-cancel-set-${stamp}`,
    );
    await cancelWorkout(app, tokenA, cancelled, `prog-cancel-${stamp}`);

    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT&from=2026-08-10&to=2026-08-11`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data.points).toHaveLength(0);
  });

  it('DURATION et DISTANCE_DURATION', async () => {
    const d = await startWorkout(
      app,
      tokenA,
      durationTpl.templateId,
      '2026-05-01',
    );
    await patchSet(
      app,
      tokenA,
      d,
      0,
      0,
      {
        status: 'COMPLETED',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: 90,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-dur-${stamp}`,
    );
    await completeWorkout(app, tokenA, d, `prog-dur-c-${stamp}`);

    const duration = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${durationTpl.exerciseId}?metric=MAX_DURATION`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(duration.body.data.points[0].value).toBe(90);

    const dist = await startWorkout(
      app,
      tokenA,
      distanceTpl.templateId,
      '2026-05-02',
    );
    await patchSet(
      app,
      tokenA,
      dist,
      0,
      0,
      {
        status: 'COMPLETED',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: 400,
        actualDistanceMeters: 1200,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `prog-dist-${stamp}`,
    );
    await completeWorkout(app, tokenA, dist, `prog-dist-c-${stamp}`);

    const distance = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${distanceTpl.exerciseId}?metric=MAX_DISTANCE`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(distance.body.data.points[0].value).toBe(1200);

    const renamed = `Course Prog Renommée ${stamp}`;
    await prisma.exercise.update({
      where: { id: distanceTpl.exerciseId },
      data: {
        name: renamed,
        normalizedName: renamed.toLowerCase(),
        archivedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    const archived = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${distanceTpl.exerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(archived.body.data.exercise.name).toBe(renamed);
    expect(archived.body.data.exercise.archived).toBe(true);
    expect(archived.body.data.points.length).toBeGreaterThanOrEqual(1);
  });

  it('n’expose pas de champs internes', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const json = JSON.stringify(response.body);
    expect(json).not.toContain('ownerUserId');
    expect(json).not.toContain('passwordHash');
  });
});
