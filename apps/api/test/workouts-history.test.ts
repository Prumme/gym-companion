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
import { computeWorkoutHistorySetSummary } from '../src/modules/workouts/workouts.mapper';

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

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
) {
  const system = await prisma.exercise.findFirstOrThrow({
    where: {
      source: 'SYSTEM',
      archivedAt: null,
      measurementType: 'WEIGHT_REPS',
    },
  });
  const program = await request(app.getHttpServer())
    .post('/api/v1/programs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Prog ${name}`, goal: 'HYPERTROPHY' })
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
      exerciseId: system.id,
      equipmentTypeId: system.defaultEquipmentTypeId,
      restSecondsOverride: 90,
      notes: null,
    })
    .expect(201);
  const teId = ex.body.data.workoutTemplates[0].exercises[0].id as string;
  await request(app.getHttpServer())
    .post(
      `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${teId}/sets`,
    )
    .set('Authorization', `Bearer ${token}`)
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
  return { programId, templateId, systemExerciseId: system.id };
}

describe('Workout history API (3.6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let templateA = '';
  let programA = '';
  let completedId = '';
  let cancelledId = '';
  let activeId = '';
  let pausedId = '';
  const stamp = Date.now();
  const emailA = `hist-a-${stamp}@example.com`;
  const emailB = `hist-b-${stamp}@example.com`;

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

    tokenA = await registerUser(app, emailA, 'Hist A');
    tokenB = await registerUser(app, emailB, 'Hist B');

    const created = await createStartableTemplate(
      app,
      tokenA,
      prisma,
      `A-${stamp}`,
    );
    templateA = created.templateId;
    programA = created.programId;
    await createStartableTemplate(app, tokenB, prisma, `B-${stamp}`);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('calcule le résumé des statuts de séries', () => {
    const summary = computeWorkoutHistorySetSummary(2, [
      'COMPLETED',
      'PARTIAL',
      'FAILED',
      'SKIPPED',
      'PENDING',
      'CANCELLED',
    ]);
    expect(summary).toEqual({
      exerciseCount: 2,
      totalSetCount: 6,
      processedSetCount: 5,
      completedSetCount: 1,
      partialSetCount: 1,
      failedSetCount: 1,
      skippedSetCount: 1,
      pendingSetCount: 1,
    });
  });

  it('retourne un historique vide puis exige l’auth', async () => {
    const empty = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
    });

    await request(app.getHttpServer()).get('/api/v1/workouts').expect(401);
  });

  it('exclut ACTIVE/PAUSED et isole les utilisateurs', async () => {
    const active = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-01',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    activeId = active.body.data.id;

    const listWithActive = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listWithActive.body.data).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${activeId}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 1, clientCommandId: `hist-pause-${stamp}` })
      .expect(200);
    pausedId = activeId;

    const listWithPaused = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listWithPaused.body.data).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${pausedId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 2,
        keepRecordedData: true,
        reason: 'Interruption',
        clientCommandId: `hist-cancel-paused-${stamp}`,
      })
      .expect(200);

    const cancelledPaused = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(cancelledPaused.body.data).toHaveLength(1);
    cancelledId = cancelledPaused.body.data[0].id;

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(foreign.body.data).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${cancelledId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('liste COMPLETED / CANCELLED avec filtres et pagination stable', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-03',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    completedId = created.body.data.id;
    const setId = created.body.data.exercises[0].sets[0].id as string;
    const exerciseId = created.body.data.exercises[0].id as string;

    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${completedId}/exercises/${exerciseId}/sets/${setId}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 62.5,
        actualReps: 9,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 1,
        actualRpe: null,
        reachedFailure: true,
        notes: null,
        expectedVersion: 1,
        clientCommandId: `hist-set-${stamp}`,
      })
      .expect(200);

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${completedId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 2,
        notes: 'Top',
        clientCommandId: `hist-complete-${stamp}`,
      })
      .expect(200);
    expect(completed.body.data.workoutSession.status).toBe('COMPLETED');

    const all = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data.every((row: { status: string }) =>
      ['COMPLETED', 'CANCELLED'].includes(row.status),
    )).toBe(true);
    expect(all.body.data[0].summary).toMatchObject({
      exerciseCount: 1,
      totalSetCount: 1,
    });
    expect(all.body.data[0]).not.toHaveProperty('exercises');
    expect(all.body.data[0]).not.toHaveProperty('ownerUserId');

    const onlyCompleted = await request(app.getHttpServer())
      .get('/api/v1/workouts?status=COMPLETED')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(onlyCompleted.body.data).toHaveLength(1);
    expect(onlyCompleted.body.data[0].id).toBe(completedId);

    const onlyCancelled = await request(app.getHttpServer())
      .get('/api/v1/workouts?status=CANCELLED')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(onlyCancelled.body.data).toHaveLength(1);
    expect(onlyCancelled.body.data[0].id).toBe(cancelledId);

    const fromFilter = await request(app.getHttpServer())
      .get('/api/v1/workouts?from=2026-08-03')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(fromFilter.body.data).toHaveLength(1);
    expect(fromFilter.body.data[0].id).toBe(completedId);

    const toFilter = await request(app.getHttpServer())
      .get('/api/v1/workouts?to=2026-08-01')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(toFilter.body.data).toHaveLength(1);
    expect(toFilter.body.data[0].id).toBe(cancelledId);

    const range = await request(app.getHttpServer())
      .get('/api/v1/workouts?from=2026-08-01&to=2026-08-03')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(range.body.data).toHaveLength(2);

    const byProgram = await request(app.getHttpServer())
      .get(`/api/v1/workouts?programId=${programA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(byProgram.body.data.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get('/api/v1/workouts?status=ACTIVE')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_HISTORY_INVALID_STATUS');
      });

    await request(app.getHttpServer())
      .get('/api/v1/workouts?from=2026-99-01')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_HISTORY_INVALID_FROM_DATE');
      });

    await request(app.getHttpServer())
      .get('/api/v1/workouts?from=2026-08-04&to=2026-08-01')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_HISTORY_INVALID_DATE_RANGE');
      });

    const page1 = await request(app.getHttpServer())
      .get('/api/v1/workouts?limit=1')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.pagination.hasMore).toBe(true);
    expect(page1.body.pagination.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(
        `/api/v1/workouts?limit=1&cursor=${encodeURIComponent(page1.body.pagination.nextCursor)}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);

    const ids = [page1.body.data[0].id, page2.body.data[0].id];
    expect(new Set(ids).size).toBe(2);

    await request(app.getHttpServer())
      .get('/api/v1/workouts?cursor=not-a-cursor')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_HISTORY_INVALID_CURSOR');
      });
  });

  it('conserve le snapshot après modification du programme / exercice', async () => {
    const detailBefore = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${completedId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const snapshotName = detailBefore.body.data.name as string;
    const exerciseName = detailBefore.body.data.exercises[0]
      .exerciseName as string;
    const targetWeight = detailBefore.body.data.exercises[0].sets[0]
      .targetWeightKg as number;
    const actualReps = detailBefore.body.data.exercises[0].sets[0]
      .actualReps as number;
    expect(detailBefore.body.data.exercises[0].sets[0].status).toBe(
      'COMPLETED',
    );
    expect(detailBefore.body.data.permissions).toEqual({
      canPause: false,
      canResume: false,
      canComplete: false,
      canCancel: false,
      canRecordSets: false,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Programme renommé après coup' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/programs/${programA}/workout-templates/${templateA}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Modèle renommé après coup' })
      .expect(200);

    const detailAfter = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${completedId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detailAfter.body.data.name).toBe(snapshotName);
    expect(detailAfter.body.data.exercises[0].exerciseName).toBe(exerciseName);
    expect(detailAfter.body.data.exercises[0].sets[0].targetWeightKg).toBe(
      targetWeight,
    );
    expect(detailAfter.body.data.exercises[0].sets[0].actualReps).toBe(
      actualReps,
    );
    expect(detailAfter.body.data.source.programName).not.toBe(
      'Programme renommé après coup',
    );

    const historyItem = await request(app.getHttpServer())
      .get(`/api/v1/workouts?status=COMPLETED`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(historyItem.body.data[0].source.programName).toBe(
      detailBefore.body.data.source.programName,
    );
  });

  it('conserve les séries PENDING sur une séance annulée', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-02',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    const sessionId = created.body.data.id as string;
    expect(created.body.data.exercises[0].sets[0].status).toBe('PENDING');

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 1,
        keepRecordedData: true,
        reason: 'Stop',
        clientCommandId: `hist-cancel-pending-${stamp}`,
      })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.data.status).toBe('CANCELLED');
    expect(detail.body.data.exercises[0].sets[0].status).toBe('PENDING');

    const list = await request(app.getHttpServer())
      .get('/api/v1/workouts?status=CANCELLED')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const item = list.body.data.find(
      (row: { id: string }) => row.id === sessionId,
    );
    expect(item.summary.pendingSetCount).toBe(1);
    expect(item.summary.processedSetCount).toBe(0);
  });

  it('refuse les mutations sur une séance historique', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${completedId}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: 3, clientCommandId: `hist-mut-${stamp}` })
      .expect(409);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${completedId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const set = detail.body.data.exercises[0].sets[0];
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${completedId}/exercises/${detail.body.data.exercises[0].id}/sets/${set.id}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 70,
        actualReps: 5,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: detail.body.data.version,
        clientCommandId: `hist-set-mut-${stamp}`,
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('WORKOUT_NOT_EDITABLE');
      });
  });

  it('paginate sans doublon lorsque plusieurs séances partagent la même date', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workouts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          sourceWorkoutTemplateId: templateA,
          localDate: '2026-07-15',
          timezone: 'Europe/Paris',
        })
        .expect(201);
      const id = created.body.data.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/workouts/${id}/complete`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          expectedVersion: 1,
          notes: null,
          clientCommandId: `hist-same-day-${stamp}-${i}`,
        })
        .expect(200);
      ids.push(id);
    }

    const collected: string[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    while (hasMore) {
      const queryPath: string = cursor
        ? `/api/v1/workouts?from=2026-07-15&to=2026-07-15&limit=1&cursor=${encodeURIComponent(cursor)}`
        : '/api/v1/workouts?from=2026-07-15&to=2026-07-15&limit=1';
      const page = await request(app.getHttpServer())
        .get(queryPath)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      collected.push(
        ...page.body.data.map((row: { id: string }) => row.id),
      );
      hasMore = Boolean(page.body.pagination.hasMore);
      cursor = page.body.pagination.nextCursor as string | null;
    }

    expect(collected).toHaveLength(3);
    expect(new Set(collected).size).toBe(3);
    expect(collected.sort()).toEqual([...ids].sort());
  });
});
