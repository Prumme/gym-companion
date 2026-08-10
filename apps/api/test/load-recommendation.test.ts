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
  templateExerciseId: string;
  exerciseId: string;
  equipmentTypeId: string | null;
};

async function createLoadTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
  options: {
    measurementType?: 'WEIGHT_REPS' | 'DURATION' | 'BODYWEIGHT_REPS';
    workingSets?: number;
    targetWeightKg?: number;
    targetRir?: number | null;
    targetRpe?: number | null;
    heterogeneous?: boolean;
    withWarmup?: boolean;
    exerciseOverrideId?: string;
  } = {},
): Promise<Startable> {
  const measurementType = options.measurementType ?? 'WEIGHT_REPS';

  let exerciseId: string;
  let equipmentTypeId: string | null;

  if (options.exerciseOverrideId) {
    const exercise = await prisma.exercise.findFirstOrThrow({
      where: { id: options.exerciseOverrideId },
    });
    exerciseId = exercise.id;
    equipmentTypeId = exercise.defaultEquipmentTypeId;
  } else if (measurementType === 'WEIGHT_REPS') {
    // Exercice USER unique pour isoler l’historique entre scénarios de test.
    const eq = await prisma.equipmentType.findFirstOrThrow({
      where: { isActive: true },
    });
    const mg = await prisma.muscleGroup.findFirstOrThrow({
      where: { isActive: true },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Load Ex ${name}`,
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupId: mg.id,
        secondaryMuscleGroupIds: [],
        defaultEquipmentTypeId: eq.id,
        compatibleEquipmentTypes: [
          { equipmentTypeId: eq.id, isPreferred: true, notes: null },
        ],
        defaultRestSeconds: 90,
        instructions: null,
      })
      .expect(201);
    exerciseId = created.body.data.id as string;
    equipmentTypeId = eq.id;
  } else {
    const exercise = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType,
      },
    });
    exerciseId = exercise.id;
    equipmentTypeId = exercise.defaultEquipmentTypeId;
  }

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
      exerciseId,
      equipmentTypeId,
      restSecondsOverride: 90,
      notes: null,
    })
    .expect(201);
  const templateExerciseId = ex.body.data.workoutTemplates[0].exercises[0]
    .id as string;

  if (options.withWarmup && measurementType === 'WEIGHT_REPS') {
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`,
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

  const workingCount = options.workingSets ?? 3;
  const baseWeight = options.targetWeightKg ?? 80;
  for (let i = 0; i < workingCount; i += 1) {
    const weight =
      options.heterogeneous && i === workingCount - 1
        ? baseWeight - 10
        : baseWeight;
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 8,
        targetRepMax: 10,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: measurementType === 'WEIGHT_REPS' ? weight : null,
        targetIntensityPercent: null,
        targetRir: options.targetRir === undefined ? 2 : options.targetRir,
        targetRpe: options.targetRpe ?? null,
        restSeconds: 120,
      })
      .expect(201);
  }

  return {
    programId,
    templateId,
    templateExerciseId,
    exerciseId,
    equipmentTypeId,
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
  setIndex: number,
  actuals: Record<string, unknown>,
  cmd: string,
) {
  const exercise = session.exercises[0];
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
      reason: 'TEST',
      clientCommandId: cmd,
    })
    .expect(200);
}

function workingIndexes(session: {
  exercises: Array<{ sets: Array<{ setType: string }> }>;
}): number[] {
  return (session.exercises[0]?.sets ?? [])
    .map((set, index) => (set.setType === 'WORKING' ? index : -1))
    .filter((index) => index >= 0);
}

