import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AI_COACH_PROVIDER } from '../src/modules/coaching/ai/ai-coach-provider';
import { FakeAiCoachProvider } from '../src/modules/coaching/ai/fake-ai-coach.provider';
import { AiCoachToolRegistry } from '../src/modules/coaching/ai/ai-coach-tool-registry';
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

describe('search_exercises tool (Coach catalogue)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tools: AiCoachToolRegistry;
  let fakeProvider: FakeAiCoachProvider;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;
  let personalExerciseId: string;

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
    tools = app.get(AiCoachToolRegistry);
    fakeProvider = app.get(AI_COACH_PROVIDER) as FakeAiCoachProvider;

    const suffix = Date.now();
    tokenA = await registerUser(app, `search-a-${suffix}@test.local`, 'User A');
    tokenB = await registerUser(app, `search-b-${suffix}@test.local`, 'User B');
    const meA = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const meB = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    userAId = meA.body.data.id as string;
    userBId = meB.body.data.id as string;

    const eq = await prisma.equipmentType.findFirstOrThrow({
      where: { isActive: true, code: 'bodyweight' },
    });
    const mg = await prisma.muscleGroup.findFirstOrThrow({
      where: { isActive: true, code: 'back' },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Perso Tractions ${suffix}`,
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
    personalExerciseId = created.body.data.id as string;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('filtre muscle Dos → exercices + id non vide', async () => {
    const result = await tools.execute(
      'search_exercises',
      { muscleGroup: 'Dos', limit: 12 },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as {
      count: number;
      exercises: Array<{ id: string; name: string; muscle: string }>;
    };
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.exercises.every((item) => Boolean(item.id))).toBe(true);
    expect(payload.exercises.every((item) => item.muscle === 'Dos')).toBe(true);
    expect(payload.exercises[0]).not.toHaveProperty('exerciseId');
  });

  it('filtre code back équivalent à Dos', async () => {
    const byLabel = await tools.execute(
      'search_exercises',
      { muscleGroup: 'Dos' },
      { ownerUserId: userAId },
    );
    const byCode = await tools.execute(
      'search_exercises',
      { muscleGroup: 'back' },
      { ownerUserId: userAId },
    );
    expect((byLabel.llmPayload as { count: number }).count).toBe(
      (byCode.llmPayload as { count: number }).count,
    );
  });

  it('query par nom → résultats + ids', async () => {
    const result = await tools.execute(
      'search_exercises',
      { query: 'traction' },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as {
      count: number;
      exercises: Array<{ id: string; name: string }>;
    };
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.exercises.every((item) => item.id.length > 0)).toBe(true);
  });

  it('filtre équipement Haltères', async () => {
    const result = await tools.execute(
      'search_exercises',
      { equipmentType: 'Haltères', limit: 15 },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as {
      count: number;
      exercises: Array<{ id: string; equipment: string | null }>;
    };
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.exercises.every((item) => Boolean(item.id))).toBe(true);
  });

  it('muscle + équipement : intersection', async () => {
    const result = await tools.execute(
      'search_exercises',
      { muscleGroup: 'Dos', equipmentType: 'Poids du corps', limit: 20 },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as {
      count: number;
      exercises: Array<{ id: string; muscle: string }>;
    };
    expect(payload.exercises.every((item) => item.muscle === 'Dos')).toBe(true);
    expect(payload.exercises.every((item) => Boolean(item.id))).toBe(true);
  });

  it('aucun résultat pour label inconnu', async () => {
    const result = await tools.execute(
      'search_exercises',
      { muscleGroup: 'GroupeInexistantXYZ' },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as {
      count: number;
      exercises: unknown[];
      unresolved?: { muscleGroup?: string };
    };
    expect(payload.count).toBe(0);
    expect(payload.exercises).toEqual([]);
    expect(payload.unresolved?.muscleGroup).toBe('GroupeInexistantXYZ');
  });

  it('muscleGroup bras → biceps + triceps', async () => {
    const result = await tools.execute(
      'search_exercises',
      { muscleGroup: 'bras', limit: 12 },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as {
      count: number;
      exercises: Array<{ id: string; muscle: string; measurementType: string }>;
    };
    expect(payload.count).toBeGreaterThan(0);
    const muscles = payload.exercises.map((item) => item.muscle.toLowerCase());
    expect(muscles.some((m) => m.includes('biceps'))).toBe(true);
    expect(muscles.some((m) => m.includes('triceps'))).toBe(true);
    expect(
      payload.exercises.every((item) => Boolean(item.id) && Boolean(item.measurementType)),
    ).toBe(true);
    expect(result.outputSummary.muscleGroupIds).toEqual(
      expect.arrayContaining([expect.any(String), expect.any(String)]),
    );
  });

  it('respecte limit', async () => {
    const result = await tools.execute(
      'search_exercises',
      { muscleGroup: 'Dos', limit: 2 },
      { ownerUserId: userAId },
    );
    const payload = result.llmPayload as { count: number; exercises: unknown[] };
    expect(payload.count).toBeLessThanOrEqual(2);
    expect(payload.exercises).toHaveLength(payload.count);
  });

  it('exercice personnel : visible owner uniquement', async () => {
    const forOwner = await tools.execute(
      'search_exercises',
      { query: 'Perso Tractions' },
      { ownerUserId: userAId },
    );
    const ownerIds = (
      forOwner.llmPayload as { exercises: Array<{ id: string }> }
    ).exercises.map((item) => item.id);
    expect(ownerIds).toContain(personalExerciseId);

    const forOther = await tools.execute(
      'search_exercises',
      { query: 'Perso Tractions' },
      { ownerUserId: userBId },
    );
    const otherIds = (
      forOther.llmPayload as { exercises: Array<{ id: string }> }
    ).exercises.map((item) => item.id);
    expect(otherIds).not.toContain(personalExerciseId);
  });

  it('search:"dos" (texte) ≠ muscleGroup Dos (relation)', async () => {
    const byText = await tools.execute(
      'search_exercises',
      { search: 'dos' },
      { ownerUserId: userAId },
    );
    const byMuscle = await tools.execute(
      'search_exercises',
      { muscleGroup: 'Dos' },
      { ownerUserId: userAId },
    );
    // Le bug historique : search name "dos" rate les tractions/rowing.
    expect((byMuscle.llmPayload as { count: number }).count).toBeGreaterThan(
      (byText.llmPayload as { count: number }).count,
    );
  });

  it('flow séance dos : tool IDs → proposal valide', async () => {
    const search = await tools.execute(
      'search_exercises',
      { muscleGroup: 'Dos', limit: 8 },
      { ownerUserId: userAId },
    );
    const found = (
      search.llmPayload as { exercises: Array<{ id: string; name: string }> }
    ).exercises;
    expect(found.length).toBeGreaterThanOrEqual(2);
    const picked = found.slice(0, 2);

    fakeProvider.resetChat();
    fakeProvider.chatBehavior = {
      mode: 'tools_then_answer',
      toolCalls: [{ name: 'search_exercises', arguments: { muscleGroup: 'Dos' } }],
      answer: {
        type: 'proposal',
        text: 'Séance dos 45 min.',
        data: {
          kind: 'workout',
          workout: {
            name: 'Dos 45 min',
            estimatedDurationMinutes: 45,
            exercises: picked.map((item) => ({
              exerciseId: item.id,
              equipmentTypeId: null,
              notes: null,
              sets: [
                {
                  setType: 'WORKING' as const,
                  targetRepMin: 8,
                  targetRepMax: 12,
                  targetDurationSeconds: null,
                  targetDistanceMeters: null,
                  targetWeightKg: null,
                  targetIntensityPercent: null,
                  targetRir: 2,
                  targetRpe: null,
                  restSeconds: 90,
                },
              ],
            })),
          },
          program: null,
        },
        references: [],
        suggestedFollowUps: [],
      },
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/coaching/conversations/${created.body.data.id}/messages`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Propose-moi une séance dos de 45 minutes',
        clientCommandId: randomUUID(),
      })
      .expect(201);

    expect(response.body.data.assistantMessage.proposal).toBeTruthy();
    expect(response.body.data.assistantMessage.proposal.kind).toBe('WORKOUT');
    expect(response.body.data.assistantMessage.content).not.toMatch(
      /aucun identifiant/i,
    );
  });
});
