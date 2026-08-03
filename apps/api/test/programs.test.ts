import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';

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

describe('Programs API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  const emailA = `prog-a-${Date.now()}@example.com`;
  const emailB = `prog-b-${Date.now()}@example.com`;
  let programId = '';
  let templateIds: string[] = [];

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

    tokenA = await registerUser(app, emailA, 'Prog A');
    tokenB = await registerUser(app, emailB, 'Prog B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/programs').expect(401);
  });

  it('creates a program owned by the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Programme force',
        description: '',
        goal: 'STRENGTH',
      })
      .expect(201);

    const data = response.body.data;
    programId = data.id;
    expect(data.name).toBe('Programme force');
    expect(data.description).toBeNull();
    expect(data.goal).toBe('STRENGTH');
    expect(data.status).toBe('DRAFT');
    expect(data.workoutTemplates).toEqual([]);
    expect(data).not.toHaveProperty('ownerUserId');
    expect(data.permissions).toEqual({
      canEdit: true,
      canArchive: true,
      canRestore: false,
    });

    const row = await prisma.program.findUniqueOrThrow({ where: { id: programId } });
    const userA = await prisma.user.findUniqueOrThrow({ where: { email: emailA } });
    expect(row.ownerUserId).toBe(userA.id);
  });

  it('lists only the current user programs', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Programme B', goal: 'HYPERTROPHY' })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(listA.body.data.every((item: { id: string }) => item.id !== undefined)).toBe(
      true,
    );
    expect(listA.body.data.some((item: { id: string }) => item.id === programId)).toBe(
      true,
    );
    expect(
      listA.body.data.every((item: { name: string }) => item.name !== 'Programme B'),
    ).toBe(true);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(listB.body.data.some((item: { id: string }) => item.id === programId)).toBe(
      false,
    );
  });

  it('returns detail to owner and hides it from another user', async () => {
    const ok = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(ok.body.data.id).toBe(programId);

    await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('updates a program for the owner only', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Programme force 2', description: 'Desc' })
      .expect(200);
    expect(updated.body.data.name).toBe('Programme force 2');
    expect(updated.body.data.description).toBe('Desc');

    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hack' })
      .expect(404);
  });

  it('creates workout templates at the end with compact 0-based positions', async () => {
    for (const name of ['Séance A', 'Séance B', 'Séance C']) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/programs/${programId}/workout-templates`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name })
        .expect(201);
      templateIds = response.body.data.workoutTemplates.map(
        (item: { id: string }) => item.id,
      );
    }

    expect(templateIds).toHaveLength(3);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      detail.body.data.workoutTemplates.map(
        (item: { name: string; position: number; exerciseCount: number }) => ({
          name: item.name,
          position: item.position,
          exerciseCount: item.exerciseCount,
        }),
      ),
    ).toEqual([
      { name: 'Séance A', position: 0, exerciseCount: 0 },
      { name: 'Séance B', position: 1, exerciseCount: 0 },
      { name: 'Séance C', position: 2, exerciseCount: 0 },
    ]);
  });

  it('updates a template and rejects foreign program/user access', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programId}/workout-templates/${templateIds[1]}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Séance B renommée', estimatedDurationMinutes: 50 })
      .expect(200);
    expect(
      updated.body.data.workoutTemplates.find(
        (item: { id: string }) => item.id === templateIds[1],
      ),
    ).toMatchObject({
      name: 'Séance B renommée',
      estimatedDurationMinutes: 50,
    });

    const otherProgram = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Autre', goal: 'ENDURANCE' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/programs/${otherProgram.body.data.id}/workout-templates/${templateIds[0]}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Nope' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programId}/workout-templates/${templateIds[0]}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Nope' })
      .expect(404);
  });

  it('reorders templates and rejects invalid orders', async () => {
    const [a, b, c] = templateIds;
    const reordered = await request(app.getHttpServer())
      .put(`/api/v1/programs/${programId}/workout-templates/order`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateIds: [c, a, b] })
      .expect(200);
    expect(
      reordered.body.data.workoutTemplates.map((item: { id: string }) => item.id),
    ).toEqual([c, a, b]);
    expect(
      reordered.body.data.workoutTemplates.map(
        (item: { position: number }) => item.position,
      ),
    ).toEqual([0, 1, 2]);

    await request(app.getHttpServer())
      .put(`/api/v1/programs/${programId}/workout-templates/order`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateIds: [a, a, b] })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/programs/${programId}/workout-templates/order`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateIds: [a, b] })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/programs/${programId}/workout-templates/order`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        workoutTemplateIds: [a, b, 'dddddddd-dddd-dddd-dddd-dddddddddddd'],
      })
      .expect(400);
  });

  it('deletes a template and compacts positions', async () => {
    const current = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const ids = current.body.data.workoutTemplates.map(
      (item: { id: string }) => item.id,
    ) as string[];
    const middleId = ids[1]!;

    const afterDelete = await request(app.getHttpServer())
      .delete(`/api/v1/programs/${programId}/workout-templates/${middleId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(afterDelete.body.data.workoutTemplates).toHaveLength(2);
    expect(
      afterDelete.body.data.workoutTemplates.map(
        (item: { position: number }) => item.position,
      ),
    ).toEqual([0, 1]);
    expect(
      afterDelete.body.data.workoutTemplates.some(
        (item: { id: string }) => item.id === middleId,
      ),
    ).toBe(false);

    const remaining = await prisma.workoutTemplate.count({
      where: { programId },
    });
    expect(remaining).toBe(2);
  });

  it('archives, hides from default list, forbids edits, then restores', async () => {
    const archived = await request(app.getHttpServer())
      .delete(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(archived.body.data.archivedAt).toBeTruthy();
    expect(archived.body.data.status).toBe('ARCHIVED');
    expect(archived.body.data.permissions).toEqual({
      canEdit: false,
      canArchive: false,
      canRestore: true,
    });

    const defaultList = await request(app.getHttpServer())
      .get('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      defaultList.body.data.some((item: { id: string }) => item.id === programId),
    ).toBe(false);

    const withArchived = await request(app.getHttpServer())
      .get('/api/v1/programs?includeArchived=true')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      withArchived.body.data.some((item: { id: string }) => item.id === programId),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bloqué' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bloqué' })
      .expect(403);

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/restore`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(restored.body.data.archivedAt).toBeNull();
    expect(restored.body.data.status).toBe('DRAFT');
    expect(restored.body.data.permissions.canEdit).toBe(true);
  });

  it('paginates stably', async () => {
    for (let index = 0; index < 3; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Page ${index}`, goal: 'GENERAL_FITNESS' })
        .expect(201);
    }

    const first = await request(app.getHttpServer())
      .get('/api/v1/programs?limit=2')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.pagination.hasMore).toBe(true);
    expect(first.body.pagination.nextCursor).toBeTruthy();

    const second = await request(app.getHttpServer())
      .get(`/api/v1/programs?limit=2&cursor=${first.body.pagination.nextCursor}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const firstIds = new Set(
      first.body.data.map((item: { id: string }) => item.id),
    );
    expect(
      second.body.data.every((item: { id: string }) => !firstIds.has(item.id)),
    ).toBe(true);
  });
});
