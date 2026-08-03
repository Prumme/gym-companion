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

const defaultPreference = {
  isFavorite: false,
  isExcludedFromSuggestions: false,
  preferredEquipmentType: null,
  restSecondsOverride: null,
};

describe('Exercise preferences API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let systemExerciseId: string;
  let personalExerciseId = '';
  let chestId: string;
  let barbellId: string;
  let dumbbellId: string;
  let machineId: string;
  let bodyweightId: string;
  const emailA = `pref-a-${Date.now()}@example.com`;
  const emailB = `pref-b-${Date.now()}@example.com`;

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

    const system = await prisma.exercise.findFirstOrThrow({
      where: { slug: 'developpe-couche-barre' },
      include: { compatibleEquipment: true },
    });
    systemExerciseId = system.id;

    const chest = await prisma.muscleGroup.findUniqueOrThrow({ where: { code: 'chest' } });
    const barbell = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'barbell' },
    });
    const dumbbell = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'dumbbell' },
    });
    const machine = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'machine' },
    });
    const bodyweight = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'bodyweight' },
    });
    chestId = chest.id;
    barbellId = barbell.id;
    dumbbellId = dumbbell.id;
    machineId = machine.id;
    bodyweightId = bodyweight.id;

    tokenA = await registerUser(app, emailA, 'Pref A');
    tokenB = await registerUser(app, emailB, 'Pref B');
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  it('returns default preference when none exists', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.data).toEqual(defaultPreference);
  });

  it('allows user A to favorite a system exercise; user B does not see it', async () => {
    const put = await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      })
      .expect(200);

    expect(put.body.data.isFavorite).toBe(true);
    expect(put.body.data).not.toHaveProperty('userId');
    expect(put.body.data).not.toHaveProperty('id');

    const favoritesA = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      favoritesA.body.data.some((item: { id: string }) => item.id === systemExerciseId),
    ).toBe(true);

    const favoritesB = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, limit: 100 })
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(
      favoritesB.body.data.some((item: { id: string }) => item.id === systemExerciseId),
    ).toBe(false);

    const detailB = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${systemExerciseId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(detailB.body.data.userPreference.isFavorite).toBe(false);
  });

  it('updates the same preference row idempotently', async () => {
    const payload = {
      isFavorite: true,
      isExcludedFromSuggestions: true,
      preferredEquipmentTypeId: barbellId,
      restSecondsOverride: 120,
    };

    const first = await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload)
      .expect(200);
    const second = await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload)
      .expect(200);

    expect(first.body.data).toEqual(second.body.data);
    expect(second.body.data).toMatchObject({
      isFavorite: true,
      isExcludedFromSuggestions: true,
      restSecondsOverride: 120,
      preferredEquipmentType: { id: barbellId, code: 'barbell' },
    });

    const count = await prisma.userExercisePreference.count({
      where: {
        exerciseId: systemExerciseId,
        user: { email: emailA },
      },
    });
    expect(count).toBe(1);
  });

  it('accepts compatible preferred equipment and rejects incompatible', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: machineId,
        restSecondsOverride: 90,
      })
      .expect(200);

    const incompatible = await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: bodyweightId,
        restSecondsOverride: 90,
      })
      .expect(400);
    expect(incompatible.body.error.code).toBe(
      'EXERCISE_PREFERRED_EQUIPMENT_NOT_COMPATIBLE',
    );
  });

  it('rejects invalid restSecondsOverride', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: false,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: -5,
      })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('removes favorite via PUT defaults cleanup and via DELETE', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: false,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      })
      .expect(200);

    const afterCleanup = await prisma.userExercisePreference.count({
      where: {
        exerciseId: systemExerciseId,
        user: { email: emailA },
      },
    });
    expect(afterCleanup).toBe(0);

    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    const get = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(get.body.data).toEqual(defaultPreference);
  });

  it('allows owner to favorite personal exercise and forbids other user', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Perso favori ${Date.now()}`,
        primaryMuscleGroupId: chestId,
        secondaryMuscleGroupIds: [],
        measurementType: 'WEIGHT_REPS',
        defaultEquipmentTypeId: barbellId,
        compatibleEquipmentTypes: [
          { equipmentTypeId: barbellId, isPreferred: true, notes: null },
          { equipmentTypeId: dumbbellId, isPreferred: false, notes: null },
        ],
        defaultRestSeconds: 60,
        instructions: null,
      })
      .expect(201);

    personalExerciseId = created.body.data.id as string;
    expect(created.body.data.userPreference).toEqual(defaultPreference);

    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${personalExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: dumbbellId,
        restSecondsOverride: 75,
      })
      .expect(200);

    const forbidden = await request(app.getHttpServer())
      .put(`/api/v1/exercises/${personalExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      })
      .expect(404);
    expect(forbidden.body.error.code).toBe('EXERCISE_NOT_FOUND');

    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${personalExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('keeps preference after archive/restore and hides archived from default favorites', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${personalExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const defaultFav = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      defaultFav.body.data.some((item: { id: string }) => item.id === personalExerciseId),
    ).toBe(false);

    const archivedFav = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, includeArchived: true, limit: 100 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const archivedItem = archivedFav.body.data.find(
      (item: { id: string }) => item.id === personalExerciseId,
    );
    expect(archivedItem?.userPreference.isFavorite).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/exercises/${personalExerciseId}/restore`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const restored = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${personalExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(restored.body.data.isFavorite).toBe(true);
    expect(restored.body.data.restSecondsOverride).toBe(75);
  });

  it('combines favoriteOnly with search, muscle filter and pagination without duplicates', async () => {
    // Ensure system exercise is favorited again for A.
    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      })
      .expect(200);

    const searched = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, search: 'developpe', limit: 50 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      searched.body.data.every(
        (item: { userPreference: { isFavorite: boolean } }) =>
          item.userPreference.isFavorite,
      ),
    ).toBe(true);

    const byMuscle = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, muscleGroupId: chestId, limit: 50 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(byMuscle.body.data.length).toBeGreaterThan(0);

    const page1 = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: true, limit: 1 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.data[0].userPreference.isFavorite).toBe(true);

    if (page1.body.pagination.hasMore) {
      const page2 = await request(app.getHttpServer())
        .get('/api/v1/exercises')
        .query({
          favoriteOnly: true,
          limit: 1,
          cursor: page1.body.pagination.nextCursor,
        })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
    }

    const normal = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ favoriteOnly: false, limit: 5 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(normal.body.data.length).toBeGreaterThan(0);
    expect(normal.body.data[0]).toHaveProperty('userPreference');
  });

  it('lets user B define an independent preference on the same system exercise', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        isFavorite: true,
        isExcludedFromSuggestions: true,
        preferredEquipmentTypeId: null,
        restSecondsOverride: 45,
      })
      .expect(200);

    const prefA = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const prefB = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${systemExerciseId}/preference`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(prefA.body.data.isExcludedFromSuggestions).toBe(false);
    expect(prefB.body.data).toMatchObject({
      isFavorite: true,
      isExcludedFromSuggestions: true,
      restSecondsOverride: 45,
    });
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${systemExerciseId}/preference`)
      .expect(401);
    await request(app.getHttpServer())
      .put(`/api/v1/exercises/${systemExerciseId}/preference`)
      .send(defaultPreference)
      .expect(401);
  });
});
