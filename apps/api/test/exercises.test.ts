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

describe('Exercises catalog API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let chestId: string;
  let barbellId: string;
  let tricepsId: string;
  const emailA = `ex-a-${Date.now()}@example.com`;
  const emailB = `ex-b-${Date.now()}@example.com`;
  let personalExerciseId = '';

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
    await seedSystemExercises(prisma);

    const chest = await prisma.muscleGroup.findUniqueOrThrow({ where: { code: 'chest' } });
    const triceps = await prisma.muscleGroup.findUniqueOrThrow({
      where: { code: 'triceps' },
    });
    const barbell = await prisma.equipmentType.findUniqueOrThrow({
      where: { code: 'barbell' },
    });
    chestId = chest.id;
    tricepsId = triceps.id;
    barbellId = barbell.id;

    tokenA = await registerUser(app, emailA, 'User A');
    tokenB = await registerUser(app, emailB, 'User B');
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

    const bySlug = await prisma.exercise.findMany({
      where: { slug: { in: SYSTEM_EXERCISE_SEEDS.map((item) => item.slug) } },
    });
    expect(bySlug).toHaveLength(SYSTEM_EXERCISE_SEEDS.length);
  });

  it('lists system exercises for an authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    const system = response.body.data.filter(
      (item: { source: string }) => item.source === 'SYSTEM',
    );
    expect(system.length).toBeGreaterThanOrEqual(SYSTEM_EXERCISE_SEEDS.length);

    const names = response.body.data.map((item: { name: string }) => item.name);
    const normalized = response.body.data.map(
      (item: { name: string }) => item.name,
    );
    // Ordre déterministe côté API via normalizedName.
    expect(names.length).toBeGreaterThan(0);
    void normalized;
    for (let i = 1; i < response.body.data.length; i += 1) {
      const prev = response.body.data[i - 1] as { name: string; id: string };
      const curr = response.body.data[i] as { name: string; id: string };
      const prevKey = prev.name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
      const currKey = curr.name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
      expect(prevKey <= currKey).toBe(true);
      if (prevKey === currKey) {
        expect(prev.id <= curr.id).toBe(true);
      }
    }

    for (const item of response.body.data) {
      expect(item).not.toHaveProperty('normalizedName');
      expect(item).not.toHaveProperty('ownerUserId');
      expect(item.permissions).toBeDefined();
    }
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

    const db = await prisma.exercise.findUniqueOrThrow({
      where: { id: personalExerciseId },
      include: { secondaryMuscles: true, compatibleEquipment: true },
    });
    expect(db.source).toBe('USER');
    expect(db.ownerUserId).not.toBeNull();
    expect(db.secondaryMuscles).toHaveLength(1);
    expect(db.compatibleEquipment).toHaveLength(1);
  });

  it('shows personal exercises only to their owner', async () => {
    const listA = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const listB = await request(app.getHttpServer())
      .get('/api/v1/exercises')
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
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      defaultList.body.data.some(
        (item: { id: string }) => item.id === personalExerciseId,
      ),
    ).toBe(false);

    const archivedList = await request(app.getHttpServer())
      .get('/api/v1/exercises?includeArchived=true')
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
    expect(response.body.data).not.toHaveProperty('normalizedName');
    expect(response.body.data).not.toHaveProperty('ownerUserId');
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/api/v1/exercises').expect(401);
  });
});
