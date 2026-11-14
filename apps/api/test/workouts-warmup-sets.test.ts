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
};

type ExerciseRow = { id: string; sourceExerciseId: string | null; sets: SetRow[] };

describe('Workout warmup sets API (docs/04 §5.6)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let sessionId = '';
  let weightExerciseId = '';
  let weightSourceExerciseId = '';
  let durationExerciseId = '';
  let version = 0;
  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const warmupUrl = (exerciseId: string) =>
    `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/warmup`;

  const ramp = [
    { targetWeightKg: 20, targetReps: 10 },
    { targetWeightKg: 40, targetReps: 5 },
  ];

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

    tokenA = await registerUser(app, `warmup-a-${stamp}@example.com`, 'Warmup A');
    tokenB = await registerUser(app, `warmup-b-${stamp}@example.com`, 'Warmup B');

    const weightExercise = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null, measurementType: 'WEIGHT_REPS' },
    });
    const durationExercise = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null, measurementType: 'DURATION' },
    });
    weightSourceExerciseId = weightExercise.id;

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Prog warmup', goal: 'HYPERTROPHY' })
      .expect(201);
    const programId = program.body.data.id as string;

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

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .send({ expectedVersion: version, clientCommandId: `wu-noauth-${stamp}`, sets: ramp })
      .expect(401);
  });

  it('hides another user’s session', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ expectedVersion: version, clientCommandId: `wu-foreign-${stamp}`, sets: ramp })
      .expect(404);
    expect(response.body.error.code).toBe('WORKOUT_NOT_FOUND');
  });

  it('rejects a body without clientCommandId or with a client setType', async () => {
    await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, sets: ramp })
      .expect(400);
    await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: version,
        clientCommandId: `wu-settype-${stamp}`,
        sets: [{ targetWeightKg: 20, targetReps: 10, setType: 'WORKING' }],
      })
      .expect(400);
  });

  it('rejects a stale expectedVersion', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version - 1, clientCommandId: `wu-stale-${stamp}`, sets: ramp })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_VERSION_CONFLICT');
  });

  it('refuses a non WEIGHT_REPS exercise', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(durationExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, clientCommandId: `wu-duration-${stamp}`, sets: ramp })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_WARMUP_NOT_SUPPORTED');
  });

  it('inserts WARMUP sets with targets before WORKING sets and bumps version once', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, clientCommandId: `wu-main-${stamp}`, sets: ramp })
      .expect(201);

    expect(response.body.data.version).toBe(version + 1);
    version = response.body.data.version as number;
    const exercise = (response.body.data.exercises as ExerciseRow[]).find(
      (row) => row.id === weightExerciseId,
    )!;
    expect(
      exercise.sets.map((set) => [set.position, set.setType, set.targetWeightKg, set.targetRepMin]),
    ).toEqual([
      [0, 'WARMUP', 20, 10],
      [1, 'WARMUP', 40, 5],
      [2, 'WORKING', 60, 5],
      [3, 'WORKING', 60, 5],
    ]);
    expect(exercise.sets.slice(0, 2).every((set) => set.status === 'PENDING')).toBe(true);
    expect(exercise.sets[0]!.targetRepMax).toBe(10);
  });

  it('replays the same command without duplicating sets, even with a stale version', async () => {
    const replay = await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version - 1, clientCommandId: `wu-main-${stamp}`, sets: ramp })
      .expect(201);
    expect(replay.body.data.version).toBe(version);
    const detail = await getDetail();
    expect(detail.exercises.find((row) => row.id === weightExerciseId)!.sets).toHaveLength(4);
  });

  it('refuses a command id reused on another exercise', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(durationExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, clientCommandId: `wu-main-${stamp}`, sets: ramp })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_SET_COMMAND_CONFLICT');
  });

  it('places a second ramp after the existing WARMUP sets', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: version,
        clientCommandId: `wu-second-${stamp}`,
        sets: [{ targetWeightKg: 50, targetReps: 1 }],
      })
      .expect(201);
    version = response.body.data.version as number;
    const exercise = (response.body.data.exercises as ExerciseRow[]).find(
      (row) => row.id === weightExerciseId,
    )!;
    expect(exercise.sets.map((set) => `${set.setType}:${set.targetWeightKg}`)).toEqual([
      'WARMUP:20',
      'WARMUP:40',
      'WARMUP:50',
      'WORKING:60',
      'WORKING:60',
    ]);
  });

  it('keeps WARMUP sets out of records and working volume', async () => {
    const detail = await getDetail();
    const exercise = detail.exercises.find((row) => row.id === weightExerciseId)!;
    const heavyWarmup = exercise.sets[0]!;
    const working = exercise.sets[3]!;

    for (const [index, entry] of [
      { set: heavyWarmup, weight: 150, reps: 2 },
      { set: working, weight: 60, reps: 5 },
    ].entries()) {
      const patched = await request(app.getHttpServer())
        .patch(`/api/v1/workouts/${sessionId}/exercises/${weightExerciseId}/sets/${entry.set.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'COMPLETED',
          actualWeightKg: entry.weight,
          actualReps: entry.reps,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: null,
          actualRpe: null,
          reachedFailure: false,
          notes: null,
          expectedVersion: version,
          clientCommandId: `wu-record-${stamp}-${index}`,
        })
        .expect(200);
      version = patched.body.data.workoutSessionVersion as number;
    }

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version, clientCommandId: `wu-complete-${stamp}` })
      .expect(200);
    const metrics = completed.body.data.workoutSession.metrics;
    expect(metrics.performance.workingExternalVolumeKg).toBe(300);
    expect(metrics.performance.totalExternalVolumeKg).toBe(600);

    const records = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${weightSourceExerciseId}/personal-records`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const maxWeight = (records.body.data as Array<{ recordType: string; value: number }>).find(
      (record) => record.recordType === 'MAX_WEIGHT',
    );
    expect(maxWeight?.value).toBe(60);
  });

  it('refuses warmup sets once the session is completed', async () => {
    const response = await request(app.getHttpServer())
      .post(warmupUrl(weightExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: version + 1, clientCommandId: `wu-after-${stamp}`, sets: ramp })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_NOT_EDITABLE');
  });
});
