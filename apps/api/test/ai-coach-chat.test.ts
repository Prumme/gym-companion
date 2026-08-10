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
import { AI_COACH_READ_ONLY_TOOL_NAMES } from '@gym-companion/validation';

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

describe('Coach chat API (5.6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeProvider: FakeAiCoachProvider;
  let tools: AiCoachToolRegistry;
  let tokenA: string;
  let tokenB: string;
  let exerciseA: string;

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
    tools = app.get(AiCoachToolRegistry);

    const suffix = Date.now();
    tokenA = await registerUser(app, `chat-a-${suffix}@test.local`, 'User A');
    tokenB = await registerUser(app, `chat-b-${suffix}@test.local`, 'User B');

    const eq = await prisma.equipmentType.findFirstOrThrow({
      where: { isActive: true },
    });
    const mg = await prisma.muscleGroup.findFirstOrThrow({
      where: { isActive: true },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Chat Bench ${suffix}`,
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
    exerciseA = created.body.data.id as string;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('registre d’outils = lecture seule', () => {
    expect(tools.listToolNames()).toEqual([...AI_COACH_READ_ONLY_TOOL_NAMES]);
    expect(
      tools.listToolNames().every((name) => name.startsWith('get_')),
    ).toBe(true);
  });

  it('crée, liste, isole les conversations', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ exerciseId: exerciseA })
      .expect(201);
    expect(created.body.data.contextExercise.id).toBe(exerciseA);

    await request(app.getHttpServer())
      .post('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ exerciseId: exerciseA })
      .expect(404);

    const list = await request(app.getHttpServer())
      .get('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(list.body.data.some((item: { id: string }) => item.id === created.body.data.id)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .get(`/api/v1/coaching/conversations/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('envoie un message avec tool call et refuse IDOR tool', async () => {
    fakeProvider.resetChat();
    fakeProvider.chatBehavior = {
      mode: 'tools_then_answer',
      toolCalls: [
        {
          name: 'get_personal_records',
          arguments: { exerciseId: exerciseA },
        },
      ],
      answer: {
        message: 'Voici tes records disponibles pour cet exercice.',
        references: [
          {
            type: 'EXERCISE',
            exerciseId: exerciseA,
            label: 'Chat Bench',
          },
        ],
        suggestedFollowUps: ['Voir ma progression'],
      },
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);

    const commandId = randomUUID();
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/coaching/conversations/${created.body.data.id}/messages`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Quel est mon record ?',
        clientCommandId: commandId,
      })
      .expect(201);

    expect(response.body.data.userMessage.content).toBe('Quel est mon record ?');
    expect(response.body.data.assistantMessage.content).toContain('records');
    expect(fakeProvider.chatCallCount).toBeGreaterThanOrEqual(2);

    // Idempotence
    const again = await request(app.getHttpServer())
      .post(
        `/api/v1/coaching/conversations/${created.body.data.id}/messages`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Quel est mon record ?',
        clientCommandId: commandId,
      })
      .expect(201);
    expect(again.body.data.userMessage.id).toBe(
      response.body.data.userMessage.id,
    );

    // Conflit
    await request(app.getHttpServer())
      .post(
        `/api/v1/coaching/conversations/${created.body.data.id}/messages`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Autre contenu',
        clientCommandId: commandId,
      })
      .expect(409);

    // Tool IDOR : exercice de A demandé avec le userId de B
    const meB = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const foreign = await tools.execute(
      'get_exercise_coach_summary',
      { exerciseId: exerciseA, ownerUserId: 'hack' },
      { ownerUserId: meB.body.data.id },
    );
    expect(foreign.llmPayload).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('archive une conversation', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/coaching/conversations/${created.body.data.id}/archive`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);
  });
});
