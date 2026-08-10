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
  equipmentTypeId: string | null;
};

async function createUserExerciseTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
  measurementType: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' = 'WEIGHT_REPS',
): Promise<Startable> {
  let exerciseId: string;
  let equipmentTypeId: string | null;
  if (measurementType === 'WEIGHT_REPS') {
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
        name: `Plateau Ex ${name}`,
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
      where: { source: 'SYSTEM', archivedAt: null, measurementType },
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

  for (let i = 0; i < 3; i += 1) {
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
        targetWeightKg: measurementType === 'WEIGHT_REPS' ? 80 : null,
        targetIntensityPercent: null,
        targetRir: 2,
        targetRpe: null,
        restSeconds: 120,
      })
      .expect(201);
  }

  return { programId, templateId, exerciseId, equipmentTypeId };
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
  if (!exercise || !set) throw new Error('Missing set');
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

function workingIndexes(session: {
  exercises: Array<{ sets: Array<{ setType: string }> }>;
}): number[] {
  return (session.exercises[0]?.sets ?? [])
    .map((set, index) => (set.setType === 'WORKING' ? index : -1))
    .filter((index) => index >= 0);
}

async function completeWorking(
  app: INestApplication,
  token: string,
  templateId: string,
  localDate: string,
  reps: number[],
  weightKg: number,
  prefix: string,
) {
  const session = await startWorkout(app, token, templateId, localDate);
  const indexes = workingIndexes(session);
  for (let i = 0; i < indexes.length; i += 1) {
    const setIndex = indexes[i]!;
    const rep = reps[i] ?? reps[reps.length - 1] ?? 8;
    await patchSet(
      app,
      token,
      session,
      setIndex,
      {
        status: 'COMPLETED',
        actualWeightKg: weightKg,
        actualReps: rep,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `${prefix}-set-${i}`,
    );
  }
  await completeWorkout(app, token, session, `${prefix}-complete`);
}

function getPlateau(
  app: INestApplication,
  token: string | null,
  exerciseId: string,
  query: Record<string, string> = {},
) {
  const req = request(app.getHttpServer()).get(
    `/api/v1/coaching/exercises/${exerciseId}/plateau-analysis`,
  );
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.query(query);
}

describe('Plateau analysis API (5.3)', () => {
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
    tokenA = await registerUser(app, `plat-a-${stamp}@example.com`, 'Plat A');
    tokenB = await registerUser(app, `plat-b-${stamp}@example.com`, 'Plat B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige auth et isole les utilisateurs', async () => {
    const tpl = await createUserExerciseTemplate(
      app,
      tokenA,
      prisma,
      `auth-${stamp}`,
    );
    const unauth = await getPlateau(app, null, tpl.exerciseId);
    expect(unauth.status).toBe(401);
    const foreign = await getPlateau(app, tokenB, tpl.exerciseId);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('INSUFFICIENT_DATA sans historique et unsupported hors WEIGHT_REPS', async () => {
    const tpl = await createUserExerciseTemplate(
      app,
      tokenA,
      prisma,
      `empty-${stamp}`,
    );
    const empty = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(empty.status).toBe(200);
    expect(empty.body.data.status).toBe('INSUFFICIENT_DATA');
    expect(empty.body.data.supported).toBe(true);

    const bw = await createUserExerciseTemplate(
      app,
      tokenA,
      prisma,
      `bw-${stamp}`,
      'BODYWEIGHT_REPS',
    );
    const unsupported = await getPlateau(app, tokenA, bw.exerciseId);
    expect(unsupported.body.data.supported).toBe(false);
    expect(unsupported.body.data.status).toBe('INSUFFICIENT_DATA');
  });

  it('WATCH puis PLATEAU puis NONE après progression', async () => {
    const tpl = await createUserExerciseTemplate(
      app,
      tokenA,
      prisma,
      `flow-${stamp}`,
    );

    for (let day = 1; day <= 3; day += 1) {
      await completeWorking(
        app,
        tokenA,
        tpl.templateId,
        `2026-08-0${day}`,
        [9, 9, 9],
        80,
        `flow-w-${day}-${stamp}`,
      );
    }
    let res = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(res.body.data.status).toBe('WATCH');
    expect(res.body.data.evidence).toHaveLength(3);

    await completeWorking(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-04',
      [9, 9, 9],
      80,
      `flow-w-4-${stamp}`,
    );
    res = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(res.body.data.status).toBe('PLATEAU');

    await completeWorking(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-05',
      [8, 8, 8],
      82.5,
      `flow-w-5-${stamp}`,
    );
    res = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(res.body.data.status).toBe('NONE');
    expect(res.body.data.reasons).toContain('RECENT_PROGRESS_DETECTED');
    expect(res.body.data).not.toHaveProperty('ownerUserId');
    expect(res.body.data).not.toHaveProperty('prisma');
  });

  it('exclut CANCELLED et ACTIVE ; exercice archivé reste analysable', async () => {
    const tpl = await createUserExerciseTemplate(
      app,
      tokenA,
      prisma,
      `excl-${stamp}`,
    );
    await completeWorking(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-01',
      [8, 8, 8],
      80,
      `excl-1-${stamp}`,
    );
    const active = await startWorkout(app, tokenA, tpl.templateId, '2026-08-02');
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${active.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: active.version,
        keepRecordedData: true,
        reason: 'TEST',
        clientCommandId: `excl-cancel-${stamp}`,
      })
      .expect(200);

    const active2 = await startWorkout(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-03',
    );
    // leave active
    void active2;

    const res = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(res.body.data.range.analyzedWorkoutCount).toBe(1);
    expect(res.body.data.status).toBe('INSUFFICIENT_DATA');

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${active2.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: active2.version,
        keepRecordedData: true,
        reason: 'TEST',
        clientCommandId: `excl-cancel2-${stamp}`,
      })
      .expect(200);

    await prisma.exercise.update({
      where: { id: tpl.exerciseId },
      data: { archivedAt: new Date() },
    });
    const archived = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(archived.status).toBe(200);
    expect(archived.body.data.exerciseId).toBe(tpl.exerciseId);
  });

  it('cohérence phase 4/5 : plateau puis disparition après hausse', async () => {
    const tpl = await createUserExerciseTemplate(
      app,
      tokenA,
      prisma,
      `coh-${stamp}`,
    );
    for (let day = 1; day <= 4; day += 1) {
      await completeWorking(
        app,
        tokenA,
        tpl.templateId,
        `2026-07-0${day}`,
        [8, 8, 8],
        80,
        `coh-${day}-${stamp}`,
      );
    }
    const [plateau, progress, strength] = await Promise.all([
      getPlateau(app, tokenA, tpl.exerciseId),
      request(app.getHttpServer())
        .get(`/api/v1/progress/exercises/${tpl.exerciseId}?metric=MAX_WEIGHT`)
        .set('Authorization', `Bearer ${tokenA}`),
      request(app.getHttpServer())
        .get(`/api/v1/progress/exercises/${tpl.exerciseId}/strength`)
        .set('Authorization', `Bearer ${tokenA}`),
    ]);
    expect(plateau.body.data.status).toBe('PLATEAU');
    expect(progress.status).toBe(200);
    expect(strength.status).toBe(200);

    await completeWorking(
      app,
      tokenA,
      tpl.templateId,
      '2026-07-05',
      [8, 8, 8],
      82.5,
      `coh-5-${stamp}`,
    );
    const after = await getPlateau(app, tokenA, tpl.exerciseId);
    expect(after.body.data.status).toBe('NONE');
  });
});
