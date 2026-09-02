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
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret-at-least-32-chars!!';
  process.env.COOKIE_SECRET =
    process.env.COOKIE_SECRET ?? 'test-cookie-secret-at-least-32-characters';
  process.env.EMAIL_PROVIDER = 'none';
  process.env.LOG_LEVEL = 'error';
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

describe('Add workout session exercise / set API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userAId = '';
  let programId = '';
  let templateId = '';
  let legPressId = '';
  let benchId = '';
  let legExtensionId = '';
  let durationExerciseId = '';
  let personalExerciseId = '';
  let sessionId = '';
  const stamp = Date.now();
  const emailA = `add-ex-a-${stamp}@example.com`;
  const emailB = `add-ex-b-${stamp}@example.com`;

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

    tokenA = await registerUser(app, emailA, 'Add Ex A');
    tokenB = await registerUser(app, emailB, 'Add Ex B');
    userAId = (
      await prisma.user.findFirstOrThrow({ where: { email: emailA } })
    ).id;

    const weightExercises = await prisma.exercise.findMany({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'WEIGHT_REPS',
      },
      orderBy: { name: 'asc' },
      take: 4,
    });
    expect(weightExercises.length).toBeGreaterThanOrEqual(3);
    legPressId = weightExercises[0]!.id;
    benchId = weightExercises[1]!.id;
    legExtensionId = weightExercises[2]!.id;

    const durationExercise = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'DURATION',
      },
    });
    durationExerciseId = durationExercise.id;

    const muscle = await prisma.muscleGroup.findFirstOrThrow();
    const personal = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: userAId,
        name: `Leg curl perso ${stamp}`,
        normalizedName: `leg-curl-perso-${stamp}`,
        primaryMuscleGroupId: muscle.id,
        measurementType: 'WEIGHT_REPS',
        defaultEquipmentTypeId: weightExercises[0]!.defaultEquipmentTypeId,
        defaultRestSeconds: 90,
      },
    });
    personalExerciseId = personal.id;

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Full Body A', goal: 'HYPERTROPHY' })
      .expect(201);
    programId = program.body.data.id as string;

    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Full Body A' })
      .expect(201);
    templateId = tpl.body.data.workoutTemplates[0].id as string;

    for (const exerciseId of [legPressId, benchId]) {
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { id: exerciseId },
      });
      const added = await request(app.getHttpServer())
        .post(
          `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
        )
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          exerciseId,
          equipmentTypeId: exercise.defaultEquipmentTypeId,
          restSecondsOverride: 90,
          notes: null,
        })
        .expect(201);
      const templateExercise = added.body.data.workoutTemplates[0].exercises.find(
        (row: { exercise: { id: string } }) => row.exercise.id === exerciseId,
      );
      await request(app.getHttpServer())
        .post(
          `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExercise.id}/sets`,
        )
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          setType: 'WORKING',
          targetRepMin: 8,
          targetRepMax: 12,
          targetDurationSeconds: null,
          targetDistanceMeters: null,
          targetWeightKg: null,
          targetIntensityPercent: null,
          targetRir: 2,
          targetRpe: null,
          restSeconds: 120,
        })
        .expect(201);
    }

    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateId,
        localDate: '2026-09-02',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    sessionId = created.body.data.id;
    expect(created.body.data.exercises).toHaveLength(2);
  });

  afterAll(async () => {
    if (userAId) {
      await prisma.workoutSession.updateMany({
        where: {
          ownerUserId: userAId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'test cleanup',
        },
      });
    }
    await app.close();
  });

  async function getActive() {
    const response = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    return response.body.data as {
      id: string;
      version: number;
      status: string;
      exercises: Array<{
        id: string;
        position: number;
        sourceExerciseId: string | null;
        exerciseName: string;
        sets: Array<{
          id: string;
          position: number;
          setType: string;
          status: string;
          targetWeightKg: number | null;
          targetRepMin: number | null;
          targetRepMax: number | null;
        }>;
      }>;
    };
  }

  it('adds a SYSTEM exercise at the end with one empty WORKING set', async () => {
    const active = await getActive();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: legExtensionId,
        expectedVersion: active.version,
      })
      .expect(201);

    const exercises = response.body.data.exercises as Array<{
      id: string;
      position: number;
      sourceExerciseId: string;
      measurementType: string;
      sets: Array<{
        position: number;
        setType: string;
        status: string;
        targetWeightKg: number | null;
        targetRepMin: number | null;
      }>;
    }>;
    expect(exercises).toHaveLength(3);
    const added = exercises[2]!;
    expect(added.sourceExerciseId).toBe(legExtensionId);
    expect(added.position).toBe(2);
    expect(added.sets).toHaveLength(1);
    expect(added.sets[0]!.setType).toBe('WORKING');
    expect(added.sets[0]!.status).toBe('PENDING');
    expect(added.sets[0]!.targetWeightKg).toBeNull();
    expect(added.sets[0]!.targetRepMin).toBeNull();
    expect(added.sets[0]!.position).toBe(0);
    expect(response.body.data.version).toBe(active.version + 1);

    const row = await prisma.workoutSessionExercise.findUniqueOrThrow({
      where: { id: added.id },
    });
    expect(row.sourceTemplateExerciseId).toBeNull();
  });

  it('refuses a duplicate catalog exercise already in the session', async () => {
    const active = await getActive();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: legExtensionId,
        expectedVersion: active.version,
      })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_EXERCISE_ALREADY_IN_SESSION');
  });

  it('adds a PERSONAL exercise belonging to the user', async () => {
    const active = await getActive();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: personalExerciseId,
        expectedVersion: active.version,
      })
      .expect(201);
    const added = response.body.data.exercises.find(
      (exercise: { sourceExerciseId: string }) =>
        exercise.sourceExerciseId === personalExerciseId,
    );
    expect(added).toBeDefined();
    expect(added.sets).toHaveLength(1);
  });

  it('refuses a PERSONAL exercise owned by another user', async () => {
    const muscle = await prisma.muscleGroup.findFirstOrThrow();
    const foreign = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: (
          await prisma.user.findFirstOrThrow({ where: { email: emailB } })
        ).id,
        name: `Foreign ${stamp}`,
        normalizedName: `foreign-${stamp}`,
        primaryMuscleGroupId: muscle.id,
        measurementType: 'WEIGHT_REPS',
      },
    });
    const active = await getActive();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: foreign.id,
        expectedVersion: active.version,
      })
      .expect(404);
    expect(response.body.error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('refuses another user’s session', async () => {
    const active = await getActive();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        exerciseId: durationExerciseId,
        expectedVersion: active.version,
      })
      .expect(404);
    expect(response.body.error.code).toBe('WORKOUT_NOT_FOUND');
  });

  it('adds WORKING sets without inventing targets and numbers them sequentially', async () => {
    const before = await getActive();
    const adHoc = before.exercises.find(
      (exercise) => exercise.sourceExerciseId === legExtensionId,
    );
    expect(adHoc).toBeDefined();

    const first = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises/${adHoc!.id}/sets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: before.version,
        clientCommandId: `add-set-${stamp}-1`,
      })
      .expect(201);
    const afterFirst = first.body.data.exercises.find(
      (exercise: { id: string }) => exercise.id === adHoc!.id,
    );
    expect(afterFirst.sets).toHaveLength(2);
    expect(afterFirst.sets[1].position).toBe(1);
    expect(afterFirst.sets[1].setType).toBe('WORKING');
    expect(afterFirst.sets[1].targetRepMin).toBeNull();
    expect(afterFirst.sets[1].targetWeightKg).toBeNull();

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises/${adHoc!.id}/sets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: first.body.data.version,
        clientCommandId: `add-set-${stamp}-1`,
      })
      .expect(201);
    expect(
      replay.body.data.exercises.find(
        (exercise: { id: string }) => exercise.id === adHoc!.id,
      ).sets,
    ).toHaveLength(2);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises/${adHoc!.id}/sets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: replay.body.data.version,
      })
      .expect(201);
    const afterSecond = second.body.data.exercises.find(
      (exercise: { id: string }) => exercise.id === adHoc!.id,
    );
    expect(afterSecond.sets.map((set: { position: number }) => set.position)).toEqual(
      [0, 1, 2],
    );
  });

  it('adds a set on a template-sourced exercise without copying targets', async () => {
    const active = await getActive();
    const templateExercise = active.exercises.find(
      (exercise) => exercise.sourceExerciseId === legPressId,
    );
    expect(templateExercise).toBeDefined();
    const originalCount = templateExercise!.sets.length;

    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/workouts/${sessionId}/exercises/${templateExercise!.id}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: active.version })
      .expect(201);
    const updated = response.body.data.exercises.find(
      (exercise: { id: string }) => exercise.id === templateExercise!.id,
    );
    expect(updated.sets).toHaveLength(originalCount + 1);
    const added = updated.sets[updated.sets.length - 1];
    expect(added.setType).toBe('WORKING');
    expect(added.targetRepMin).toBeNull();
    expect(added.targetRepMax).toBeNull();
  });

  it('refuses a set on an exercise that does not belong to the session', async () => {
    const active = await getActive();
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/workouts/${sessionId}/exercises/11111111-1111-4111-8111-111111111111/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: active.version })
      .expect(404);
    expect(response.body.error.code).toBe('WORKOUT_SESSION_EXERCISE_NOT_FOUND');
  });

  it('does not mutate the source template or program', async () => {
    const program = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const template = program.body.data.workoutTemplates.find(
      (row: { id: string }) => row.id === templateId,
    );
    expect(template.exercises).toHaveLength(2);
    expect(
      template.exercises.map((row: { exercise: { id: string } }) => row.exercise.id),
    ).toEqual([legPressId, benchId]);
  });

  it('records ad-hoc performance in history, progress and records after complete', async () => {
    const active = await getActive();
    const adHoc = active.exercises.find(
      (exercise) => exercise.sourceExerciseId === legExtensionId,
    );
    expect(adHoc).toBeDefined();
    expect(adHoc!.sets.length).toBeGreaterThanOrEqual(3);

    let version = active.version;
    const payloads = [
      { weight: 60, reps: 12 },
      { weight: 65, reps: 10 },
      { weight: 65, reps: 9 },
    ];
    for (let index = 0; index < 3; index += 1) {
      const set = adHoc!.sets[index]!;
      const patched = await request(app.getHttpServer())
        .patch(
          `/api/v1/workouts/${sessionId}/exercises/${adHoc!.id}/sets/${set.id}`,
        )
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'COMPLETED',
          actualWeightKg: payloads[index]!.weight,
          actualReps: payloads[index]!.reps,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: 2,
          actualRpe: null,
          reachedFailure: false,
          notes: null,
          expectedVersion: version,
          clientCommandId: `complete-adhoc-${stamp}-${index}`,
        })
        .expect(200);
      version = patched.body.data.workoutSessionVersion as number;
    }

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, clientCommandId: `complete-${stamp}` })
      .expect(200);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const names = history.body.data.exercises.map(
      (exercise: { exerciseName: string; sourceExerciseId: string }) =>
        exercise.sourceExerciseId,
    );
    expect(names).toContain(legPressId);
    expect(names).toContain(benchId);
    expect(names).toContain(legExtensionId);

    const records = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${legExtensionId}/personal-records`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const maxWeight = (records.body.data as Array<{ recordType: string; value: number }>).find(
      (record) => record.recordType === 'MAX_WEIGHT',
    );
    expect(maxWeight?.value).toBe(65);

    const progress = await request(app.getHttpServer())
      .get(`/api/v1/progress/exercises/${legExtensionId}?metric=MAX_WEIGHT`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(progress.body.data.points.length).toBeGreaterThanOrEqual(1);

    const lastSets = await request(app.getHttpServer())
      .get(
        `/api/v1/progress/last-working-sets?exerciseIds=${legExtensionId},${benchId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const last = (
      lastSets.body.data as Array<{
        exerciseId: string;
        actualWeightKg: number;
        actualReps: number;
      }>
    ).find((row) => row.exerciseId === legExtensionId);
    expect(last?.actualWeightKg).toBe(65);
    expect(last?.actualReps).toBe(9);

    const refuse = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: durationExerciseId,
        expectedVersion: version + 10,
      })
      .expect(400);
    expect(refuse.body.error.code).toBe('WORKOUT_NOT_EDITABLE');

    const next = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateId,
        localDate: '2026-09-03',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    expect(next.body.data.exercises).toHaveLength(2);
    expect(
      next.body.data.exercises.map(
        (exercise: { sourceExerciseId: string }) => exercise.sourceExerciseId,
      ),
    ).toEqual([legPressId, benchId]);
  });
});
