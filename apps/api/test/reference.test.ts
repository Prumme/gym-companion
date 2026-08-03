import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  seedReferenceData,
} from '../src/modules/reference/reference.seed';

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

describe('Reference data (muscle groups & equipment types)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  }, 30_000);

  afterAll(async () => {
    await prisma.muscleGroup.deleteMany({
      where: { code: { startsWith: 'test-inactive-' } },
    });
    await prisma.equipmentType.deleteMany({
      where: { code: { startsWith: 'test-inactive-' } },
    });
    await app.close();
  });

  it('seeds the expected muscle groups and equipment types', async () => {
    const muscleGroups = await prisma.muscleGroup.findMany({
      where: { code: { in: MUSCLE_GROUPS.map((item) => item.code) } },
      orderBy: { code: 'asc' },
    });
    const equipmentTypes = await prisma.equipmentType.findMany({
      where: { code: { in: EQUIPMENT_TYPES.map((item) => item.code) } },
      orderBy: { code: 'asc' },
    });

    expect(muscleGroups).toHaveLength(MUSCLE_GROUPS.length);
    expect(equipmentTypes).toHaveLength(EQUIPMENT_TYPES.length);

    expect(muscleGroups.map((row) => row.code)).toEqual(
      [...MUSCLE_GROUPS].map((item) => item.code).sort(),
    );
    expect(equipmentTypes.map((row) => row.code)).toEqual(
      [...EQUIPMENT_TYPES].map((item) => item.code).sort(),
    );

    for (const expected of MUSCLE_GROUPS) {
      const row = muscleGroups.find((item) => item.code === expected.code);
      expect(row?.name).toBe(expected.name);
      expect(row?.parentId).toBeNull();
    }

    for (const expected of EQUIPMENT_TYPES) {
      const row = equipmentTypes.find((item) => item.code === expected.code);
      expect(row?.name).toBe(expected.name);
    }
  });

  it('does not create duplicates when the seed runs twice', async () => {
    const beforeMuscles = await prisma.muscleGroup.count();
    const beforeEquipment = await prisma.equipmentType.count();

    await seedReferenceData(prisma);

    expect(await prisma.muscleGroup.count()).toBe(beforeMuscles);
    expect(await prisma.equipmentType.count()).toBe(beforeEquipment);
  });

  it('GET /api/v1/reference/muscle-groups returns active ordered entries only', async () => {
    await prisma.muscleGroup.upsert({
      where: { code: 'test-inactive-muscle' },
      create: {
        code: 'test-inactive-muscle',
        name: 'Inactif',
        parentId: null,
        isActive: false,
      },
      update: {
        name: 'Inactif',
        isActive: false,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/reference/muscle-groups')
      .expect(200);

    expect(response.body).toEqual({
      data: expect.any(Array),
    });

    const codes = response.body.data.map((item: { code: string }) => item.code);
    expect(codes).toEqual([...codes].sort());
    expect(codes).not.toContain('test-inactive-muscle');

    for (const item of response.body.data) {
      expect(Object.keys(item).sort()).toEqual(['code', 'id', 'name', 'parentId']);
      expect(item).not.toHaveProperty('isActive');
      expect(item).not.toHaveProperty('createdAt');
      expect(item).not.toHaveProperty('updatedAt');
    }

    const chest = response.body.data.find(
      (item: { code: string }) => item.code === 'chest',
    );
    expect(chest).toMatchObject({
      code: 'chest',
      name: 'Pectoraux',
      parentId: null,
    });
    expect(typeof chest.id).toBe('string');
  });

  it('GET /api/v1/reference/equipment-types returns active ordered entries only', async () => {
    await prisma.equipmentType.upsert({
      where: { code: 'test-inactive-equipment' },
      create: {
        code: 'test-inactive-equipment',
        name: 'Inactif',
        isActive: false,
      },
      update: {
        name: 'Inactif',
        isActive: false,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/reference/equipment-types')
      .expect(200);

    expect(response.body).toEqual({
      data: expect.any(Array),
    });

    const codes = response.body.data.map((item: { code: string }) => item.code);
    expect(codes).toEqual([...codes].sort());
    expect(codes).not.toContain('test-inactive-equipment');

    for (const item of response.body.data) {
      expect(Object.keys(item).sort()).toEqual(['code', 'id', 'name']);
      expect(item).not.toHaveProperty('parentId');
      expect(item).not.toHaveProperty('isActive');
      expect(item).not.toHaveProperty('createdAt');
      expect(item).not.toHaveProperty('updatedAt');
    }

    const barbell = response.body.data.find(
      (item: { code: string }) => item.code === 'barbell',
    );
    expect(barbell).toMatchObject({
      code: 'barbell',
      name: 'Barre',
    });
    expect(typeof barbell.id).toBe('string');
  });
});
