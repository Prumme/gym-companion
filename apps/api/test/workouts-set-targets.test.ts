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
    process.env.DATABASE_URL ?? 'postgresql://gym:gym@localhost:5433/gym_companion?schema=public';
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'error';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret-at-least-32-chars!!';
  process.env.COOKIE_SECRET =
    process.env.COOKIE_SECRET ?? 'test-cookie-secret-at-least-32-characters';
  process.env.EMAIL_PROVIDER = 'none';
}

async function registerUser(app: INestApplication, email: string, displayName: string) {
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

type SetRow = {
  id: string;
  position: number;
  setType: string;
  status: string;
  targetWeightKg: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetRestSeconds: number | null;
};

type ExerciseRow = { id: string; sourceExerciseId: string | null; sets: SetRow[] };

describe('Workout set targets API (docs/04 §4.6)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let sessionId = '';
  let weightExerciseId = '';
  let durationExerciseId = '';
  let version = 0;
  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  let programId = '';
  const targetsUrl = (exerciseId: string, setId: string) =>
    `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/${setId}/targets`;

  async function getDetail() {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    return response.body.data as { version: number; exercises: ExerciseRow[] };
  }

  beforeAll(async () => {
    applyTestEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    const config = app.get(AppConfigService);
    app.use(cookieParser(config.cookieSecret));
    app.useGlobalFilters(new GlobalExceptionFilter(config));
    await app.listen(0, '127.0.0.1');
    const prisma = app.get(PrismaService);

    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);

    tokenA = await registerUser(app, `targets-a-${stamp}@example.com`, 'Targets A');
    tokenB = await registerUser(app, `targets-b-${stamp}@example.com`, 'Targets B');

    const weightExercise = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null, measurementType: 'WEIGHT_REPS' },
    });
    const durationExercise = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null, measurementType: 'DURATION' },
    });

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Prog targets', goal: 'HYPERTROPHY' })
      .expect(201);
    programId = program.body.data.id as string;

    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Force' })
      .expect(201);
    const templateId = tpl.body.data.workoutTemplates[0].id as string;

    const ex = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: weightExercise.id,
        equipmentTypeId: weightExercise.defaultEquipmentTypeId,
        restSecondsOverride: 120,
        notes: null,
      })
      .expect(201);
    const teId = ex.body.data.workoutTemplates[0].exercises[0].id as string;

    for (let index = 0; index < 2; index += 1) {
      await request(app.getHttpServer())
        .post(
          `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${teId}/sets`,
        )
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          setType: 'WORKING',
          targetRepMin: 5,
          targetRepMax: 5,
          targetDurationSeconds: null,
          targetDistanceMeters: null,
          targetWeightKg: 60,
          targetIntensityPercent: null,
          targetRir: null,
          targetRpe: null,
          restSeconds: 120,
        })
        .expect(201);
    }

    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ sourceWorkoutTemplateId: templateId, localDate: today, timezone: 'UTC' })
      .expect(201);
    sessionId = created.body.data.id as string;
    weightExerciseId = created.body.data.exercises[0].id as string;

    const added = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ exerciseId: durationExercise.id, expectedVersion: created.body.data.version })
      .expect(201);
    durationExerciseId = (added.body.data.exercises as ExerciseRow[]).find(
      (exercise) => exercise.sourceExerciseId === durationExercise.id,
    )!.id;
    version = added.body.data.version as number;
  });

  afterAll(async () => {
    await app.close();
  });

  const firstSet = async () =>
    (await getDetail()).exercises.find((e) => e.id === weightExerciseId)!.sets[0]!;

  it('requires authentication', async () => {
    const set = await firstSet();
    await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .send({ expectedVersion: version, targetWeightKg: 62.5 })
      .expect(401);
  });

  it('hides another user’s session', async () => {
    const set = await firstSet();
    const response = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ expectedVersion: version, targetWeightKg: 62.5 })
      .expect(404);
    expect(response.body.error.code).toBe('WORKOUT_NOT_FOUND');
  });

  it('rejects an empty patch, an unknown key and an inverted rep range', async () => {
    const set = await firstSet();
    for (const body of [
      { expectedVersion: version },
      { expectedVersion: version, actualReps: 5 },
      { expectedVersion: version, targetRepMin: 8, targetRepMax: 6 },
    ]) {
      await request(app.getHttpServer())
        .patch(targetsUrl(weightExerciseId, set.id))
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);
    }
  });

  it('rejects a stale version', async () => {
    const set = await firstSet();
    const response = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version - 1, targetWeightKg: 62.5 })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_VERSION_CONFLICT');
  });

  it('rejects a weight target on a DURATION exercise', async () => {
    const detail = await getDetail();
    const durationSet = detail.exercises.find((e) => e.id === durationExerciseId)!.sets[0]!;
    const response = await request(app.getHttpServer())
      .patch(targetsUrl(durationExerciseId, durationSet.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, targetWeightKg: 10 })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_SET_TARGET_NOT_APPLICABLE');
  });

  it('updates only the provided targets, then replays idempotently', async () => {
    const set = await firstSet();
    const body = {
      expectedVersion: version,
      clientCommandId: `targets-${stamp}`,
      targetWeightKg: 62.5,
      targetRestSeconds: 150,
    };
    const response = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body)
      .expect(200);
    expect(response.body.data.workoutSessionVersion).toBe(version + 1);
    expect(response.body.data.workoutSet).toMatchObject({
      id: set.id,
      targetWeightKg: 62.5,
      targetRepMin: 5,
      targetRepMax: 5,
      targetRestSeconds: 150,
      status: 'PENDING',
    });
    version += 1;

    const replay = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body)
      .expect(200);
    expect(replay.body.data.workoutSessionVersion).toBe(version);
    expect((await getDetail()).version).toBe(version);

    const conflict = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...body, targetWeightKg: 65 })
      .expect(409);
    expect(conflict.body.error.code).toBe('WORKOUT_SET_COMMAND_CONFLICT');
  });

  it('clears and sets a rep range and leaves the program template untouched', async () => {
    const set = await firstSet();
    const response = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, targetRepMin: 6, targetRepMax: 8 })
      .expect(200);
    expect(response.body.data.workoutSet).toMatchObject({ targetRepMin: 6, targetRepMax: 8 });
    version = response.body.data.workoutSessionVersion as number;

    const prisma = app.get(PrismaService);
    const templateSets = await prisma.workoutTemplateSet.findMany({
      where: { workoutTemplateExercise: { workoutTemplate: { programId } } },
    });
    expect(templateSets).toHaveLength(2);
    for (const templateSet of templateSets) {
      expect(Number(templateSet.targetWeightKg)).toBe(60);
      expect(templateSet.targetRepMin).toBe(5);
      expect(templateSet.targetRepMax).toBe(5);
      expect(templateSet.restSeconds).toBe(120);
    }
  });

  it('refuses a set that is no longer PENDING', async () => {
    const set = await firstSet();
    const done = await request(app.getHttpServer())
      .patch(`/api/v1/workouts/${sessionId}/exercises/${weightExerciseId}/sets/${set.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: version,
        status: 'COMPLETED',
        actualWeightKg: 62.5,
        actualReps: 7,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
      })
      .expect(200);
    version = done.body.data.workoutSessionVersion as number;

    const response = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, targetWeightKg: 70 })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_SET_NOT_PENDING');
  });

  it('refuses edits once the session is paused', async () => {
    const paused = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version })
      .expect(200);
    version = paused.body.data.workoutSessionVersion as number;
    const set = (await getDetail()).exercises.find((e) => e.id === weightExerciseId)!.sets[1]!;
    const response = await request(app.getHttpServer())
      .patch(targetsUrl(weightExerciseId, set.id))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, targetWeightKg: 70 })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_NOT_EDITABLE');
  });
});
