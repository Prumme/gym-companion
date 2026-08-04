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

describe('Workout session snapshot API (3.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let programA = '';
  let templateA = '';
  let templateEmpty = '';
  let templateB = '';
  let templateExerciseId = '';
  let templateSetId = '';
  let systemExerciseId = '';
  let systemExerciseName = '';
  let equipmentTypeId: string | null = null;
  let equipmentName: string | null = null;
  let sessionId = '';
  const emailA = `wo-a-${Date.now()}@example.com`;
  const emailB = `wo-b-${Date.now()}@example.com`;

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

    tokenA = await registerUser(app, emailA, 'Wo A');
    tokenB = await registerUser(app, emailB, 'Wo B');

    const system = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null },
      include: { defaultEquipmentType: true },
    });
    systemExerciseId = system.id;
    systemExerciseName = system.name;
    equipmentTypeId = system.defaultEquipmentTypeId;
    equipmentName = system.defaultEquipmentType?.name ?? null;

    const programRes = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Programme WO', goal: 'HYPERTROPHY' })
      .expect(201);
    programA = programRes.body.data.id;

    const tplRes = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Séance Push' })
      .expect(201);
    templateA = tplRes.body.data.workoutTemplates[0].id;

    const emptyRes = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Vide' })
      .expect(201);
    templateEmpty = emptyRes.body.data.workoutTemplates.find(
      (t: { name: string }) => t.name === 'Vide',
    ).id;

    const addEx = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programA}/workout-templates/${templateA}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: systemExerciseId,
        equipmentTypeId,
        restSecondsOverride: 90,
        notes: 'Contrôle excentrique',
      })
      .expect(201);

    const template = addEx.body.data.workoutTemplates.find(
      (t: { id: string }) => t.id === templateA,
    );
    templateExerciseId = template.exercises[0].id;

    const setRes = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programA}/workout-templates/${templateA}/exercises/${templateExerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        setType: 'WARMUP',
        targetRepMin: 12,
        targetRepMax: 12,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: 40,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        restSeconds: 60,
      })
      .expect(201);

    const afterWarmup = setRes.body.data.workoutTemplates.find(
      (t: { id: string }) => t.id === templateA,
    );
    expect(afterWarmup.exercises[0].sets).toHaveLength(1);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programA}/workout-templates/${templateA}/exercises/${templateExerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
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
      })
      .expect(201);

    const withTwo = (
      await request(app.getHttpServer())
        .get(`/api/v1/programs/${programA}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
    ).body.data.workoutTemplates.find((t: { id: string }) => t.id === templateA);
    templateSetId = withTwo.exercises[0].sets.find(
      (s: { setType: string }) => s.setType === 'WORKING',
    ).id;

    const programB = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Programme B', goal: 'STRENGTH' })
      .expect(201);
    const tplB = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programB.body.data.id}/workout-templates`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Séance B' })
      .expect(201);
    templateB = tplB.body.data.workoutTemplates[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/workouts/active').expect(401);
    await request(app.getHttpServer()).post('/api/v1/workouts').expect(401);
  });

  it('returns null when no active workout', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data).toBeNull();
  });

  it('refuses empty template', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateEmpty,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_TEMPLATE_EMPTY');
  });

  it('refuses foreign template as not found', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateB,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(404);
    expect(response.body.error.code).toBe('WORKOUT_TEMPLATE_NOT_FOUND');
  });

  it('creates an ACTIVE session snapshot from template', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(201);

    const data = response.body.data;
    sessionId = data.id;
    expect(data.status).toBe('ACTIVE');
    expect(data.name).toBe('Séance Push');
    expect(data.localDate).toBe('2026-08-04');
    expect(data.timezone).toBe('Europe/Paris');
    expect(data.version).toBe(1);
    expect(data.source.programId).toBe(programA);
    expect(data.source.programName).toBe('Programme WO');
    expect(data.source.workoutTemplateId).toBe(templateA);
    expect(data.source.workoutTemplateName).toBe('Séance Push');
    expect(data.exercises).toHaveLength(1);
    expect(data.exercises[0].exerciseName).toBe(systemExerciseName);
    expect(data.exercises[0].notes).toBe('Contrôle excentrique');
    expect(data.exercises[0].restSeconds).toBe(90);
    expect(data.exercises[0].equipment.name).toBe(equipmentName);
    expect(data.exercises[0].sets).toHaveLength(2);
    expect(data.exercises[0].sets[0].setType).toBe('WARMUP');
    expect(data.exercises[0].sets[0].targetRepMin).toBe(12);
    expect(data.exercises[0].sets[1].setType).toBe('WORKING');
    expect(data.exercises[0].sets[1].targetWeightKg).toBe(60);
    expect(data.exercises[0].sets[1].targetRir).toBe(2);
    expect(data.exercises[0].sets[1].targetRestSeconds).toBe(120);
    expect(data.exercises[0].sets[0].status).toBe('PENDING');
    expect(data.permissions.canRecordSets).toBe(true);
    expect(data).not.toHaveProperty('ownerUserId');
    expect(JSON.stringify(data)).not.toContain('exerciseNameSnapshot');
  });

  it('reads active and detail from snapshot', async () => {
    const active = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(active.body.data.id).toBe(sessionId);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data.id).toBe(sessionId);
    expect(detail.body.data.exercises[0].sets).toHaveLength(2);
  });

  it('hides session from other user', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    const activeB = await request(app.getHttpServer())
      .get('/api/v1/workouts/active')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(activeB.body.data).toBeNull();
  });

  it('refuses a second active session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(409);
    expect(response.body.error.code).toBe('WORKOUT_ACTIVE_ALREADY_EXISTS');
    expect(response.body.error.details.activeWorkoutSessionId).toBe(sessionId);
  });

  it('keeps snapshot stable after template and exercise changes', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programA}/workout-templates/${templateA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Push renommé' })
      .expect(200);

    await prisma.exercise.update({
      where: { id: systemExerciseId },
      data: { name: `${systemExerciseName} RENAMED` },
    });

    await request(app.getHttpServer())
      .delete(
        `/api/v1/programs/${programA}/workout-templates/${templateA}/exercises/${templateExerciseId}/sets/${templateSetId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await prisma.exercise.update({
      where: { id: systemExerciseId },
      data: { archivedAt: new Date() },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(detail.body.data.name).toBe('Séance Push');
    expect(detail.body.data.source.workoutTemplateName).toBe('Séance Push');
    expect(detail.body.data.exercises[0].exerciseName).toBe(systemExerciseName);
    expect(detail.body.data.exercises[0].sets).toHaveLength(2);

    await prisma.exercise.update({
      where: { id: systemExerciseId },
      data: { name: systemExerciseName, archivedAt: null },
    });
  });

  it('refuses start from archived program', async () => {
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${programA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // Reconstruire un modèle startable sur un programme actif pour les tests suivants
    // n'est pas nécessaire ici : on vérifie le refus archivé.
    const archivedProgram = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Archivable', goal: 'HYPERTROPHY' })
      .expect(201);
    const archivedId = archivedProgram.body.data.id;
    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${archivedId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'T' })
      .expect(201);
    const tplId = tpl.body.data.workoutTemplates[0].id;
    const ex = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${archivedId}/workout-templates/${tplId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: systemExerciseId,
        equipmentTypeId,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(201);
    const teId = ex.body.data.workoutTemplates[0].exercises[0].id;
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${archivedId}/workout-templates/${tplId}/exercises/${teId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 5,
        targetRepMax: 5,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: 50,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        restSeconds: null,
      })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${archivedId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: tplId,
        localDate: '2026-08-04',
        timezone: 'Europe/Paris',
      })
      .expect(400);
    expect(response.body.error.code).toBe('WORKOUT_TEMPLATE_NOT_STARTABLE');
  });

  it('allows only one concurrent active creation', async () => {
    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Concurrent', goal: 'HYPERTROPHY' })
      .expect(201);
    const programId = program.body.data.id;
    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'C' })
      .expect(201);
    const tplId = tpl.body.data.workoutTemplates[0].id;
    const ex = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${tplId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: systemExerciseId,
        equipmentTypeId,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(201);
    const teId = ex.body.data.workoutTemplates[0].exercises[0].id;
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${tplId}/exercises/${teId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 5,
        targetRepMax: 5,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: 40,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        restSeconds: null,
      })
      .expect(201);

    const payload = {
      sourceWorkoutTemplateId: tplId,
      localDate: '2026-08-05',
      timezone: 'Europe/Paris',
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/workouts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payload),
      request(app.getHttpServer())
        .post('/api/v1/workouts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const activeCount = await prisma.workoutSession.count({
      where: {
        ownerUserId: (
          await prisma.user.findUniqueOrThrow({ where: { email: emailA } })
        ).id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });
    expect(activeCount).toBe(1);

    const winner = first.status === 201 ? first : second;
    await prisma.workoutSession.update({
      where: { id: winner.body.data.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  });
});
