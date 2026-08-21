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

describe('Replace workout session exercise API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let programId = '';
  let templateId = '';
  let templateExerciseId = '';
  let originalExerciseId = '';
  let replacementExerciseId = '';
  let durationExerciseId = '';
  let sessionId = '';
  let sessionExerciseId = '';
  let setId = '';
  const emailA = `replace-a-${Date.now()}@example.com`;
  const emailB = `replace-b-${Date.now()}@example.com`;

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

    tokenA = await registerUser(app, emailA, 'Replace A');
    tokenB = await registerUser(app, emailB, 'Replace B');

    const weightExercises = await prisma.exercise.findMany({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'WEIGHT_REPS',
      },
      orderBy: { name: 'asc' },
      take: 2,
    });
    expect(weightExercises.length).toBeGreaterThanOrEqual(2);
    originalExerciseId = weightExercises[0]!.id;
    replacementExerciseId = weightExercises[1]!.id;

    const durationExercise = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'DURATION',
      },
    });
    durationExerciseId = durationExercise.id;

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Full Body A', goal: 'HYPERTROPHY' })
      .expect(201);
    programId = program.body.data.id as string;

    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Séance A' })
      .expect(201);
    templateId = tpl.body.data.workoutTemplates[0].id as string;

    const original = await prisma.exercise.findUniqueOrThrow({
      where: { id: originalExerciseId },
    });

    const ex = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: originalExerciseId,
        equipmentTypeId: original.defaultEquipmentTypeId,
        restSecondsOverride: 90,
        notes: null,
      })
      .expect(201);
    templateExerciseId = ex.body.data.workoutTemplates[0].exercises[0]
      .id as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`,
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

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`,
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

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`,
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

    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateId,
        localDate: '2026-08-21',
        timezone: 'Europe/Paris',
      })
      .expect(201);

    sessionId = created.body.data.id;
    sessionExerciseId = created.body.data.exercises[0].id;
    setId = created.body.data.exercises[0].sets[0].id;
    expect(created.body.data.exercises[0].sourceExerciseId).toBe(
      originalExerciseId,
    );
    expect(created.body.data.exercises[0].sets).toHaveLength(3);
  });

  afterAll(async () => {
    await app.close();
  });

  function replacePath(sid = sessionId, seid = sessionExerciseId) {
    return `/api/v1/workouts/${sid}/exercises/${seid}/exercise`;
  }

  async function getVersion(): Promise<number> {
    const active = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    return active.body.data.version as number;
  }

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .patch(replacePath())
      .send({ exerciseId: replacementExerciseId, expectedVersion: 1 })
      .expect(401);
  });

  it('rejects other user with neutral 404', async () => {
    const version = await getVersion();
    const response = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        exerciseId: replacementExerciseId,
        expectedVersion: version,
      })
      .expect(404);
    expect(response.body.error.code).toBe('WORKOUT_NOT_FOUND');
  });

  it('rejects incompatible measurementType', async () => {
    const version = await getVersion();
    const response = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: durationExerciseId,
        expectedVersion: version,
      })
      .expect(400);
    expect(response.body.error.code).toBe(
      'WORKOUT_EXERCISE_MEASUREMENT_INCOMPATIBLE',
    );
  });

  it('rejects inaccessible personal exercise of another user', async () => {
    const muscle = await prisma.muscleGroup.findFirstOrThrow();
    const foreign = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: (
          await prisma.user.findFirstOrThrow({
            where: { email: emailB },
          })
        ).id,
        name: `Perso B ${Date.now()}`,
        normalizedName: `perso-b-${Date.now()}`,
        primaryMuscleGroupId: muscle.id,
        measurementType: 'WEIGHT_REPS',
      },
    });

    const version = await getVersion();
    const response = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: foreign.id,
        expectedVersion: version,
      })
      .expect(404);
    expect(response.body.error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('replaces WEIGHT_REPS → WEIGHT_REPS and keeps targets', async () => {
    const version = await getVersion();
    const response = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: replacementExerciseId,
        expectedVersion: version,
      })
      .expect(200);

    const exercise = response.body.data.exercises[0];
    expect(exercise.sourceExerciseId).toBe(replacementExerciseId);
    expect(exercise.sets).toHaveLength(3);
    expect(exercise.sets[0].targetRepMin).toBe(8);
    expect(exercise.sets[0].targetRepMax).toBe(12);
    expect(exercise.sets[0].targetRir).toBe(2);
    expect(exercise.sets.every((s: { status: string }) => s.status === 'PENDING')).toBe(
      true,
    );
    expect(response.body.data.version).toBe(version + 1);

    const replacement = await prisma.exercise.findUniqueOrThrow({
      where: { id: replacementExerciseId },
    });
    expect(exercise.exerciseName).toBe(replacement.name);
  });

  it('is idempotent when replacing with the same exercise', async () => {
    const version = await getVersion();
    const response = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: replacementExerciseId,
        expectedVersion: version,
      })
      .expect(200);
    expect(response.body.data.version).toBe(version);
    expect(response.body.data.exercises[0].sourceExerciseId).toBe(
      replacementExerciseId,
    );
  });

  it('leaves Program / WorkoutTemplate unchanged', async () => {
    const program = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const tplExercise =
      program.body.data.workoutTemplates[0].exercises[0];
    expect(tplExercise.exercise.id).toBe(originalExerciseId);

    const row = await prisma.workoutTemplateExercise.findUniqueOrThrow({
      where: { id: templateExerciseId },
    });
    expect(row.exerciseId).toBe(originalExerciseId);
  });

  it('rejects when a set is already recorded', async () => {
    const version = await getVersion();
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${sessionExerciseId}/sets/${setId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 80,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: version,
      })
      .expect(200);

    const nextVersion = await getVersion();
    const response = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: originalExerciseId,
        expectedVersion: nextVersion,
      })
      .expect(400);
    expect(response.body.error.code).toBe(
      'WORKOUT_EXERCISE_HAS_RECORDED_SETS',
    );
  });

  it('rejects completed session and next session starts with original exercise', async () => {
    // Reset set to PENDING so we can complete the workout cleanly.
    let version = await getVersion();
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${sessionExerciseId}/sets/${setId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'PENDING',
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: version,
      })
      .expect(200);

    version = await getVersion();
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version })
      .expect(200);

    const refuse = await request(app.getHttpServer())
      .patch(replacePath())
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: originalExerciseId,
        expectedVersion: version + 1,
      })
      .expect(400);
    expect(refuse.body.error.code).toBe('WORKOUT_NOT_EDITABLE');

    const next = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateId,
        localDate: '2026-08-22',
        timezone: 'Europe/Paris',
      })
      .expect(201);

    expect(next.body.data.exercises[0].sourceExerciseId).toBe(
      originalExerciseId,
    );
  });

  it('history of first session keeps the replacement exercise', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data.status).toBe('COMPLETED');
    expect(detail.body.data.exercises[0].sourceExerciseId).toBe(
      replacementExerciseId,
    );
  });
});
