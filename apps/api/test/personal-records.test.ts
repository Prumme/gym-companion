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
    equipmentTypeId: exercise.defaultEquipmentTypeId,
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
      exerciseNameSnapshot: string;
      sets: Array<{ id: string; status: string }>;
    }>;
  };
}

async function completeSet(
  app: INestApplication,
  token: string,
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
    throw new Error('Session de test sans exercice/série.');
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
  return response.body.data.workoutSet;
}

async function completeWorkout(
  app: INestApplication,
  token: string,
  session: { id: string; version: number },
  cmd: string,
) {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/workouts/${session.id}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion: session.version,
      notes: null,
      clientCommandId: cmd,
    })
    .expect(200);
  return response.body.data.workoutSession;
}

describe('Personal records API (4.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let weightTpl: Startable;
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

    tokenA = await registerUser(app, `pr-a-${stamp}@example.com`, 'PR A');
    tokenB = await registerUser(app, `pr-b-${stamp}@example.com`, 'PR B');
    weightTpl = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `W-${stamp}`,
      'WEIGHT_REPS',
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
        where: { email: `pr-a-${stamp}@example.com` },
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
        name: `Course PR ${stamp}`,
        normalizedName: `course pr ${stamp}`,
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
    await createStartableTemplate(app, tokenB, prisma, `B-${stamp}`);
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  it('exige l’auth et retourne une liste vide', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .expect(401);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('exclut ACTIVE / PAUSED / CANCELLED et crée un record après COMPLETE', async () => {
    const active = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-01',
    );
    await completeSet(
      app,
      tokenA,
      active,
      {
        status: 'COMPLETED',
        actualWeightKg: 100,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
      },
      `set-active-${stamp}`,
    );

    const whileActive = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(whileActive.body.data).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${active.id}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: active.version,
        clientCommandId: `pause-${stamp}`,
      })
      .expect(200);
    active.version += 1;

    const whilePaused = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(whilePaused.body.data).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${active.id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: active.version,
        clientCommandId: `resume-${stamp}`,
      })
      .expect(200);
    active.version += 1;

    await completeWorkout(app, tokenA, active, `complete-${stamp}`);

    const records = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(records.body.data.length).toBeGreaterThanOrEqual(1);
    const maxWeight = records.body.data.find(
      (r: { recordType: string }) => r.recordType === 'MAX_WEIGHT',
    );
    expect(maxWeight.value).toBe(100);
    expect(maxWeight.context.reps).toBe(5);
    expect(maxWeight.source.workoutSessionId).toBe(active.id);
    expect(maxWeight).not.toHaveProperty('ownerUserId');
    expect(JSON.stringify(records.body)).not.toContain('ownerUserId');

    const cancelled = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-02',
    );
    await completeSet(
      app,
      tokenA,
      cancelled,
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
      `set-cancel-${stamp}`,
    );
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${cancelled.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: cancelled.version,
        keepRecordedData: true,
        reason: null,
        clientCommandId: `cancel-cmd-${stamp}`,
      })
      .expect(200);

    const afterCancel = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const still100 = afterCancel.body.data.find(
      (r: { recordType: string; exerciseId: string }) =>
        r.recordType === 'MAX_WEIGHT' &&
        r.exerciseId === weightTpl.exerciseId,
    );
    expect(still100.value).toBe(100);
  });

  it('exclut PARTIAL / FAILED / WARMUP et gère tie-break / meilleurs records', async () => {
    const session = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-03',
    );
    const exercise = session.exercises[0];
    if (!exercise) {
      throw new Error('Session de test sans exercice.');
    }

    // Ajoute une série WARMUP via Prisma pour tester l’exclusion.
    const warmup = await prisma.workoutSet.create({
      data: {
        workoutSessionExerciseId: exercise.id,
        ownerUserId: (
          await prisma.workoutSession.findUniqueOrThrow({
            where: { id: session.id },
          })
        ).ownerUserId,
        position: 99,
        setType: 'WARMUP',
        status: 'COMPLETED',
        actualWeightKg: 150,
        actualReps: 5,
        completedAt: new Date(),
      },
    });

    await completeSet(
      app,
      tokenA,
      session,
      {
        status: 'PARTIAL',
        actualWeightKg: 140,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `partial-${stamp}`,
    );

    // Remet la série en FAILED avec charge élevée (exclu).
    await completeSet(
      app,
      tokenA,
      session,
      {
        status: 'FAILED',
        actualWeightKg: 145,
        actualReps: 0,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: true,
      },
      `failed-${stamp}`,
    );

    await completeSet(
      app,
      tokenA,
      session,
      {
        status: 'COMPLETED',
        actualWeightKg: 110,
        actualReps: 3,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 0,
        actualRpe: null,
        reachedFailure: true,
      },
      `best-weight-${stamp}`,
    );

    await completeWorkout(app, tokenA, session, `complete-mix-${stamp}`);

    const records = await request(app.getHttpServer())
      .get(`/api/v1/personal-records?exerciseId=${weightTpl.exerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const maxWeight = records.body.data.find(
      (r: { recordType: string }) => r.recordType === 'MAX_WEIGHT',
    );
    expect(maxWeight.value).toBe(110);
    expect(maxWeight.source.workoutSetId).not.toBe(warmup.id);

    const highReps = await startWorkout(
      app,
      tokenA,
      weightTpl.templateId,
      '2026-08-04',
    );
    await completeSet(
      app,
      tokenA,
      highReps,
      {
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 20,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
      },
      `high-reps-${stamp}`,
    );
    await completeWorkout(app, tokenA, highReps, `complete-reps-${stamp}`);

    const filtered = await request(app.getHttpServer())
      .get(
        `/api/v1/personal-records?exerciseId=${weightTpl.exerciseId}&recordType=MAX_REPS`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].recordType).toBe('MAX_REPS');
    expect(filtered.body.data[0].value).toBe(20);
  });

  it('supporte durée, distance, exercice archivé, rename snapshot et isolation', async () => {
    const durSession = await startWorkout(
      app,
      tokenA,
      durationTpl.templateId,
      '2026-08-05',
    );
    await completeSet(
      app,
      tokenA,
      durSession,
      {
        status: 'COMPLETED',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: 180,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `dur-set-${stamp}`,
    );
    await completeWorkout(app, tokenA, durSession, `dur-complete-${stamp}`);

    const distSession = await startWorkout(
      app,
      tokenA,
      distanceTpl.templateId,
      '2026-08-06',
    );
    await completeSet(
      app,
      tokenA,
      distSession,
      {
        status: 'COMPLETED',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: 400,
        actualDistanceMeters: 1500,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
      },
      `dist-set-${stamp}`,
    );
    await completeWorkout(app, tokenA, distSession, `dist-complete-${stamp}`);

    const byExercise = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${durationTpl.exerciseId}/personal-records`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(byExercise.body.data[0].recordType).toBe('MAX_DURATION');
    expect(byExercise.body.data[0].value).toBe(180);

    const emptyExercise = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${weightTpl.exerciseId}/personal-records`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    // SYSTEM exercise accessible but no records for B
    expect(emptyExercise.body.data).toEqual([]);

    const foreignUserExercise = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Perso PR ${stamp}`,
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupId: (
          await prisma.muscleGroup.findFirstOrThrow({
            where: { parentId: null },
          })
        ).id,
        defaultEquipmentTypeId: weightTpl.equipmentTypeId,
        secondaryMuscleGroupIds: [],
        compatibleEquipmentTypes: weightTpl.equipmentTypeId
          ? [
              {
                equipmentTypeId: weightTpl.equipmentTypeId,
                isPreferred: true,
                notes: null,
              },
            ]
          : [],
        instructions: null,
        defaultRestSeconds: 90,
      })
      .expect(201);
    const personalExerciseId = foreignUserExercise.body.data.id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${personalExerciseId}/personal-records`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    // Rename catalogue : le snapshot historique doit rester pour le nom du record.
    const snapshotName =
      (
        await request(app.getHttpServer())
          .get('/api/v1/personal-records')
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200)
      ).body.data.find(
        (r: { exerciseId: string; recordType: string }) =>
          r.exerciseId === weightTpl.exerciseId &&
          r.recordType === 'MAX_WEIGHT',
      )?.exercise.name ?? null;

    await prisma.exercise.update({
      where: { id: weightTpl.exerciseId },
      data: { name: `Renamed ${stamp}` },
    });

    const afterRename = await request(app.getHttpServer())
      .get(
        `/api/v1/personal-records?exerciseId=${weightTpl.exerciseId}&recordType=MAX_WEIGHT`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterRename.body.data[0].exercise.name).toBe(snapshotName);
    expect(afterRename.body.data[0].exercise.name).not.toContain('Renamed');

    // Exercice user archivé reste consultable pour le propriétaire (sans record).
    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const archivedEmpty = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${personalExerciseId}/personal-records`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(archivedEmpty.body.data).toEqual([]);

    const forB = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(forB.body.data).toEqual([]);

    const invalidType = await request(app.getHttpServer())
      .get('/api/v1/personal-records?recordType=MAX_VOLUME')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    expect(invalidType.body.error.code).toBe('PERSONAL_RECORD_INVALID_TYPE');

    const page1 = await request(app.getHttpServer())
      .get('/api/v1/personal-records?limit=1')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.pagination.hasMore).toBe(true);
    expect(page1.body.pagination.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(
        `/api/v1/personal-records?limit=1&cursor=${encodeURIComponent(page1.body.pagination.nextCursor)}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0].source.workoutSetId).not.toBe(
      page1.body.data[0].source.workoutSetId,
    );
  });
});
