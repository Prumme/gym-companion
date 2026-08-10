import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AI_COACH_PROVIDER } from '../src/modules/coaching/ai/ai-coach-provider';
import { FakeAiCoachProvider } from '../src/modules/coaching/ai/fake-ai-coach.provider';
import { AiCoachExplanationService } from '../src/modules/coaching/ai/ai-coach-explanation.service';
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
  process.env.AI_COACH_ENABLED = 'true';
  process.env.AI_COACH_PROVIDER = 'fake';
  process.env.AI_COACH_RATE_LIMIT_PER_MINUTE = '100';
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
      name: `AI Coach Ex ${name}`,
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
    .send({ name: `AI Prog ${name}`, goal: 'STRENGTH' })
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

async function completeWorkout(
  app: INestApplication,
  token: string,
  templateId: string,
  localDate: string,
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
        actualReps: 10,
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

describe('Coach AI explanation API (5.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeProvider: FakeAiCoachProvider;
  let aiService: AiCoachExplanationService;
  let tokenA: string;
  let tokenB: string;
  let tpl: Startable;

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

    fakeProvider = app.get(AI_COACH_PROVIDER) as FakeAiCoachProvider;
    aiService = app.get(AiCoachExplanationService);

    const suffix = Date.now();
    tokenA = await registerUser(app, `ai-a-${suffix}@test.local`, 'User A');
    tokenB = await registerUser(app, `ai-b-${suffix}@test.local`, 'User B');
    tpl = await createTemplate(app, tokenA, prisma, `${suffix}`);

    await completeWorkout(app, tokenA, tpl.templateId, '2026-08-01', 80, 'w1');
    await completeWorkout(app, tokenA, tpl.templateId, '2026-08-02', 80, 'w2');
    await completeWorkout(app, tokenA, tpl.templateId, '2026-08-03', 80, 'w3');
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('expose ai.available via /me', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(me.body.data.ai.available).toBe(true);
  });

  it('exige l’auth', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .send({ focus: 'GENERAL' })
      .expect(401);
  });

  it('retourne 404 pour un exercice étranger', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ focus: 'GENERAL' })
      .expect(404);
  });

  it('génère une explication GENERAL sans secrets', async () => {
    fakeProvider.behavior = { mode: 'success' };
    fakeProvider.callCount = 0;
    const response = await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ focus: 'GENERAL' })
      .expect(201);

    expect(response.body.data.explanation.title).toBeTruthy();
    expect(response.body.data.meta.schemaVersion).toBe(
      'AI_COACH_EXPLANATION_V1',
    );
    expect(response.body.data.meta.promptVersion).toBe('AI_COACH_PROMPT_V1');
    expect(response.body.data.meta.focus).toBe('GENERAL');
    expect(response.body.data.meta.coachSummaryFingerprint).toMatch(/^[a-f0-9]+$/);
    expect(JSON.stringify(response.body)).not.toContain('AI_COACH_API_KEY');
    expect(fakeProvider.lastInput).not.toBeNull();
    expect(JSON.stringify(fakeProvider.lastInput)).not.toContain('ownerUserId');
    expect(JSON.stringify(fakeProvider.lastInput)).not.toContain('@test.local');
  });

  it('focus LOAD / PROGRESS / PLATEAU', async () => {
    fakeProvider.behavior = { mode: 'success' };
    for (const focus of ['LOAD', 'PROGRESS', 'PLATEAU'] as const) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ focus })
        .expect(201);
      expect(response.body.data.meta.focus).toBe(focus);
    }
    expect(fakeProvider.lastInput?.focus).toBe('PLATEAU');
  });

  it('mappe timeout / invalid / unavailable', async () => {
    aiService.getRateLimiterForTests().reset();
    fakeProvider.behavior = { mode: 'timeout' };
    let res = await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ focus: 'GENERAL' });
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_COACH_TIMEOUT');

    fakeProvider.behavior = { mode: 'invalid' };
    res = await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ focus: 'GENERAL' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_COACH_INVALID_RESPONSE');

    fakeProvider.behavior = { mode: 'unavailable' };
    res = await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ focus: 'GENERAL' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_COACH_UNAVAILABLE');
  });

  it('applique un rate limit par utilisateur', async () => {
    fakeProvider.behavior = { mode: 'success' };
    const limiter = aiService.getRateLimiterForTests();
    limiter.setLimitForTests(3);

    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ focus: 'GENERAL' })
        .expect(201);
    }

    const limited = await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tpl.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ focus: 'GENERAL' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('AI_COACH_RATE_LIMITED');

    // Autre utilisateur indépendant
    const tplB = await createTemplate(app, tokenB, prisma, `b-${Date.now()}`);
    await completeWorkout(app, tokenB, tplB.templateId, '2026-08-01', 60, 'b1');
    await request(app.getHttpServer())
      .post(`/api/v1/coaching/exercises/${tplB.exerciseId}/explanation`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ focus: 'GENERAL' })
      .expect(201);

    limiter.setLimitForTests(100);
  });

  it('summary expose coachSummaryFingerprint', async () => {
    const summary = await request(app.getHttpServer())
      .get(`/api/v1/coaching/exercises/${tpl.exerciseId}/summary`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(summary.body.data.coachSummaryFingerprint).toMatch(/^[a-f0-9]+$/);
  });
});

describe('Coach AI disabled', () => {
  it('retourne AI_COACH_DISABLED lorsque désactivé', async () => {
    process.env.AI_COACH_ENABLED = 'false';
    process.env.AI_COACH_PROVIDER = 'none';
    // Reconstruire l’app avec la nouvelle config
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const disabledApp = moduleRef.createNestApplication();
    const config = disabledApp.get(AppConfigService);
    disabledApp.use(cookieParser(config.cookieSecret));
    disabledApp.useGlobalFilters(new GlobalExceptionFilter(config));
    await disabledApp.init();
    const prisma = disabledApp.get(PrismaService);
    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);

    const token = await registerUser(
      disabledApp,
      `ai-off-${Date.now()}@test.local`,
      'Off',
    );
    const me = await request(disabledApp.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.data.ai.available).toBe(false);

    const eq = await prisma.equipmentType.findFirstOrThrow({
      where: { isActive: true },
    });
    const mg = await prisma.muscleGroup.findFirstOrThrow({
      where: { isActive: true },
    });
    const created = await request(disabledApp.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Off Ex',
        measurementType: 'DURATION',
        primaryMuscleGroupId: mg.id,
        secondaryMuscleGroupIds: [],
        defaultEquipmentTypeId: eq.id,
        compatibleEquipmentTypes: [
          { equipmentTypeId: eq.id, isPreferred: true, notes: null },
        ],
        defaultRestSeconds: 60,
        instructions: null,
      })
      .expect(201);

    const res = await request(disabledApp.getHttpServer())
      .post(`/api/v1/coaching/exercises/${created.body.data.id}/explanation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ focus: 'GENERAL' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_COACH_DISABLED');

    await disabledApp.close();
    // Restaurer pour d’éventuels tests suivants
    process.env.AI_COACH_ENABLED = 'true';
    process.env.AI_COACH_PROVIDER = 'fake';
  }, 60_000);
});
