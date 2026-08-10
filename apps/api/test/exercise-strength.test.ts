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
    .send({ name: `Prog ${name}`, goal: 'STRENGTH' })
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
    exercises: Array<{ id: string; sets: Array<{ id: string; setType: string }> }>;
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

function workingSetIndex(
  session: { exercises: Array<{ sets: Array<{ setType: string }> }> },
): number {
  const sets = session.exercises[0]?.sets ?? [];
  const index = sets.findIndex((set) => set.setType === 'WORKING');
  return index >= 0 ? index : 0;
}

describe('Exercise strength API (4.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let weightTpl: Startable;
  let weightWarmupTpl: Startable;
  let bodyweightTpl: Startable;
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

    tokenA = await registerUser(app, `str-a-${stamp}@example.com`, 'Str A');
    tokenB = await registerUser(app, `str-b-${stamp}@example.com`, 'Str B');
    weightTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `SW-${stamp}`,
      'WEIGHT_REPS',
    );
    weightWarmupTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `SWU-${stamp}`,
      'WEIGHT_REPS',
      weightTpl.exerciseId,
      true,
    );
    bodyweightTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `SBW-${stamp}`,
      'BODYWEIGHT_REPS',
    );
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('authentification obligatoire', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${weightTpl.exerciseId}/strength`)
      .expect(401);
  });

  it('exercice incompatible → supported false', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${bodyweightTpl.exerciseId}/strength`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data.supported).toBe(false);
    expect(response.body.data.summary).toBeNull();
    expect(response.body.data.points).toEqual([]);
    expect(response.body.data.formula).toBe('EPLEY_V1');
  });

  it('exercice compatible sans données → points vides', async () => {
    const emptyTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `SEmpty-${stamp}`,
      'WEIGHT_REPS',
    );
    // Use a different WEIGHT_REPS system exercise if possible
    const other = await prisma.exercise.findFirst({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'WEIGHT_REPS',
        id: { not: weightTpl.exerciseId },
      },
    });
    const tpl = other
      ? await createStartableTemplate(
          app,
          tokenA,
          prisma,
          `SEmpty2-${stamp}`,
          'WEIGHT_REPS',
          other.id,
        )
      : emptyTpl;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${tpl.exerciseId}/strength`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data.supported).toBe(true);
    expect(response.body.data.points).toEqual([]);
    expect(response.body.data.summary).toBeNull();
    expect(response.body.data.eligibility).toEqual({ minReps: 1, maxReps: 12 });
  });

  it('une estimation 100×1 → e1RM 100 ; 90×10 → 120 ; MAX_WEIGHT distinct', async () => {
    const s1 = await startWorkout(app, tokenA, weightTpl.templateId, '2026-07-01');
    await patchSet(
      app,
      tokenA,
      s1,
      0,
      workingSetIndex(s1),
      {
        status: 'COMPLETED',
        actualWeightKg: 100,
        actualReps: 1,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-100x1-${stamp}`,
    );
    await completeWorkout(app, tokenA, s1, `str-c1-${stamp}`);

    const s2 = await startWorkout(app, tokenA, weightTpl.templateId, '2026-07-15');
    await patchSet(
      app,
      tokenA,
      s2,
      0,
      workingSetIndex(s2),
      {
        status: 'COMPLETED',
        actualWeightKg: 90,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-90x10-${stamp}`,
    );
    await completeWorkout(app, tokenA, s2, `str-c2-${stamp}`);

    const strength = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}/strength?from=2026-07-01&to=2026-07-31`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(strength.body.data.supported).toBe(true);
    expect(strength.body.data.points).toHaveLength(2);
    expect(strength.body.data.points[0].estimatedOneRepMaxKg).toBe(100);
    expect(strength.body.data.points[1].estimatedOneRepMaxKg).toBe(120);
    expect(strength.body.data.summary.latestEstimatedOneRepMaxKg).toBe(120);
    expect(strength.body.data.summary.bestEstimatedOneRepMaxKg).toBe(120);
    expect(strength.body.data.summary.firstEstimatedOneRepMaxKg).toBe(100);
    expect(strength.body.data.summary.absoluteChangeKg).toBe(20);
    expect(strength.body.data.summary.latestSource.rir).toBe(1);
    expect(strength.body.data).not.toHaveProperty('ownerUserId');

    const progress = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}?metric=MAX_WEIGHT&from=2026-07-01&to=2026-07-31`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(progress.body.data.summary.bestValue).toBe(100);
    expect(progress.body.data.summary.latestValue).toBe(90);
  });

  it('filtre dates + 100×8 ≈ 126.67 + warmup/partial exclus', async () => {
    const s = await startWorkout(
      app,
      tokenA,
      weightWarmupTpl.templateId,
      '2026-08-01',
    );
    const warmupIdx = s.exercises[0]!.sets.findIndex((set) => set.setType === 'WARMUP');
    const workIdx = workingSetIndex(s);
    await patchSet(
      app,
      tokenA,
      s,
      0,
      warmupIdx,
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
      `str-wu-${stamp}`,
    );
    await patchSet(
      app,
      tokenA,
      s,
      0,
      workIdx,
      {
        status: 'COMPLETED',
        actualWeightKg: 100,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-100x8-${stamp}`,
    );
    await completeWorkout(app, tokenA, s, `str-c3-${stamp}`);

    const inRange = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}/strength?from=2026-08-01&to=2026-08-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(inRange.body.data.points).toHaveLength(1);
    expect(inRange.body.data.points[0].estimatedOneRepMaxKg).toBeCloseTo(
      126.6666667,
      5,
    );
    expect(inRange.body.data.points[0].sourceSet.weightKg).toBe(100);

    const outRange = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}/strength?from=2026-01-01&to=2026-01-31`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(outRange.body.data.points).toEqual([]);
  });

  it('partial / failed / reps>12 / séance active / annulée exclus', async () => {
    const sPartial = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-05',
    );
    await patchSet(
      app,
      tokenA,
      sPartial,
      0,
      workingSetIndex(sPartial),
      {
        status: 'PARTIAL',
        actualWeightKg: 140,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-partial-${stamp}`,
    );
    await completeWorkout(app, tokenA, sPartial, `str-cp-${stamp}`);

    const sFailed = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-06',
    );
    await patchSet(
      app,
      tokenA,
      sFailed,
      0,
      workingSetIndex(sFailed),
      {
        status: 'FAILED',
        actualWeightKg: 140,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: true,
      },
      `str-failed-${stamp}`,
    );
    await completeWorkout(app, tokenA, sFailed, `str-cf-${stamp}`);

    const sHighReps = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-07',
    );
    await patchSet(
      app,
      tokenA,
      sHighReps,
      0,
      workingSetIndex(sHighReps),
      {
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 13,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-13reps-${stamp}`,
    );
    await completeWorkout(app, tokenA, sHighReps, `str-c13-${stamp}`);

    const sActive = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-08',
    );
    await patchSet(
      app,
      tokenA,
      sActive,
      0,
      workingSetIndex(sActive),
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
      `str-active-${stamp}`,
    );

    const whileActive = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}/strength?from=2026-08-08&to=2026-08-08`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(whileActive.body.data.points).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sActive.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: sActive.version,
        keepRecordedData: true,
        reason: 'cleanup-active',
        clientCommandId: `str-active-cancel-${stamp}`,
      })
      .expect(200);

    const sCancel = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-09',
    );
    await patchSet(
      app,
      tokenA,
      sCancel,
      0,
      workingSetIndex(sCancel),
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
      `str-cancel-set-${stamp}`,
    );
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sCancel.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: sCancel.version,
        keepRecordedData: true,
        reason: 'test',
        clientCommandId: `str-cancel-${stamp}`,
      })
      .expect(200);

    const sDecimal = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-10',
    );
    await patchSet(
      app,
      tokenA,
      sDecimal,
      0,
      workingSetIndex(sDecimal),
      {
        status: 'COMPLETED',
        actualWeightKg: 22.5,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-225-${stamp}`,
    );
    await completeWorkout(app, tokenA, sDecimal, `str-c225-${stamp}`);

    const s12 = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-11',
    );
    await patchSet(
      app,
      tokenA,
      s12,
      0,
      workingSetIndex(s12),
      {
        status: 'COMPLETED',
        actualWeightKg: 50,
        actualReps: 12,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-12reps-${stamp}`,
    );
    await completeWorkout(app, tokenA, s12, `str-c12-${stamp}`);

    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}/strength?from=2026-08-05&to=2026-08-11`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const values = response.body.data.points.map(
      (p: { estimatedOneRepMaxKg: number }) => p.estimatedOneRepMaxKg,
    );
    expect(values).not.toContain(200);
    expect(values.some((v: number) => Math.abs(v - 140 * (1 + 5 / 30)) < 0.01)).toBe(
      false,
    );
    expect(values).toContain(28.5);
    expect(values).toContain(70);
  });

  it('période inversée + exercice étranger 404 + isolation user B', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/progress/exercises/${weightTpl.exerciseId}/strength?from=2026-08-01&to=2026-01-01`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('STRENGTH_INVALID_DATE_RANGE');
      });

    const foreign = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: `str-b-${stamp}@example.com` },
          })
        ).id,
        name: `Privé Str ${stamp}`,
        normalizedName: `prive str ${stamp}`,
        primaryMuscleGroupId: (
          await prisma.muscleGroup.findFirstOrThrow({ where: { parentId: null } })
        ).id,
        measurementType: 'WEIGHT_REPS',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${foreign.id}/strength`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    const isolated = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${weightTpl.exerciseId}/strength`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(isolated.body.data.points).toEqual([]);
  });

  it('exercice archivé reste consultable', async () => {
    const userAId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: `str-a-${stamp}@example.com` },
      })
    ).id;
    const muscle = await prisma.muscleGroup.findFirstOrThrow({
      where: { parentId: null },
    });
    const equipment = await prisma.equipmentType.findFirstOrThrow();
    const personal = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: userAId,
        name: `Archivable Str ${stamp}`,
        normalizedName: `archivable str ${stamp}`,
        primaryMuscleGroupId: muscle.id,
        measurementType: 'WEIGHT_REPS',
        defaultEquipmentTypeId: equipment.id,
        compatibleEquipment: {
          create: [{ equipmentTypeId: equipment.id, isPreferred: true }],
        },
      },
    });
    const tpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `SArch-${stamp}`,
      'WEIGHT_REPS',
      personal.id,
    );
    const s = await startWorkout(app, tokenA, tpl.templateId, '2026-08-12');
    await patchSet(
      app,
      tokenA,
      s,
      0,
      workingSetIndex(s),
      {
        status: 'COMPLETED',
        actualWeightKg: 80,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `str-arch-${stamp}`,
    );
    await completeWorkout(app, tokenA, s, `str-carch-${stamp}`);

    await prisma.exercise.update({
      where: { id: personal.id },
      data: { archivedAt: new Date() },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${personal.id}/strength`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data.exercise.archived).toBe(true);
    expect(response.body.data.points).toHaveLength(1);
    expect(response.body.data.points[0].estimatedOneRepMaxKg).toBeCloseTo(
      93.333333,
      4,
    );
  });
});