async function getRecommendation(
  app: INestApplication,
  token: string | null,
  templateExerciseId: string,
) {
  const req = request(app.getHttpServer()).get(
    `/api/v1/coaching/workout-template-exercises/${templateExerciseId}/load-recommendation`,
  );
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

async function completeWorkingReps(
  app: INestApplication,
  token: string,
  templateId: string,
  localDate: string,
  reps: number[],
  options: {
    status?: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    rir?: number | null;
    rpe?: number | null;
    prefix: string;
  },
) {
  const session = await startWorkout(app, token, templateId, localDate);
  const indexes = workingIndexes(session);
  for (let i = 0; i < indexes.length; i += 1) {
    const setIndex = indexes[i]!;
    const rep = reps[i] ?? reps[reps.length - 1] ?? 8;
    const status = options.status ?? 'COMPLETED';
    await patchSet(
      app,
      token,
      session,
      setIndex,
      {
        status,
        actualWeightKg: 80,
        actualReps: status === 'FAILED' ? null : rep,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: options.rir ?? null,
        actualRpe: options.rpe ?? null,
        reachedFailure: false,
      },
      `${options.prefix}-set-${i}`,
    );
  }
  await completeWorkout(app, token, session, `${options.prefix}-complete`);
  return session;
}

describe('Load recommendation API (5.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
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

    tokenA = await registerUser(app, `load-a-${stamp}@example.com`, 'Load A');
    tokenB = await registerUser(app, `load-b-${stamp}@example.com`, 'Load B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige l’auth', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `auth-${stamp}`);
    const res = await getRecommendation(app, null, tpl.templateExerciseId);
    expect(res.status).toBe(401);
  });

  it('retourne 404 pour un template exercise étranger (IDOR)', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `idor-${stamp}`);
    const res = await getRecommendation(app, tokenB, tpl.templateExerciseId);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND');
  });

  it('INSUFFICIENT_DATA sans historique', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `empty-${stamp}`);
    const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('INSUFFICIENT_DATA');
    expect(res.body.data.reasons).toContain('NO_ELIGIBLE_HISTORY');
    expect(res.body.data.recommendation.suggestedWeightKg).toBeNull();
    expect(res.body.data.supported).toBe(true);
  });

  it('INCREASE après 10/10/10', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `inc-${stamp}`, {
      withWarmup: true,
    });
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-01',
      [10, 10, 10],
      { prefix: `inc-${stamp}`, rir: 2 },
    );
    const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('INCREASE');
    expect(res.body.data.recommendation.suggestedWeightKg).toBe(82.5);
    expect(res.body.data.recommendation.incrementSource).toBe('SYSTEM_DEFAULT');
    expect(res.body.data.currentTarget.weightKg).toBe(80);
    expect(res.body.data.evidence.workoutCount).toBe(1);
  });

  it('HOLD après 10/9/8', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `hold-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-02',
      [10, 9, 8],
      { prefix: `hold-${stamp}` },
    );
    const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.body.data.action).toBe('HOLD');
    expect(res.body.data.recommendation.suggestedWeightKg).toBe(80);
  });

  it('une seule mauvaise séance → HOLD ; deux → DECREASE', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `dec-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-03',
      [7, 6, 5],
      { prefix: `dec1-${stamp}` },
    );
    let res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.body.data.action).toBe('HOLD');
    expect(res.body.data.reasons).toContain('SINGLE_UNDERPERFORMANCE');

    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-04',
      [7, 6, 6],
      { prefix: `dec2-${stamp}` },
    );
    res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.body.data.action).toBe('DECREASE');
    expect(res.body.data.recommendation.suggestedWeightKg).toBe(75);
  });

  it('REVIEW pour configuration hétérogène', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `het-${stamp}`, {
      heterogeneous: true,
    });
    const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.body.data.action).toBe('REVIEW');
    expect(res.body.data.reasons).toContain('UNSUPPORTED_TARGET_CONFIGURATION');
  });

  it('mesure non WEIGHT_REPS → unsupported', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `bw-${stamp}`, {
      measurementType: 'BODYWEIGHT_REPS',
      workingSets: 2,
      targetRir: null,
    });
    const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.body.data.supported).toBe(false);
    expect(res.body.data.action).toBe('INSUFFICIENT_DATA');
    expect(res.body.data.reasons).toContain('UNSUPPORTED_MEASUREMENT_TYPE');
  });

  it('exclut warmup, séance CANCELLED et ACTIVE', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `excl-${stamp}`, {
      withWarmup: true,
    });

    // Séance excellente puis annulée — ne doit pas compter.
    const cancelled = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-05',
    );
    const indexes = workingIndexes(cancelled);
    for (let i = 0; i < indexes.length; i += 1) {
      await patchSet(
        app,
        tokenA,
        cancelled,
        indexes[i]!,
        {
          status: 'COMPLETED',
          actualWeightKg: 80,
          actualReps: 10,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: 2,
          actualRpe: null,
          reachedFailure: false,
        },
        `excl-cancel-set-${i}-${stamp}`,
      );
    }
    await cancelWorkout(
      app,
      tokenA,
      cancelled,
      `excl-cancel-${stamp}`,
    );

    // Séance active non terminée — exclue, puis toujours nettoyée.
    const active = await startWorkout(app, tokenA, tpl.templateId, '2026-07-06');
    try {
      const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
      expect(res.body.data.action).toBe('INSUFFICIENT_DATA');
      expect(res.body.data.evidence.workoutCount).toBe(0);
    } finally {
      await cancelWorkout(app, tokenA, active, `excl-active-cleanup-${stamp}`);
    }
  });

  it('partial / failed ne permettent pas INCREASE', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `pf-${stamp}`);
    const session = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-07',
    );
    try {
      const indexes = workingIndexes(session);
      await patchSet(
        app,
        tokenA,
        session,
        indexes[0]!,
        {
          status: 'COMPLETED',
          actualWeightKg: 80,
          actualReps: 10,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: null,
          actualRpe: null,
          reachedFailure: false,
        },
        `pf-0-${stamp}`,
      );
      await patchSet(
        app,
        tokenA,
        session,
        indexes[1]!,
        {
          status: 'PARTIAL',
          actualWeightKg: 80,
          actualReps: 6,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: null,
          actualRpe: null,
          reachedFailure: false,
        },
        `pf-1-${stamp}`,
      );
      await patchSet(
        app,
        tokenA,
        session,
        indexes[2]!,
        {
          status: 'FAILED',
          actualWeightKg: 80,
          actualReps: 0,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: null,
          actualRpe: null,
          reachedFailure: true,
        },
        `pf-2-${stamp}`,
      );
      await completeWorkout(app, tokenA, session, `pf-complete-${stamp}`);

      const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
      expect(res.body.data.action).not.toBe('INCREASE');
    } catch (error) {
      await cancelWorkout(app, tokenA, session, `pf-cleanup-${stamp}`).catch(
        () => undefined,
      );
      throw error;
    }
  });

  it('respecte effort NONE / RIR / RPE et limite à 3 séances', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ effortTrackingMode: 'NONE' })
      .expect(200);

    const tplNone = await createLoadTemplate(
      app,
      tokenA,
      prisma,
      `none-${stamp}`,
      { targetRir: null },
    );
    await completeWorkingReps(
      app,
      tokenA,
      tplNone.templateId,
      '2026-07-08',
      [10, 10, 10],
      { prefix: `none-${stamp}` },
    );
    let res = await getRecommendation(app, tokenA, tplNone.templateExerciseId);
    expect(res.body.data.action).toBe('INCREASE');
    expect(res.body.data.evidence.effortDataUsed).toBe(false);

    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ effortTrackingMode: 'RIR' })
      .expect(200);

    const tplRir = await createLoadTemplate(
      app,
      tokenA,
      prisma,
      `rir-${stamp}`,
      { targetRir: 2 },
    );
    await completeWorkingReps(
      app,
      tokenA,
      tplRir.templateId,
      '2026-07-09',
      [10, 10, 10],
      { prefix: `rir-${stamp}`, rir: 2 },
    );
    res = await getRecommendation(app, tokenA, tplRir.templateExerciseId);
    expect(res.body.data.action).toBe('INCREASE');
    expect(res.body.data.evidence.effortDataUsed).toBe(true);

    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ effortTrackingMode: 'RPE' })
      .expect(200);

    const tplRpe = await createLoadTemplate(
      app,
      tokenA,
      prisma,
      `rpe-${stamp}`,
      { targetRir: null, targetRpe: 8 },
    );
    await completeWorkingReps(
      app,
      tokenA,
      tplRpe.templateId,
      '2026-07-10',
      [10, 10, 10],
      { prefix: `rpe-${stamp}`, rpe: 8 },
    );
    res = await getRecommendation(app, tokenA, tplRpe.templateExerciseId);
    expect(res.body.data.action).toBe('INCREASE');

    // 4 séances : seule les 3 plus récentes comptent.
    const tplLimit = await createLoadTemplate(
      app,
      tokenA,
      prisma,
      `lim-${stamp}`,
    );
    for (let day = 11; day <= 14; day += 1) {
      await completeWorkingReps(
        app,
        tokenA,
        tplLimit.templateId,
        `2026-07-${day}`,
        [10, 9, 8],
        { prefix: `lim-${day}-${stamp}` },
      );
    }
    res = await getRecommendation(app, tokenA, tplLimit.templateExerciseId);
    expect(res.body.data.evidence.workoutCount).toBe(3);
    expect(res.body.data.evidence.recentWorkouts).toHaveLength(3);
  });

  it('n’expose pas de champs internes et fonctionne sur programme archivé', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `arch-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-15',
      [10, 10, 10],
      { prefix: `arch-${stamp}` },
    );
    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${tpl.programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const res = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('INCREASE');
    expect(res.body.data).not.toHaveProperty('prisma');
    expect(res.body.data).not.toHaveProperty('ownerUserId');
  });

  it('cohérence phase 4 : mêmes perfs sans modifier records/progression', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `coh-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-16',
      [10, 10, 10],
      { prefix: `coh-${stamp}`, rir: 2 },
    );

    const [reco, records, progress, strength] = await Promise.all([
      getRecommendation(app, tokenA, tpl.templateExerciseId),
      request(app.getHttpServer())
        .get(`/api/v1/exercises/${tpl.exerciseId}/personal-records`)
        .set('Authorization', `Bearer ${tokenA}`),
      request(app.getHttpServer())
        .get(`/api/v1/progress/exercises/${tpl.exerciseId}?metric=MAX_WEIGHT`)
        .set('Authorization', `Bearer ${tokenA}`),
      request(app.getHttpServer())
        .get(`/api/v1/progress/exercises/${tpl.exerciseId}/strength`)
        .set('Authorization', `Bearer ${tokenA}`),
    ]);

    expect(reco.body.data.action).toBe('INCREASE');
    expect(records.status).toBe(200);
    expect(progress.status).toBe(200);
    expect(strength.status).toBe(200);
    expect(strength.body.data.supported).toBe(true);
  });
});

