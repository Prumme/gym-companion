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
};

async function createTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
): Promise<Startable> {
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
      name: `Coach Ex ${name}`,
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
  const exerciseId = created.body.data.id as string;

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
      equipmentTypeId: eq.id,
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
        targetWeightKg: 80,
        targetIntensityPercent: null,
        targetRir: 2,
        targetRpe: null,
        restSeconds: 120,
      })
      .expect(201);
  }

  return { programId, templateId, templateExerciseId, exerciseId };
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
  const created = await request(app.getHttpServer())
    .post('/api/v1/workouts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      sourceWorkoutTemplateId: templateId,
      localDate,
      timezone: 'Europe/Paris',
    })
    .expect(201);
  const session = created.body.data as {
    id: string;
    version: number;
    exercises: Array<{
      id: string;
      sets: Array<{ id: string; setType: string }>;
    }>;
  };
  const indexes = (session.exercises[0]?.sets ?? [])
    .map((set, index) => (set.setType === 'WORKING' ? index : -1))
    .filter((index) => index >= 0);
  for (let i = 0; i < indexes.length; i += 1) {
    const setIndex = indexes[i]!;
    const set = session.exercises[0]!.sets[setIndex]!;
    const response = await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${session.id}/exercises/${session.exercises[0]!.id}/sets/${set.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: weightKg,
        actualReps: reps[i] ?? 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: session.version,
        clientCommandId: `${prefix}-set-${i}`,
      })
      .expect(200);
    session.version = response.body.data.workoutSessionVersion as number;
  }
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${session.id}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion: session.version,
      notes: null,
      clientCommandId: `${prefix}-complete`,
    })
    .expect(200);
}

describe('Coach summary API (5.4)', () => {
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
    tokenA = await registerUser(app, `coach-a-${stamp}@example.com`, 'Coach A');
    tokenB = await registerUser(app, `coach-b-${stamp}@example.com`, 'Coach B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('auth + isolation + NO_DATA', async () => {
    const tpl = await createTemplate(app, tokenA, prisma, `empty-${stamp}`);
    const unauth = await request(app.getHttpServer()).get(
      `/api/v1/coaching/exercises/${tpl.exerciseId}/summary`,
    );
    expect(unauth.status).toBe(401);

    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${tpl.exerciseId}/summary`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(foreign.status).toBe(404);

    const empty = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${tpl.exerciseId}/summary`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(empty.body.data.status).toBe('NO_DATA');
    expect(empty.body.data.headline.title).toMatch(/données/i);
  });

  it('WATCH / PLATEAU / PROGRESSING et overview', async () => {
    const tpl = await createTemplate(app, tokenA, prisma, `flow-${stamp}`);
    for (let day = 1; day <= 3; day += 1) {
      await completeWorking(
        app,
        tokenA,
        tpl.templateId,
        `2026-08-0${day}`,
        [9, 9, 9],
        80,
        `coach-w-${day}-${stamp}`,
      );
    }
    let summary = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${tpl.exerciseId}/summary`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(summary.body.data.status).toBe('WATCH');
    expect(summary.body.data.plateau?.status).toBe('WATCH');
    expect(summary.body.data.loadRecommendation).not.toBeNull();
    expect(summary.body.data).not.toHaveProperty('ownerUserId');

    await completeWorking(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-04',
      [9, 9, 9],
      80,
      `coach-w-4-${stamp}`,
    );
    summary = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${tpl.exerciseId}/summary`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(summary.body.data.status).toBe('PLATEAU');

    const overview = await request(app.getHttpServer())
      .get('/api/v1/coaching/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      overview.body.data.items.some(
        (item: { exerciseId: string; status: string }) =>
          item.exerciseId === tpl.exerciseId && item.status === 'PLATEAU',
      ),
    ).toBe(true);

    await completeWorking(
      app,
      tokenA,
      tpl.templateId,
      '2026-08-05',
      [8, 8, 8],
      82.5,
      `coach-w-5-${stamp}`,
    );
    summary = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${tpl.exerciseId}/summary`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(['PROGRESSING', 'STABLE', 'NONE', 'WATCH']).toContain(
      // status should not stay PLATEAU after load progress
      summary.body.data.status,
    );
    expect(summary.body.data.status).not.toBe('PLATEAU');
  });

  it('non-WEIGHT_REPS : pas de plateau inventé', async () => {
    const exercise = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'DURATION',
      },
    });
    const summary = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${exercise.id}/summary`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(summary.body.data.plateau).toBeNull();
    expect(summary.body.data.loadRecommendation).toBeNull();
    expect(summary.body.data.strength).toBeNull();
    expect(summary.body.data.status).not.toBe('REVIEW');
  });
});
