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

function workingSet(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('Program template exercises and sets API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let programId = '';
  let templateId = '';
  let systemExerciseId = '';
  let personalExerciseId = '';
  let otherPersonalExerciseId = '';
  let barbellId = '';
  let dumbbellId = '';
  let chestId = '';
  let templateExerciseIds: string[] = [];
  const emailA = `tpl-ex-a-${Date.now()}@example.com`;
  const emailB = `tpl-ex-b-${Date.now()}@example.com`;

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

    tokenA = await registerUser(app, emailA, 'Tpl A');
    tokenB = await registerUser(app, emailB, 'Tpl B');

    const system = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', archivedAt: null },
    });
    systemExerciseId = system.id;

    const chest = await prisma.muscleGroup.findFirstOrThrow({
      where: { code: 'chest' },
    });
    chestId = chest.id;
    barbellId = (
      await prisma.equipmentType.findFirstOrThrow({ where: { code: 'barbell' } })
    ).id;
    dumbbellId = (
      await prisma.equipmentType.findFirstOrThrow({ where: { code: 'dumbbell' } })
    ).id;

    const userA = await prisma.user.findUniqueOrThrow({ where: { email: emailA } });
    const userB = await prisma.user.findUniqueOrThrow({ where: { email: emailB } });

    const personalA = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: userA.id,
        name: 'Curl A',
        normalizedName: 'curl a',
        primaryMuscleGroupId: chestId,
        measurementType: 'WEIGHT_REPS',
        compatibleEquipment: {
          create: [{ equipmentTypeId: barbellId, isPreferred: true }],
        },
      },
    });
    personalExerciseId = personalA.id;

    const personalB = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: userB.id,
        name: 'Curl B',
        normalizedName: 'curl b',
        primaryMuscleGroupId: chestId,
        measurementType: 'WEIGHT_REPS',
      },
    });
    otherPersonalExerciseId = personalB.id;

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Prog sets', goal: 'STRENGTH' })
      .expect(201);
    programId = program.body.data.id;

    const template = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Séance 1' })
      .expect(201);
    templateId = template.body.data.workoutTemplates[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .send({})
      .expect(401);
  });

  it('adds system and personal exercises, rejects foreign/archived/duplicate/incompatible', async () => {
    const systemCompatible = await prisma.exerciseEquipmentCompatibility.findFirst({
      where: { exerciseId: systemExerciseId },
    });
    const compatibleEquipmentId = systemCompatible?.equipmentTypeId ?? null;

    const addedSystem = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: systemExerciseId,
        equipmentTypeId: compatibleEquipmentId,
        restSecondsOverride: 90,
        notes: 'Contrôle',
      })
      .expect(201);
    expect(addedSystem.body.data.workoutTemplates[0].exercises).toHaveLength(1);
    expect(addedSystem.body.data.workoutTemplates[0].exercises[0].position).toBe(0);

    const addedPersonal = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: personalExerciseId,
        equipmentTypeId: barbellId,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(201);
    expect(addedPersonal.body.data.workoutTemplates[0].exercises).toHaveLength(2);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: otherPersonalExerciseId,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: personalExerciseId,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(409);

    const personalTeId = addedPersonal.body.data.workoutTemplates[0].exercises.find(
      (item: { exercise: { id: string } }) => item.exercise.id === personalExerciseId,
    )?.id as string;
    await request(app.getHttpServer())
      .patch(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${personalTeId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ equipmentTypeId: dumbbellId })
      .expect(400);

    const archived = await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: (await prisma.user.findUniqueOrThrow({ where: { email: emailA } })).id,
        name: 'Archivé',
        normalizedName: 'archive',
        primaryMuscleGroupId: chestId,
        measurementType: 'REPS_ONLY',
        archivedAt: new Date(),
      },
    });
    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: archived.id,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(400);

    // third exercise for reorder tests
    const anotherSystem = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        id: { not: systemExerciseId },
      },
    });
    const third = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: anotherSystem.id,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(201);

    templateExerciseIds = third.body.data.workoutTemplates[0].exercises.map(
      (item: { id: string }) => item.id,
    );
  });

  it('updates, reorders and removes exercises with compact positions', async () => {
    const [first, second, third] = templateExerciseIds;
    await request(app.getHttpServer())
      .patch(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${second}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ notes: 'Note MAJ', restSecondsOverride: 60 })
      .expect(200);

    const reordered = await request(app.getHttpServer())
      .put(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/order`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateExerciseIds: [third, first, second] })
      .expect(200);
    expect(
      reordered.body.data.workoutTemplates[0].exercises.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([third, first, second]);

    await request(app.getHttpServer())
      .put(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/order`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateExerciseIds: [first, second] })
      .expect(400);

    const otherProgram = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Autre', goal: 'ENDURANCE' })
      .expect(201);
    const otherTemplate = await request(app.getHttpServer())
      .post(`/api/v1/programs/${otherProgram.body.data.id}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'T2' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(
        `/api/v1/programs/${otherProgram.body.data.id}/workout-templates/${otherTemplate.body.data.workoutTemplates[0].id}/exercises/${first}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ notes: 'x' })
      .expect(404);

    const afterDelete = await request(app.getHttpServer())
      .delete(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${third}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterDelete.body.data.workoutTemplates[0].exercises).toHaveLength(2);
    expect(
      afterDelete.body.data.workoutTemplates[0].exercises.map(
        (item: { position: number }) => item.position,
      ),
    ).toEqual([0, 1]);
    templateExerciseIds = afterDelete.body.data.workoutTemplates[0].exercises.map(
      (item: { id: string }) => item.id,
    );
  });

  it('manages sets with measurement validation and cascading delete', async () => {
    const exerciseId = templateExerciseIds[0]!;

    const created = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet())
      .expect(201);
    expect(created.body.data.workoutTemplates[0].exercises[0].sets).toHaveLength(1);
    expect(
      created.body.data.workoutTemplates[0].exercises[0].sets[0].targetWeightKg,
    ).toBe(60);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet({ targetRepMin: null, targetRepMax: null }))
      .expect(400);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet({ targetRepMin: 10, targetRepMax: 5 }))
      .expect(400);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet({ targetRir: 1, targetRpe: 8 }))
      .expect(400);

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet({ restSeconds: 2000 }))
      .expect(400);

    const second = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet({ targetWeightKg: 70, setType: 'WARMUP', targetRir: null }))
      .expect(201);
    const setIds = second.body.data.workoutTemplates[0].exercises[0].sets.map(
      (item: { id: string }) => item.id,
    ) as string[];

    const third = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send(workingSet({ targetWeightKg: 80 }))
      .expect(201);
    const allSetIds = third.body.data.workoutTemplates[0].exercises[0].sets.map(
      (item: { id: string }) => item.id,
    ) as string[];

    const reordered = await request(app.getHttpServer())
      .put(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets/order`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ setIds: [allSetIds[2], allSetIds[0], allSetIds[1]] })
      .expect(200);
    expect(
      reordered.body.data.workoutTemplates[0].exercises[0].sets.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([allSetIds[2], allSetIds[0], allSetIds[1]]);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets/${allSetIds[0]}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetWeightKg: 65 })
      .expect(200);

    const afterSetDelete = await request(app.getHttpServer())
      .delete(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}/sets/${allSetIds[1]}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      afterSetDelete.body.data.workoutTemplates[0].exercises[0].sets,
    ).toHaveLength(2);
    expect(
      afterSetDelete.body.data.workoutTemplates[0].exercises[0].sets.map(
        (item: { position: number }) => item.position,
      ),
    ).toEqual([0, 1]);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseIds[1]}/sets/${setIds[0]}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    const beforeCascade = await prisma.workoutTemplateSet.count({
      where: { workoutTemplateExerciseId: exerciseId },
    });
    expect(beforeCascade).toBe(2);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${exerciseId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      await prisma.workoutTemplateSet.count({
        where: { workoutTemplateExerciseId: exerciseId },
      }),
    ).toBe(0);
  });

  it('hides data from other users and blocks mutations when archived', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const remainingExercise = (
      await request(app.getHttpServer())
        .get(`/api/v1/programs/${programId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
    ).body.data.workoutTemplates[0].exercises[0];

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: systemExerciseId,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(403);

    if (remainingExercise) {
      await request(app.getHttpServer())
        .post(
          `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${remainingExercise.id}/sets`,
        )
        .set('Authorization', `Bearer ${tokenA}`)
        .send(workingSet())
        .expect(403);
    }

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data).not.toHaveProperty('ownerUserId');
    expect(detail.body.data.workoutTemplates[0]).toHaveProperty('exercises');
  });
});
