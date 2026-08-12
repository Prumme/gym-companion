import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
import type {
  CoachProgramProposal,
  CoachWorkoutProposal,
} from '@gym-companion/validation';

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

describe('Coach IA — propositions structurées (jalon 8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeProvider: FakeAiCoachProvider;
  let tools: AiCoachToolRegistry;
  let token: string;
  let userId: string;
  let exerciseId: string;
  let equipmentTypeId: string;

  const workoutProposalData = (): {
    kind: 'workout';
    workout: CoachWorkoutProposal;
    program: null;
  } => ({
    kind: 'workout',
    workout: {
      name: 'Push A',
      estimatedDurationMinutes: 45,
      exercises: [
        {
          exerciseId,
          equipmentTypeId: equipmentTypeId as string | null,
          notes: null,
          sets: [
            {
              setType: 'WORKING',
              targetRepMin: 6,
              targetRepMax: 10,
              targetDurationSeconds: null,
              targetDistanceMeters: null,
              targetWeightKg: 60,
              targetIntensityPercent: null,
              targetRir: 2,
              targetRpe: null,
              restSeconds: 90,
            },
          ],
        },
      ],
    },
    program: null,
  });

  const programProposalData = (): {
    kind: 'program';
    workout: null;
    program: CoachProgramProposal;
  } => ({
    kind: 'program',
    workout: null,
    program: {
      name: 'Programme Full Body',
      description: null,
      goal: 'HYPERTROPHY',
      workouts: [
        {
          name: 'Séance 1',
          estimatedDurationMinutes: 40,
          exercises: [
            {
              exerciseId,
              equipmentTypeId: null,
              notes: null,
              sets: [
                {
                  setType: 'WORKING',
                  targetRepMin: 8,
                  targetRepMax: 12,
                  targetDurationSeconds: null,
                  targetDistanceMeters: null,
                  targetWeightKg: 40,
                  targetIntensityPercent: null,
                  targetRir: null,
                  targetRpe: null,
                  restSeconds: 60,
                },
              ],
            },
          ],
        },
      ],
      schedule: [{ weekday: 'MONDAY', workoutIndex: 0, position: 0 }],
    },
  });

  async function sendProposalMessage(
    authToken: string,
    conversationId: string,
    data: ReturnType<typeof workoutProposalData> | ReturnType<typeof programProposalData>,
  ) {
    fakeProvider.resetChat();
    fakeProvider.chatBehavior = {
      mode: 'answer',
      answer: {
        type: 'proposal',
        text: 'Voici une proposition adaptée.',
        data,
        references: [],
        suggestedFollowUps: [],
      },
    };
    return request(app.getHttpServer())
      .post(`/api/v1/coaching/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Propose-moi une séance.', clientCommandId: randomUUID() })
      .expect(201);
  }

  async function createConversation(authToken: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/coaching/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({})
      .expect(201);
    return created.body.data.id as string;
  }

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
    token = await registerUser(app, `proposal-${suffix}@test.local`, 'Proposal User');
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `proposal-${suffix}@test.local` },
    });
    userId = user.id;

    const eq = await prisma.equipmentType.findFirstOrThrow({
      where: { isActive: true },
    });
    equipmentTypeId = eq.id;
    const mg = await prisma.muscleGroup.findFirstOrThrow({
      where: { isActive: true },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Proposal Bench ${suffix}`,
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
  }, 120_000);

  afterAll(async () => {
    fakeProvider?.releaseChatGate();
    await app?.close();
  });

  afterEach(() => {
    fakeProvider?.releaseChatGate();
    fakeProvider?.resetChat();
  });

  it('persiste une AiCoachProposal PENDING et l’inclut dans la réponse', async () => {
    const conversationId = await createConversation(token);
    const response = await sendProposalMessage(
      token,
      conversationId,
      workoutProposalData(),
    );

    const proposal = response.body.data.assistantMessage.proposal;
    expect(proposal).toBeTruthy();
    expect(proposal.kind).toBe('WORKOUT');
    expect(proposal.status).toBe('PENDING');
    expect(proposal.preview.kind).toBe('WORKOUT');
    expect(proposal.preview.workout.exercises[0].exerciseName).toContain(
      'Proposal Bench',
    );
    expect(response.body.data.assistantMessage.content).toBe(
      'Voici une proposition adaptée.',
    );

    const row = await prisma.aiCoachProposal.findUnique({
      where: { id: proposal.id },
    });
    expect(row?.status).toBe('PENDING');
    expect(row?.ownerUserId).toBeDefined();
  });

  it('refuse une proposal métier invalide (exercice inaccessible) sans persister', async () => {
    const conversationId = await createConversation(token);
    const badData = workoutProposalData();
    badData.workout.exercises[0]!.exerciseId = randomUUID();

    const response = await sendProposalMessage(token, conversationId, badData);
    expect(response.body.data.assistantMessage.proposal).toBeNull();
    expect(response.body.data.assistantMessage.content).toMatch(
      /compatible avec ton catalogue/i,
    );
    expect(
      await prisma.aiCoachProposal.count({ where: { conversationId } }),
    ).toBe(0);
  });

  it('sanitize WEIGHT_REPS : sec/m parasites → proposal persistée sans duration', async () => {
    const conversationId = await createConversation(token);
    const data = workoutProposalData();
    data.workout.exercises[0]!.sets[0] = {
      ...data.workout.exercises[0]!.sets[0]!,
      targetDurationSeconds: 60,
      targetDistanceMeters: 100,
      targetWeightKg: null,
      targetIntensityPercent: null,
    };

    const response = await sendProposalMessage(token, conversationId, data);
    const proposal = response.body.data.assistantMessage.proposal;
    expect(proposal).toBeTruthy();
    expect(proposal.status).toBe('PENDING');

    const row = await prisma.aiCoachProposal.findUnique({
      where: { id: proposal.id },
    });
    const payload = row?.payloadJson as {
      exercises: Array<{
        sets: Array<{
          targetDurationSeconds: number | null;
          targetDistanceMeters: number | null;
          targetRepMin: number | null;
        }>;
      }>;
    };
    expect(payload.exercises[0]!.sets[0]!.targetDurationSeconds).toBeNull();
    expect(payload.exercises[0]!.sets[0]!.targetDistanceMeters).toBeNull();
    expect(payload.exercises[0]!.sets[0]!.targetRepMin).toBe(6);
  });

  it('repair : WEIGHT_REPS sans reps → 1 repair puis proposal valide', async () => {
    const conversationId = await createConversation(token);
    const invalid = workoutProposalData();
    invalid.workout.exercises[0]!.sets[0] = {
      ...invalid.workout.exercises[0]!.sets[0]!,
      targetRepMin: null,
      targetRepMax: null,
      targetDurationSeconds: 45,
      targetWeightKg: null,
    };
    const repaired = workoutProposalData();
    repaired.workout.exercises[0]!.sets[0] = {
      ...repaired.workout.exercises[0]!.sets[0]!,
      targetWeightKg: null,
      targetIntensityPercent: null,
      targetRir: 2,
    };

    fakeProvider.chatBehavior = {
      mode: 'answer',
      answer: {
        type: 'proposal',
        text: 'Proposition initiale invalide.',
        data: invalid,
        references: [],
        suggestedFollowUps: [],
      },
    };
    fakeProvider.repairAnswer = {
      type: 'proposal',
      text: 'Proposition réparée.',
      data: repaired,
      references: [],
      suggestedFollowUps: [],
    };

    const response = await request(app.getHttpServer())
      .post(`/api/v1/coaching/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Crée une séance bras débutant',
        clientCommandId: randomUUID(),
      })
      .expect(201);

    expect(fakeProvider.chatCallCount).toBe(2);
    expect(fakeProvider.lastChatRequest?.repairFeedback).toBeTruthy();
    expect(response.body.data.assistantMessage.proposal).toBeTruthy();
    expect(response.body.data.assistantMessage.proposal.status).toBe('PENDING');
    expect(response.body.data.assistantMessage.content).toBe(
      'Proposition réparée.',
    );
  });

  it('repair échoue encore → discussion sans proposal (max 1 repair)', async () => {
    const conversationId = await createConversation(token);
    const stillInvalid = workoutProposalData();
    stillInvalid.workout.exercises[0]!.sets[0] = {
      ...stillInvalid.workout.exercises[0]!.sets[0]!,
      targetRepMin: null,
      targetRepMax: null,
      targetDurationSeconds: 30,
    };

    fakeProvider.chatBehavior = {
      mode: 'answer',
      answer: {
        type: 'proposal',
        text: 'Invalide 1',
        data: stillInvalid,
        references: [],
        suggestedFollowUps: [],
      },
    };
    fakeProvider.repairAnswer = {
      type: 'proposal',
      text: 'Invalide 2',
      data: stillInvalid,
      references: [],
      suggestedFollowUps: [],
    };

    const response = await request(app.getHttpServer())
      .post(`/api/v1/coaching/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Programme bras',
        clientCommandId: randomUUID(),
      })
      .expect(201);

    expect(fakeProvider.chatCallCount).toBe(2);
    expect(response.body.data.assistantMessage.proposal).toBeNull();
    expect(response.body.data.assistantMessage.content).toMatch(
      /compatible avec ton catalogue/i,
    );
    expect(
      await prisma.aiCoachProposal.count({ where: { conversationId } }),
    ).toBe(0);
  });

  it('programme bras débutant : IDs search + sets WEIGHT_REPS valides', async () => {
    const search = await tools.execute(
      'search_exercises',
      { muscleGroup: 'bras', limit: 8 },
      { ownerUserId: userId },
    );
    const found = (
      search.llmPayload as {
        exercises: Array<{
          id: string;
          muscle: string;
          measurementType: string;
        }>;
      }
    ).exercises;
    expect(found.length).toBeGreaterThanOrEqual(2);
    const muscles = new Set(found.map((item) => item.muscle.toLowerCase()));
    expect(
      [...muscles].some((m) => m.includes('biceps') || m.includes('triceps')),
    ).toBe(true);
    const picked = found
      .filter((item) => item.measurementType === 'WEIGHT_REPS')
      .slice(0, 2);
    expect(picked.length).toBeGreaterThanOrEqual(1);

    const conversationId = await createConversation(token);
    fakeProvider.chatBehavior = {
      mode: 'tools_then_answer',
      toolCalls: [
        { name: 'search_exercises', arguments: { muscleGroup: 'bras' } },
      ],
      answer: {
        type: 'proposal',
        text: 'Programme bras débutant.',
        data: {
          kind: 'program',
          workout: null,
          program: {
            name: 'Bras débutant',
            description: 'Programme bras salle',
            goal: 'HYPERTROPHY' as const,
            workouts: [
              {
                name: 'Séance bras',
                estimatedDurationMinutes: 40,
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
            ],
            schedule: null,
          },
        },
        references: [],
        suggestedFollowUps: [],
      },
    };

    const response = await request(app.getHttpServer())
      .post(`/api/v1/coaching/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content:
          'Je débute la salle de sport, je vais avoir accès aux machines. Crée-moi un programme pour les bras en salle de sport.',
        clientCommandId: randomUUID(),
      })
      .expect(201);

    const proposal = response.body.data.assistantMessage.proposal;
    expect(proposal).toBeTruthy();
    expect(proposal.kind).toBe('PROGRAM');
    expect(proposal.status).toBe('PENDING');
    expect(proposal.preview.program.workouts[0].exercises.length).toBe(
      picked.length,
    );
  });

  it('accepte une proposal WORKOUT (programId requis) et crée le WorkoutTemplate', async () => {
    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Programme cible', description: null, goal: 'HYPERTROPHY' })
      .expect(201);
    const programId = program.body.data.id as string;

    const conversationId = await createConversation(token);
    const sent = await sendProposalMessage(
      token,
      conversationId,
      workoutProposalData(),
    );
    const proposalId = sent.body.data.assistantMessage.proposal.id as string;

    const missingProgramId = await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(missingProgramId.body.error.code).toBe(
      'AI_COACH_PROPOSAL_PROGRAM_ID_REQUIRED',
    );

    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({ programId })
      .expect(201);
    expect(accepted.body.data.proposal.status).toBe('ACCEPTED');
    expect(accepted.body.data.proposal.createdWorkoutTemplateId).toBeTruthy();

    const templateId = accepted.body.data.proposal
      .createdWorkoutTemplateId as string;
    const template = await prisma.workoutTemplate.findUnique({
      where: { id: templateId },
      include: { exercises: { include: { sets: true } } },
    });
    expect(template?.programId).toBe(programId);
    expect(template?.exercises).toHaveLength(1);
    expect(template?.exercises[0]?.sets).toHaveLength(1);

    // Idempotence : ré-accepter renvoie le même résultat sans recréer.
    const acceptedAgain = await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({ programId })
      .expect(201);
    expect(acceptedAgain.body.data.proposal.createdWorkoutTemplateId).toBe(
      templateId,
    );
    expect(
      await prisma.workoutTemplate.count({ where: { programId } }),
    ).toBe(1);
  });

  it('accepte une proposal PROGRAM et crée Program + WorkoutTemplate + planning (DRAFT, non activé)', async () => {
    const conversationId = await createConversation(token);
    const sent = await sendProposalMessage(
      token,
      conversationId,
      programProposalData(),
    );
    const proposalId = sent.body.data.assistantMessage.proposal.id as string;

    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    const programId = accepted.body.data.proposal.createdProgramId as string;
    expect(programId).toBeTruthy();

    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        workoutTemplates: true,
        scheduleEntries: true,
      },
    });
    expect(program?.status).toBe('DRAFT');
    expect(program?.workoutTemplates).toHaveLength(1);
    expect(program?.scheduleEntries).toHaveLength(1);
    expect(program?.scheduleEntries[0]?.workoutTemplateId).toBe(
      program?.workoutTemplates[0]?.id,
    );
  });

  it('refuse (dismiss) une proposal PENDING puis interdit son acceptation', async () => {
    const conversationId = await createConversation(token);
    const sent = await sendProposalMessage(
      token,
      conversationId,
      workoutProposalData(),
    );
    const proposalId = sent.body.data.assistantMessage.proposal.id as string;

    const dismissed = await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/dismiss`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(dismissed.body.data.proposal.status).toBe('DISMISSED');

    await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({ programId: randomUUID() })
      .expect(409);
  });

  it('marque INVALID et renvoie 400 si un exercice devient obsolète avant acceptation', async () => {
    const staleExercise = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Stale Exercise ${Date.now()}`,
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupId: (
          await prisma.muscleGroup.findFirstOrThrow({ where: { isActive: true } })
        ).id,
        secondaryMuscleGroupIds: [],
        defaultEquipmentTypeId: null,
        compatibleEquipmentTypes: [],
        defaultRestSeconds: null,
        instructions: null,
      })
      .expect(201);
    const staleExerciseId = staleExercise.body.data.id as string;

    const conversationId = await createConversation(token);
    const data = workoutProposalData();
    data.workout.exercises[0]!.exerciseId = staleExerciseId;
    data.workout.exercises[0]!.equipmentTypeId = null;
    const sent = await sendProposalMessage(token, conversationId, data);
    const proposalId = sent.body.data.assistantMessage.proposal.id as string;

    // L’exercice devient obsolète (archivé) entre la proposal et l’acceptation.
    await prisma.exercise.update({
      where: { id: staleExerciseId },
      data: { archivedAt: new Date() },
    });

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Programme stale test', description: null, goal: 'HYPERTROPHY' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/coaching/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({ programId: program.body.data.id })
      .expect(400);
    expect(response.body.error.code).toBe('AI_COACH_PROPOSAL_STALE');

    const row = await prisma.aiCoachProposal.findUnique({
      where: { id: proposalId },
    });
    expect(row?.status).toBe('INVALID');
  });
});
