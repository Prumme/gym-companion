import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { normalizeExerciseName } from '@gym-companion/validation';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { seedReferenceData } from '../src/modules/reference/reference.seed';
import {
  seedSystemExercises,
  SYSTEM_EXERCISE_SEEDS,
} from '../src/modules/exercises/exercises.seed';

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

type ListItem = {
  id: string;
  source: string;
  name: string;
  measurementType: string;
  primaryMuscleGroup: { id: string; code: string };
  defaultEquipmentType: { id: string; code: string } | null;
  archivedAt: string | null;
  permissions: unknown;
  userPreference: {
    isFavorite: boolean;
    isExcludedFromSuggestions: boolean;
    preferredEquipmentType: unknown;
    restSecondsOverride: number | null;
  };
};

describe('Exercises catalog API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let chestId: string;
  let backId: string;
  let barbellId: string;
  let dumbbellId: string;
  let tricepsId: string;
  const emailA = `ex-a-${Date.now()}@example.com`;
  const emailB = `ex-b-${Date.now()}@example.com`;
  let personalExerciseId = '';
  const duplicateNameIds: string[] = [];

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

    const chest = await prisma.muscleGroup.findUniqueOrThrow({ where: { code: 'chest' } });
    const back = await prisma.muscleGroup.findUniqueOrThrow({ where: { code: 'back' } });
    const triceps = await prisma.muscleGroup.findUniqueOrThrow({
      where: { code: 'triceps' },
    });
    const barbell = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'barbell' },
    });
    const dumbbell = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'dumbbell' },
    });
    chestId = chest.id;
    backId = back.id;
    tricepsId = triceps.id;
    barbellId = barbell.id;
    dumbbellId = dumbbell.id;

    tokenA = await registerUser(app, emailA, 'User A');
    tokenB = await registerUser(app, emailB, 'User B');
    userAId = (
      await prisma.user.findUniqueOrThrow({ where: { email: emailA } })
    ).id;

    // Données dédiées pagination / noms identiques (déterministes).
    for (let i = 0; i < 5; i += 1) {
      const created = await prisma.exercise.create({
        data: {
          source: 'USER',
          ownerUserId: userAId,
          name: 'Clone Pagination',
          normalizedName: normalizeExerciseName('Clone Pagination'),
          primaryMuscleGroupId: backId,
          measurementType: 'DURATION',
          defaultEquipmentTypeId: dumbbellId,
          compatibleEquipment: {
            create: [{ equipmentTypeId: dumbbellId, isPreferred: true }],
          },
          secondaryMuscles: {
            create: [{ muscleGroupId: tricepsId }],
          },
        },
      });
      duplicateNameIds.push(created.id);
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  it('seeds system exercises idempotently', async () => {
    const count = await prisma.exercise.count({
      where: { source: 'SYSTEM', slug: { not: null } },
    });
    expect(count).toBeGreaterThanOrEqual(SYSTEM_EXERCISE_SEEDS.length);
    expect(count).toBeGreaterThanOrEqual(100);

    const bySlug = await prisma.exercise.findMany({
      where: { slug: { in: SYSTEM_EXERCISE_SEEDS.map((item) => item.slug) } },
      select: { id: true, slug: true },
    });
    expect(bySlug).toHaveLength(SYSTEM_EXERCISE_SEEDS.length);

    const idsBefore = Object.fromEntries(
      bySlug.map((row) => [row.slug!, row.id]),
    );

    await seedSystemExercises(prisma);

    const countAfter = await prisma.exercise.count({
      where: { source: 'SYSTEM', slug: { not: null } },
    });
    expect(countAfter).toBe(count);

    const bySlugAfter = await prisma.exercise.findMany({
      where: { slug: { in: SYSTEM_EXERCISE_SEEDS.map((item) => item.slug) } },
      select: { id: true, slug: true },
    });
    expect(bySlugAfter).toHaveLength(SYSTEM_EXERCISE_SEEDS.length);
    for (const row of bySlugAfter) {
      expect(row.id).toBe(idsBefore[row.slug!]);
    }
  });

  it('catalogue SYSTEM couvre la séance Full Body A débutant', async () => {
    const matchers: Array<(name: string) => boolean> = [
      (n) => /^Presse à cuisses$/i.test(n),
      (n) => /Chest Press machine/i.test(n),
      (n) => /Tirage vertical/i.test(n),
      (n) => /Leg Curl/i.test(n),
      (n) => /Rowing assis/i.test(n),
      (n) => /Élévations latérales/i.test(n),
      (n) => /Curl/i.test(n),
      (n) => /Extension triceps/i.test(n) && /poulie/i.test(n),
    ];
    const rows = await prisma.exercise.findMany({
      where: { source: 'SYSTEM', archivedAt: null },
      select: { name: true, slug: true },
    });
    const names = rows.map((row) => row.name);
    for (const matcher of matchers) {
      expect(names.some(matcher)).toBe(true);
    }
  });

  it('lists with default limit 20 and pagination meta', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(20);
    expect(response.body.pagination).toMatchObject({
      hasMore: expect.any(Boolean),
    });
    expect(response.body.pagination).toHaveProperty('nextCursor');
    if (response.body.pagination.hasMore) {
      expect(typeof response.body.pagination.nextCursor).toBe('string');
      expect(response.body.data.length).toBe(20);
    } else {
      expect(response.body.pagination.nextCursor).toBeNull();
    }

    for (const item of response.body.data as ListItem[]) {
      expect(item).not.toHaveProperty('normalizedName');
      expect(item).not.toHaveProperty('ownerUserId');
      expect(item.permissions).toBeDefined();
      expect(item).toHaveProperty('userPreference');
      expect(item.userPreference).toMatchObject({
        isFavorite: expect.any(Boolean),
        isExcludedFromSuggestions: expect.any(Boolean),
      });
    }
  });

  it('paginates without duplicates or missing identical names', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ limit: 5 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.pagination.hasMore).toBe(true);
    expect(typeof page1.body.pagination.nextCursor).toBe('string');

    const page2 = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ limit: 5, cursor: page1.body.pagination.nextCursor })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(page2.body.data.length).toBeGreaterThan(0);

    const ids1 = (page1.body.data as ListItem[]).map((item) => item.id);
    const ids2 = (page2.body.data as ListItem[]).map((item) => item.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);

    // Collect all pages for duplicate-name set.
    const allIds: string[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const query: Record<string, string | number> = {
        limit: 3,
        search: 'clone pagination',
      };
      if (cursor) {
        query.cursor = cursor;
      }
      const page = await request(app.getHttpServer())
        .get('/api/v1/exercises')
        .query(query)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      allIds.push(...(page.body.data as ListItem[]).map((item) => item.id));
      const pagination = page.body.pagination as {
        hasMore: boolean;
        nextCursor: string | null;
      };
      cursor = pagination.hasMore ? pagination.nextCursor : null;
      guard += 1;
    } while (cursor && guard < 20);

    expect(new Set(allIds).size).toBe(allIds.length);
    for (const id of duplicateNameIds) {
      expect(allIds).toContain(id);
    }
  });

  it('rejects invalid cursor and invalid limit', async () => {
    const badCursor = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ cursor: 'not-valid' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    expect(badCursor.body.error.code).toBe('EXERCISE_INVALID_CURSOR');

    const badLimit = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ limit: 'abc' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    expect(badLimit.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('supports search exact, partial, accents, case and spaces', async () => {
    const variants = [
      'Développé couché à la barre',
      'developpe',
      'couche',
      'DEVELOPPE COUCHE',
      '  Développé   couché  ',
    ];

    for (const search of variants) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/exercises')
        .query({ search, limit: 50 })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(
        (response.body.data as ListItem[]).some((item) =>
          item.name.toLowerCase().includes('couch'),
        ),
      ).toBe(true);
    }
  });

  it('filters by primary and secondary muscle groups', async () => {
    const primary = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ muscleGroupId: chestId, limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(primary.body.data.length).toBeGreaterThan(0);
    expect(
      (primary.body.data as ListItem[]).some(
        (item) => item.primaryMuscleGroup.code === 'chest',
      ),
    ).toBe(true);

    const secondary = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ muscleGroupId: tricepsId, limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(
      (secondary.body.data as ListItem[]).some((item) =>
        duplicateNameIds.includes(item.id),
      ),
    ).toBe(true);
  });

  it('filters by compatible equipment, measurement and source', async () => {
    const byEquipment = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ equipmentTypeId: barbellId, limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(byEquipment.body.data.length).toBeGreaterThan(0);

    const byMeasurement = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ measurementType: 'DURATION', limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (byMeasurement.body.data as ListItem[]).every(
        (item) => item.measurementType === 'DURATION',
      ),
    ).toBe(true);

    const systemOnly = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ source: 'SYSTEM', limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (systemOnly.body.data as ListItem[]).every((item) => item.source === 'SYSTEM'),
    ).toBe(true);

    const userOnly = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ source: 'USER', limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (userOnly.body.data as ListItem[]).every((item) => item.source === 'USER'),
    ).toBe(true);
    expect(userOnly.body.data.length).toBeGreaterThan(0);
  });

  it('combines muscle, equipment and measurement filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({
        muscleGroupId: backId,
        equipmentTypeId: dumbbellId,
        measurementType: 'DURATION',
        limit: 100,
      })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(
      (response.body.data as ListItem[]).some((item) =>
        duplicateNameIds.includes(item.id),
      ),
    ).toBe(true);
  });

  it('creates a personal exercise with source USER and owner enforced', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Curl maison A ${Date.now()}`,
        primaryMuscleGroupId: chestId,
        secondaryMuscleGroupIds: [tricepsId],
        measurementType: 'WEIGHT_REPS',
        defaultEquipmentTypeId: barbellId,
        compatibleEquipmentTypes: [
          { equipmentTypeId: barbellId, isPreferred: true, notes: null },
        ],
        defaultRestSeconds: 90,
        instructions: 'Contrôler la descente.',
        source: 'SYSTEM',
        ownerUserId: 'should-be-ignored',
      })
      .expect(201);

    expect(created.body.data.source).toBe('USER');
    expect(created.body.data.permissions.canEdit).toBe(true);
    expect(created.body.data.secondaryMuscleGroups).toHaveLength(1);
    expect(created.body.data.compatibleEquipmentTypes).toHaveLength(1);
    expect(created.body.data).not.toHaveProperty('normalizedName');
    personalExerciseId = created.body.data.id as string;
  });

  it('shows personal exercises only to their owner', async () => {
    const listA = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ source: 'USER', limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const listB = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ source: 'USER', limit: 100 })
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(
      listA.body.data.some((item: { id: string }) => item.id === personalExerciseId),
    ).toBe(true);
    expect(
      listB.body.data.some((item: { id: string }) => item.id === personalExerciseId),
    ).toBe(false);
  });

  it('allows owner to read and forbids other user (404)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const forbidden = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    expect(forbidden.body.error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('allows owner to update and forbids other user', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Curl maison A modifié', defaultRestSeconds: 75 })
      .expect(200);
    expect(updated.body.data.name).toBe('Curl maison A modifié');
    expect(updated.body.data.defaultRestSeconds).toBe(75);

    await request(app.getHttpServer())
      .patch(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hack' })
      .expect(404);
  });

  it('forbids modifying a system exercise', async () => {
    const system = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', slug: 'planche' },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/exercises/${system.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hack système' })
      .expect(403);
    expect(response.body.error.code).toBe('EXERCISE_NOT_EDITABLE');
  });

  it('archives, hides from default list, then restores', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const defaultList = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ limit: 100, search: 'curl maison a' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      defaultList.body.data.some(
        (item: { id: string }) => item.id === personalExerciseId,
      ),
    ).toBe(false);

    const archivedList = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ includeArchived: true, limit: 100, search: 'curl maison a' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      archivedList.body.data.some(
        (item: { id: string }) => item.id === personalExerciseId,
      ),
    ).toBe(true);

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/exercises/${personalExerciseId}/restore`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(restored.body.data.archivedAt).toBeNull();
  });

  it('never returns another user archived personal exercises', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ includeArchived: true, limit: 100, source: 'USER' })
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(
      listB.body.data.some((item: { id: string }) => item.id === personalExerciseId),
    ).toBe(false);

    await request(app.getHttpServer())
      .post(`/api/v1/exercises/${personalExerciseId}/restore`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('returns validation error format for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: '',
        primaryMuscleGroupId: chestId,
        measurementType: 'WEIGHT_REPS',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fieldErrors).toBeDefined();
  });

  it('returns seeded system exercises matching contract shape', async () => {
    const system = await prisma.exercise.findFirstOrThrow({
      where: { slug: 'developpe-couche-barre' },
      include: {
        primaryMuscleGroup: true,
        defaultEquipmentType: true,
        secondaryMuscles: { include: { muscleGroup: true } },
        compatibleEquipment: { include: { equipmentType: true } },
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${system.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      source: 'SYSTEM',
      name: 'Développé couché à la barre',
      measurementType: 'WEIGHT_REPS',
      permissions: {
        canEdit: false,
        canArchive: false,
        canRestore: false,
      },
    });
    expect(response.body.data.primaryMuscleGroup.code).toBe('chest');
    expect(response.body.data.defaultEquipmentType.code).toBe('barbell');
    expect(response.body.data.userPreference).toEqual({
      isFavorite: false,
      isExcludedFromSuggestions: false,
      preferredEquipmentType: null,
      restSecondsOverride: null,
    });
    expect(response.body.data).not.toHaveProperty('normalizedName');
    expect(response.body.data).not.toHaveProperty('ownerUserId');
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/api/v1/exercises').expect(401);
  });
});
