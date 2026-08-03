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

async function createProgram(
  app: INestApplication,
  token: string,
  name: string,
) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/programs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, goal: 'HYPERTROPHY' })
    .expect(201);
  return response.body.data.id as string;
}

async function createTemplate(
  app: INestApplication,
  token: string,
  programId: string,
  name: string,
) {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/programs/${programId}/workout-templates`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name })
    .expect(201);
  const templates = response.body.data.workoutTemplates as Array<{
    id: string;
    name: string;
  }>;
  return templates.find((item) => item.name === name)!.id;
}

describe('Program activation and schedule API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  const emailA = `act-a-${Date.now()}@example.com`;
  const emailB = `act-b-${Date.now()}@example.com`;
  let programA1 = '';
  let programA2 = '';
  let templateA = '';
  let templateB = '';

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

    tokenA = await registerUser(app, emailA, 'Act A');
    tokenB = await registerUser(app, emailB, 'Act B');
    userAId = (
      await prisma.user.findUniqueOrThrow({ where: { email: emailA } })
    ).id;

    programA1 = await createProgram(app, tokenA, 'Programme A1');
    programA2 = await createProgram(app, tokenA, 'Programme A2');
    templateA = await createTemplate(app, tokenA, programA1, 'Push');
    templateB = await createTemplate(app, tokenA, programA1, 'Pull');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for active and schedule', async () => {
    await request(app.getHttpServer()).get('/api/v1/programs/active').expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/programs/${programA1}/schedule`)
      .expect(401);
  });

  it('returns null when no current program', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/programs/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(response.body.data).toBeNull();
  });

  it('activates a program and exposes startedOn as local date', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-03', replaceCurrentProgram: false })
      .expect(200);

    expect(response.body.data.startedOn).toBe('2026-08-03');
    expect(response.body.data.program.id).toBe(programA1);
    expect(response.body.data.program.isCurrent).toBe(true);
    expect(response.body.data.program.status).toBe('ACTIVE');
    expect(response.body.data.program.permissions.canDeactivate).toBe(true);
    expect(response.body.data.program.permissions.canArchive).toBe(false);
    expect(response.body.data).not.toHaveProperty('userId');

    const active = await request(app.getHttpServer())
      .get('/api/v1/programs/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(active.body.data.program.id).toBe(programA1);

    const count = await prisma.programActivation.count({
      where: { userId: userAId, endedOn: null },
    });
    expect(count).toBe(1);
  });

  it('is idempotent when activating the same program', async () => {
    const before = await prisma.programActivation.count({
      where: { userId: userAId },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-03', replaceCurrentProgram: false })
      .expect(200);
    expect(response.body.data.program.id).toBe(programA1);
    const after = await prisma.programActivation.count({
      where: { userId: userAId },
    });
    expect(after).toBe(before);
  });

  it('rejects foreign program activation with neutral 404', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/activate`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ startedOn: '2026-08-03', replaceCurrentProgram: false })
      .expect(404);
  });

  it('rejects archived program activation', async () => {
    const archivedId = await createProgram(app, tokenA, 'Archivé bientôt');
    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${archivedId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/programs/${archivedId}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-03', replaceCurrentProgram: false })
      .expect(400);
    expect(response.body.error.code).toBe('PROGRAM_ARCHIVED');
  });

  it('conflicts when another program is current without replace', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA2}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-04', replaceCurrentProgram: false })
      .expect(409);
    expect(response.body.error.code).toBe('PROGRAM_ACTIVE_CONFLICT');
  });

  it('replaces the current program explicitly', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA2}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-04', replaceCurrentProgram: true })
      .expect(200);

    expect(response.body.data.program.id).toBe(programA2);
    const currentCount = await prisma.programActivation.count({
      where: { userId: userAId, endedOn: null },
    });
    expect(currentCount).toBe(1);

    const ended = await prisma.programActivation.findFirst({
      where: { userId: userAId, programId: programA1, endedOn: { not: null } },
    });
    expect(ended).toBeTruthy();

    const previous = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programA1}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(previous.body.data.isCurrent).toBe(false);
    expect(previous.body.data.status).toBe('DRAFT');
  });

  it('refuses to archive the current program', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/programs/${programA2}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(409);
    expect(response.body.error.code).toBe(
      'PROGRAM_MUST_BE_INACTIVE_BEFORE_ARCHIVE',
    );
  });

  it('reads empty schedule and replaces it', async () => {
    const empty = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(empty.body.data.entries).toEqual([]);

    const replaced = await request(app.getHttpServer())
      .put(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entries: [
          { workoutTemplateId: templateA, weekday: 'MONDAY', position: 0 },
          { workoutTemplateId: templateB, weekday: 'MONDAY', position: 1 },
          { workoutTemplateId: templateA, weekday: 'THURSDAY', position: 0 },
        ],
      })
      .expect(200);

    expect(replaced.body.data.entries).toHaveLength(3);
    expect(replaced.body.data.entries[0].weekday).toBe('MONDAY');
    expect(replaced.body.data.entries[0].position).toBe(0);
    expect(replaced.body.data.entries[1].position).toBe(1);
  });

  it('rejects invalid schedule positions and foreign templates', async () => {
    const hole = await request(app.getHttpServer())
      .put(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entries: [
          { workoutTemplateId: templateA, weekday: 'TUESDAY', position: 1 },
        ],
      })
      .expect(400);
    expect(hole.body.error.code).toBe('PROGRAM_SCHEDULE_INVALID_POSITION');

    const foreignTemplate = await createTemplate(
      app,
      tokenA,
      programA2,
      'Other',
    );
    const mismatch = await request(app.getHttpServer())
      .put(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entries: [
          {
            workoutTemplateId: foreignTemplate,
            weekday: 'WEDNESDAY',
            position: 0,
          },
        ],
      })
      .expect(400);
    expect(mismatch.body.error.code).toBe('PROGRAM_SCHEDULE_TEMPLATE_MISMATCH');
  });

  it('hides schedule of another user', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('keeps schedule after deactivate and restore on reactivate', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-05', replaceCurrentProgram: true })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/deactivate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const active = await request(app.getHttpServer())
      .get('/api/v1/programs/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(active.body.data).toBeNull();

    const schedule = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(schedule.body.data.entries.length).toBeGreaterThan(0);

    const reactivated = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-06', replaceCurrentProgram: false })
      .expect(200);
    expect(reactivated.body.data.schedule.entries.length).toBe(
      schedule.body.data.entries.length,
    );
  });

  it('second deactivate is idempotent', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/deactivate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programA1}/deactivate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(second.body.data).toBeNull();
  });

  it('cleans schedule entries when deleting a planned template', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entries: [
          { workoutTemplateId: templateA, weekday: 'FRIDAY', position: 0 },
          { workoutTemplateId: templateB, weekday: 'FRIDAY', position: 1 },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${programA1}/workout-templates/${templateA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const schedule = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programA1}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(
      schedule.body.data.entries.every(
        (entry: { workoutTemplate: { id: string } }) =>
          entry.workoutTemplate.id !== templateA,
      ),
    ).toBe(true);
    const friday = schedule.body.data.entries.filter(
      (entry: { weekday: string }) => entry.weekday === 'FRIDAY',
    );
    expect(friday).toHaveLength(1);
    expect(friday[0].position).toBe(0);
    expect(friday[0].workoutTemplate.id).toBe(templateB);
  });

  it('rejects schedule mutation on archived program', async () => {
    const id = await createProgram(app, tokenA, 'Pour archive schedule');
    await request(app.getHttpServer())
      .delete(`/api/v1/programs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/programs/${id}/schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ entries: [] })
      .expect(403);
  });

  it('prevents two concurrent current activations via unique index', async () => {
    const programX = await createProgram(app, tokenA, 'Concurrent X');
    const programY = await createProgram(app, tokenA, 'Concurrent Y');
    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programX}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-08-07', replaceCurrentProgram: true })
      .expect(200);

    await expect(
      prisma.$transaction([
        prisma.programActivation.create({
          data: {
            userId: userAId,
            programId: programY,
            startedOn: new Date(Date.UTC(2026, 7, 8)),
            endedOn: null,
          },
        }),
      ]),
    ).rejects.toThrow();

    const currentCount = await prisma.programActivation.count({
      where: { userId: userAId, endedOn: null },
    });
    expect(currentCount).toBe(1);
  });
});
