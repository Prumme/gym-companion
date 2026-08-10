import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

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
  const token = response.body.data.accessToken as string;
  const me = await request(app.getHttpServer())
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return {
    token,
    userId: me.body.data.id as string,
  };
}

describe('Shared workout rooms API (Shared 5.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let userIdA: string;
  let tokenB: string;
  let userIdB: string;
  const stamp = Date.now();

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
    const a = await registerUser(app, `sw-a-${stamp}@test.local`, 'Owner A');
    const b = await registerUser(app, `sw-b-${stamp}@test.local`, 'Member B');
    tokenA = a.token;
    userIdA = a.userId;
    tokenB = b.token;
    userIdB = b.userId;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('crée une room avec membership OWNER transactionnel', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: '  Salle Alpha  ' })
      .expect(201);

    expect(created.body.data.name).toBe('Salle Alpha');
    expect(created.body.data.status).toBe('LOBBY');
    expect(created.body.data.owner.userId).toBe(userIdA);
    expect(created.body.data.members).toHaveLength(1);
    expect(created.body.data.members[0].role).toBe('OWNER');
    expect(created.body.data.isOwner).toBe(true);
    expect(created.body.data).not.toHaveProperty('email');

    const members = await prisma.sharedWorkoutRoomMember.findMany({
      where: { roomId: created.body.data.id },
    });
    expect(members).toHaveLength(1);
  });

  it('fallback nom + isolation IDOR + member read/mutate', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);
    const roomId = created.body.data.id as string;
    expect(created.body.data.name).toBe('Séance partagée');

    await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clientCommandId: randomUUID() })
      .expect(404);

    await prisma.sharedWorkoutRoomMember.create({
      data: {
        roomId,
        userId: userIdB,
        role: 'MEMBER',
      },
    });

    const asMember = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(asMember.body.data.isOwner).toBe(false);
    expect(asMember.body.data.members).toHaveLength(2);

    await request(app.getHttpServer())
      .patch(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hack' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clientCommandId: randomUUID() })
      .expect(403);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(
      listB.body.data.some((item: { id: string }) => item.id === roomId),
    ).toBe(true);
  });

  it('lifecycle start/complete/cancel + timestamps + idempotence', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Flow ${stamp}` })
      .expect(201);
    const roomId = created.body.data.id as string;

    const startId = randomUUID();
    const started = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: startId })
      .expect(200);
    expect(started.body.data.status).toBe('ACTIVE');
    expect(started.body.data.startedAt).toBeTruthy();

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: startId })
      .expect(200);
    expect(replay.body.data.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: startId })
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: startId })
      .expect(409);
    expect(conflict.body.error.code).toBe(
      'SHARED_WORKOUT_ROOM_COMMAND_CONFLICT',
    );

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.completedAt).toBeTruthy();
    expect(completed.body.data.cancelledAt).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Terminée' })
      .expect(400);

    const sessionsBefore = await prisma.workoutSession.count({
      where: { ownerUserId: userIdA },
    });

    const lobby = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Cancel lobby ${stamp}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${lobby.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('CANCELLED');
        expect(res.body.data.cancelledAt).toBeTruthy();
      });

    const active = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Cancel active ${stamp}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${active.body.data.id}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${active.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const sessionsAfter = await prisma.workoutSession.count({
      where: { ownerUserId: userIdA },
    });
    expect(sessionsAfter).toBe(sessionsBefore);
  });

  it('concurrence complete vs cancel sur ACTIVE — un seul gagnant', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Race ${stamp}` })
      .expect(201);
    const roomId = created.body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const [completeRes, cancelRes] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/shared-workouts/${roomId}/complete`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clientCommandId: randomUUID() }),
      request(app.getHttpServer())
        .post(`/api/v1/shared-workouts/${roomId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clientCommandId: randomUUID() }),
    ]);

    const statuses = [completeRes.status, cancelRes.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(
      statuses.every((s) => s === 200 || s === 400 || s === 409),
    ).toBe(true);

    const room = await prisma.sharedWorkoutRoom.findUniqueOrThrow({
      where: { id: roomId },
    });
    expect(['COMPLETED', 'CANCELLED']).toContain(room.status);
    if (room.status === 'COMPLETED') {
      expect(room.completedAt).toBeTruthy();
      expect(room.cancelledAt).toBeNull();
    } else {
      expect(room.cancelledAt).toBeTruthy();
      expect(room.completedAt).toBeNull();
    }
  });

  it('refuse LOBBY → COMPLETE et liste filtrée', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `List ${stamp}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${created.body.data.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(400);

    const list = await request(app.getHttpServer())
      .get('/api/v1/shared-workouts?status=LOBBY')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      list.body.data.every(
        (item: { status: string }) => item.status === 'LOBBY',
      ),
    ).toBe(true);
  });
});