function decideRecommendation(
  app: INestApplication,
  token: string | null,
  templateExerciseId: string,
  body: Record<string, unknown>,
) {
  const req = request(app.getHttpServer()).post(
    `/api/v1/coaching/workout-template-exercises/${templateExerciseId}/load-recommendation/decision`,
  );
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req.send(body);
}

function listDecisions(
  app: INestApplication,
  token: string | null,
  templateExerciseId: string,
  query: Record<string, string> = {},
) {
  const req = request(app.getHttpServer()).get(
    `/api/v1/coaching/workout-template-exercises/${templateExerciseId}/load-recommendation-decisions`,
  );
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req.query(query);
}

async function addBackoffSet(
  app: INestApplication,
  token: string,
  tpl: Startable,
) {
  await request(app.getHttpServer())
    .post(
      `/api/v1/programs/${tpl.programId}/workout-templates/${tpl.templateId}/exercises/${tpl.templateExerciseId}/sets`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({
      setType: 'BACKOFF',
      targetRepMin: 8,
      targetRepMax: 10,
      targetDurationSeconds: null,
      targetDistanceMeters: null,
      targetWeightKg: 70,
      targetIntensityPercent: null,
      targetRir: 2,
      targetRpe: null,
      restSeconds: 90,
    })
    .expect(201);
}

async function readTemplateSets(
  prisma: PrismaService,
  templateExerciseId: string,
) {
  return prisma.workoutTemplateSet.findMany({
    where: { workoutTemplateExerciseId: templateExerciseId },
    orderBy: { position: 'asc' },
  });
}

describe('Load recommendation decisions API (5.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  const stamp = Date.now() + 1;

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

    tokenA = await registerUser(app, `load-d-a-${stamp}@example.com`, 'Load DA');
    tokenB = await registerUser(app, `load-d-b-${stamp}@example.com`, 'Load DB');
  });

  afterAll(async () => {
    await app.close();
  });

  it('ACCEPTED INCREASE applique 82.5 aux WORKING uniquement', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-inc-${stamp}`, {
      withWarmup: true,
    });
    await addBackoffSet(app, tokenA, tpl);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-01',
      [10, 10, 10],
      { prefix: `d-inc-${stamp}`, rir: 2 },
    );

    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(reco.body.data.action).toBe('INCREASE');
    expect(reco.body.data.recommendation.suggestedWeightKg).toBe(82.5);
    expect(reco.body.data.recommendationFingerprint).toBeTruthy();
    expect(reco.body.data.engineVersion).toBe('LOAD_RECOMMENDATION_V1');

    const decided = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'ACCEPTED',
        clientCommandId: `cmd-inc-${stamp}`,
      },
    );
    expect(decided.status).toBe(201);
    expect(decided.body.data.decision.decisionType).toBe('ACCEPTED');
    expect(decided.body.data.decision.appliedWeightKg).toBe(82.5);

    const sets = await readTemplateSets(prisma, tpl.templateExerciseId);
    const byType = Object.fromEntries(
      sets.map((s) => [s.setType, Number(s.targetWeightKg)]),
    );
    expect(byType.WARMUP).toBe(40);
    expect(byType.BACKOFF).toBe(70);
    expect(sets.filter((s) => s.setType === 'WORKING').every((s) => Number(s.targetWeightKg) === 82.5)).toBe(
      true,
    );
  });

  it('ACCEPTED HOLD enregistre sans mutation numérique', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-hold-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-02',
      [10, 9, 8],
      { prefix: `d-hold-${stamp}` },
    );
    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(reco.body.data.action).toBe('HOLD');

    const decided = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'ACCEPTED',
        clientCommandId: `cmd-hold-${stamp}`,
      },
    );
    expect(decided.status).toBe(201);
    expect(decided.body.data.decision.appliedWeightKg).toBe(80);
    const sets = await readTemplateSets(prisma, tpl.templateExerciseId);
    expect(
      sets
        .filter((s) => s.setType === 'WORKING')
        .every((s) => Number(s.targetWeightKg) === 80),
    ).toBe(true);
  });

  it('ADJUSTED applique une charge personnalisée ; IGNORED ne mute pas', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-adj-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-03',
      [10, 10, 10],
      { prefix: `d-adj-${stamp}`, rir: 2 },
    );
    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(reco.body.data.action).toBe('INCREASE');

    const adjusted = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'ADJUSTED',
        adjustedWeightKg: 81.5,
        userNote: 'Pas de disques 1,25',
        clientCommandId: `cmd-adj-${stamp}`,
      },
    );
    expect(adjusted.status).toBe(201);
    expect(adjusted.body.data.decision.decisionType).toBe('ADJUSTED');
    expect(adjusted.body.data.decision.appliedWeightKg).toBe(81.5);
    expect(adjusted.body.data.decision.userNote).toBe('Pas de disques 1,25');

    const tplIgn = await createLoadTemplate(
      app,
      tokenA,
      prisma,
      `d-ign-${stamp}`,
    );
    await completeWorkingReps(
      app,
      tokenA,
      tplIgn.templateId,
      '2026-08-03',
      [10, 10, 10],
      { prefix: `d-ign-${stamp}`, rir: 2 },
    );
    const recoIgn = await getRecommendation(
      app,
      tokenA,
      tplIgn.templateExerciseId,
    );
    const ignored = await decideRecommendation(
      app,
      tokenA,
      tplIgn.templateExerciseId,
      {
        recommendationFingerprint: recoIgn.body.data.recommendationFingerprint,
        decision: 'IGNORED',
        clientCommandId: `cmd-ign-${stamp}`,
      },
    );
    expect(ignored.status).toBe(201);
    expect(ignored.body.data.decision.decisionType).toBe('IGNORED');
    expect(ignored.body.data.decision.appliedWeightKg).toBeNull();
    const sets = await readTemplateSets(prisma, tplIgn.templateExerciseId);
    expect(
      sets
        .filter((s) => s.setType === 'WORKING')
        .every((s) => Number(s.targetWeightKg) === 80),
    ).toBe(true);
  });

  it('refuse ACCEPTED/ADJUSTED sur REVIEW et validations invalides', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-rev-${stamp}`, {
      heterogeneous: true,
    });
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-04',
      [10, 10, 10],
      { prefix: `d-rev-${stamp}` },
    );
    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    expect(reco.body.data.action).toBe('REVIEW');

    const accepted = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'ACCEPTED',
        clientCommandId: `cmd-rev-acc-${stamp}`,
      },
    );
    expect(accepted.status).toBe(400);
    expect(accepted.body.error.code).toMatch(
      /LOAD_RECOMMENDATION_(NOT_ACTIONABLE|INVALID_DECISION)/,
    );

    const adjusted = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'ADJUSTED',
        adjustedWeightKg: 85,
        clientCommandId: `cmd-rev-adj-${stamp}`,
      },
    );
    expect(adjusted.status).toBe(400);

    const tplInc = await createLoadTemplate(
      app,
      tokenA,
      prisma,
      `d-val-${stamp}`,
    );
    await completeWorkingReps(
      app,
      tokenA,
      tplInc.templateId,
      '2026-08-04',
      [10, 10, 10],
      { prefix: `d-val-${stamp}`, rir: 2 },
    );
    const recoInc = await getRecommendation(
      app,
      tokenA,
      tplInc.templateExerciseId,
    );
    const fp = recoInc.body.data.recommendationFingerprint as string;

    for (const [label, body] of [
      [
        'adjusted-missing',
        {
          recommendationFingerprint: fp,
          decision: 'ADJUSTED',
          clientCommandId: `cmd-val-miss-${stamp}`,
        },
      ],
      [
        'adjusted-zero',
        {
          recommendationFingerprint: fp,
          decision: 'ADJUSTED',
          adjustedWeightKg: 0,
          clientCommandId: `cmd-val-0-${stamp}`,
        },
      ],
      [
        'accepted-with-weight',
        {
          recommendationFingerprint: fp,
          decision: 'ACCEPTED',
          adjustedWeightKg: 81,
          clientCommandId: `cmd-val-accw-${stamp}`,
        },
      ],
      [
        'ignored-with-weight',
        {
          recommendationFingerprint: fp,
          decision: 'IGNORED',
          adjustedWeightKg: 81,
          clientCommandId: `cmd-val-ignw-${stamp}`,
        },
      ],
    ] as const) {
      const res = await decideRecommendation(
        app,
        tokenA,
        tplInc.templateExerciseId,
        body,
      );
      expect(res.status, label).toBe(400);
    }
  });

  it('stale si la cible change avant application', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-stale-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-05',
      [10, 10, 10],
      { prefix: `d-stale-${stamp}`, rir: 2 },
    );
    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    const oldFp = reco.body.data.recommendationFingerprint as string;

    await prisma.workoutTemplateSet.updateMany({
      where: {
        workoutTemplateExerciseId: tpl.templateExerciseId,
        setType: 'WORKING',
      },
      data: { targetWeightKg: 85 },
    });

    const stale = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: oldFp,
        decision: 'ACCEPTED',
        clientCommandId: `cmd-stale-${stamp}`,
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('LOAD_RECOMMENDATION_STALE');

    const sets = await readTemplateSets(prisma, tpl.templateExerciseId);
    expect(
      sets
        .filter((s) => s.setType === 'WORKING')
        .every((s) => Number(s.targetWeightKg) === 85),
    ).toBe(true);
  });

  it('idempotence clientCommandId + conflit payload', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-idemp-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-06',
      [10, 10, 10],
      { prefix: `d-idemp-${stamp}`, rir: 2 },
    );
    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    const payload = {
      recommendationFingerprint: reco.body.data.recommendationFingerprint,
      decision: 'ACCEPTED',
      clientCommandId: `cmd-idemp-${stamp}`,
    };

    const first = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      payload,
    );
    expect(first.status).toBe(201);
    const second = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      payload,
    );
    expect(second.status).toBe(201);
    expect(second.body.data.decision.id).toBe(first.body.data.decision.id);

    const count = await prisma.loadRecommendationDecision.count({
      where: {
        ownerUserId: (await prisma.user.findFirstOrThrow({
          where: { email: `load-d-a-${stamp}@example.com` },
        })).id,
        clientCommandId: `cmd-idemp-${stamp}`,
      },
    });
    expect(count).toBe(1);

    // Nouvelle reco après application → conflit si même commandId avec autre payload
    const conflict = await decideRecommendation(
      app,
      tokenA,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'IGNORED',
        clientCommandId: `cmd-idemp-${stamp}`,
      },
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe(
      'LOAD_RECOMMENDATION_COMMAND_CONFLICT',
    );
  });

  it('séance ACTIVE inchangée ; future séance snapshotte la nouvelle cible', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-snap-${stamp}`, {
      withWarmup: true,
    });
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-07',
      [10, 10, 10],
      { prefix: `d-snap-${stamp}`, rir: 2 },
    );

    const active = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-08',
    );
    const activeWorking = active.exercises[0]!.sets.filter(
      (s) => s.setType === 'WORKING',
    );
    const activeDetail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${active.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const activeWeights = activeDetail.body.data.exercises[0].sets
      .filter((s: { setType: string }) => s.setType === 'WORKING')
      .map((s: { targetWeightKg: number | null }) => s.targetWeightKg);
    expect(activeWeights.every((w: number) => w === 80)).toBe(true);

    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    await decideRecommendation(app, tokenA, tpl.templateExerciseId, {
      recommendationFingerprint: reco.body.data.recommendationFingerprint,
      decision: 'ACCEPTED',
      clientCommandId: `cmd-snap-${stamp}`,
    }).expect(201);

    const activeAfter = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${active.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const weightsAfter = activeAfter.body.data.exercises[0].sets
      .filter((s: { setType: string }) => s.setType === 'WORKING')
      .map((s: { targetWeightKg: number | null }) => s.targetWeightKg);
    expect(weightsAfter.every((w: number) => w === 80)).toBe(true);

    await cancelWorkout(app, tokenA, active, `cmd-snap-cancel-${stamp}`);

    const future = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-09',
    );
    const futureDetail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${future.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const futureWeights = futureDetail.body.data.exercises[0].sets
      .filter((s: { setType: string }) => s.setType === 'WORKING')
      .map((s: { targetWeightKg: number | null }) => s.targetWeightKg);
    expect(futureWeights.every((w: number) => w === 82.5)).toBe(true);
    const futureWarmup = futureDetail.body.data.exercises[0].sets.find(
      (s: { setType: string }) => s.setType === 'WARMUP',
    );
    expect(futureWarmup.targetWeightKg).toBe(40);
    expect(activeWorking.length).toBeGreaterThan(0);

    await cancelWorkout(app, tokenA, future, `cmd-snap-future-cancel-${stamp}`);
  });

  it('historique décisions + isolation multi-user', async () => {
    const tpl = await createLoadTemplate(app, tokenA, prisma, `d-hist-${stamp}`);
    await completeWorkingReps(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-10',
      [10, 10, 10],
      { prefix: `d-hist-${stamp}`, rir: 2 },
    );
    const reco = await getRecommendation(app, tokenA, tpl.templateExerciseId);
    await decideRecommendation(app, tokenA, tpl.templateExerciseId, {
      recommendationFingerprint: reco.body.data.recommendationFingerprint,
      decision: 'IGNORED',
      clientCommandId: `cmd-hist-${stamp}`,
    }).expect(201);

    const list = await listDecisions(app, tokenA, tpl.templateExerciseId, {
      limit: '5',
    });
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data[0].decisionType).toBe('IGNORED');
    expect(list.body.data[0]).not.toHaveProperty('evidenceSnapshot');
    expect(list.body.data[0]).not.toHaveProperty('payloadFingerprint');

    const foreign = await listDecisions(app, tokenB, tpl.templateExerciseId);
    expect(foreign.status).toBe(404);

    const decideForeign = await decideRecommendation(
      app,
      tokenB,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: reco.body.data.recommendationFingerprint,
        decision: 'IGNORED',
        clientCommandId: `cmd-hist-b-${stamp}`,
      },
    );
    expect(decideForeign.status).toBe(404);

    const unauth = await decideRecommendation(
      app,
      null,
      tpl.templateExerciseId,
      {
        recommendationFingerprint: 'x',
        decision: 'IGNORED',
        clientCommandId: `cmd-hist-u-${stamp}`,
      },
    );
    expect(unauth.status).toBe(401);
  });
});
