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
    email,
  };
}

async function createRoom(
  app: INestApplication,
  ownerToken: string,
  name: string,
) {
  const created = await request(app.getHttpServer())
    .post('/api/v1/shared-workouts')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name })
    .expect(201);
  return {
    roomId: created.body.data.id as string,
    joinCode: created.body.data.joinCode as string,
  };
}

async function getOwnerJoinCode(
  app: INestApplication,
  ownerToken: string,
  roomId: string,
) {
  const detail = await request(app.getHttpServer())
    .get(`/api/v1/shared-workouts/${roomId}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  return detail.body.data.joinCode as string;
}

async function joinWithCode(
  app: INestApplication,
  ownerToken: string,
  memberToken: string,
  roomId: string,
) {
  const joinCode = await getOwnerJoinCode(app, ownerToken, roomId);
  await request(app.getHttpServer())
    .post('/api/v1/shared-workouts/join')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ code: joinCode })
    .expect(200);
}

describe('Shared workout join code API (Shared 5.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userIdB: string;
  let tokenC: string;
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
    const a = await registerUser(app, `swjc-a-${stamp}@test.local`, 'Owner A');
    const b = await registerUser(app, `swjc-b-${stamp}@test.local`, 'Member B');
    const c = await registerUser(app, `swjc-c-${stamp}@test.local`, 'User C');
    tokenA = a.token;
    tokenB = b.token;
    userIdB = b.userId;
    tokenC = c.token;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('create room exposes formatted join code to owner only', async () => {
    const { roomId, joinCode } = await createRoom(
      app,
      tokenA,
      `Create code ${stamp}`,
    );
    expect(joinCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);

    const ownerDetail = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(ownerDetail.body.data.joinCode).toBe(joinCode);
    expect(ownerDetail.body.data.isOwner).toBe(true);
  });

  it('join with valid code (format normalization) adds member', async () => {
    const { roomId } = await createRoom(app, tokenA, `Join valid ${stamp}`);
    const joinCode = await getOwnerJoinCode(app, tokenA, roomId);
    const sessionsBefore = await prisma.workoutSession.count({
      where: { ownerUserId: userIdB },
    });

    const joined = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode.toLowerCase().replace('-', '') })
      .expect(200);
    expect(joined.body.data.id).toBe(roomId);
    expect(joined.body.data.joinCode).toBeNull();
    expect(joined.body.data.members).toHaveLength(2);
    expect(
      joined.body.data.members.some(
        (m: { userId: string; role: string }) =>
          m.userId === userIdB && m.role === 'MEMBER',
      ),
    ).toBe(true);

    const sessionsAfter = await prisma.workoutSession.count({
      where: { ownerUserId: userIdB },
    });
    expect(sessionsAfter).toBe(sessionsBefore);
  });

  it('invalid / unknown code returns neutral 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: 'ABC' })
      .expect(404);
    expect(res.body.error.code).toBe('SHARED_WORKOUT_JOIN_CODE_INVALID');
    expect(res.body.error.message).toBe('Code invalide ou expiré.');

    const unknown = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: 'ZZZ-ZZZ' })
      .expect(404);
    expect(unknown.body.error.code).toBe('SHARED_WORKOUT_JOIN_CODE_INVALID');
  });

  it('terminal room rejects join with neutral 404', async () => {
    const { roomId } = await createRoom(app, tokenA, `Terminal ${stamp}`);
    const joinCode = await getOwnerJoinCode(app, tokenA, roomId);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode })
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_WORKOUT_JOIN_CODE_INVALID');
      });
  });

  it('existing member and owner join are idempotent', async () => {
    const { roomId } = await createRoom(app, tokenA, `Idempotent ${stamp}`);
    const joinCode = await getOwnerJoinCode(app, tokenA, roomId);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode })
      .expect(200);

    const ownerAgain = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: joinCode })
      .expect(200);
    expect(ownerAgain.body.data.isOwner).toBe(true);
    expect(ownerAgain.body.data.members).toHaveLength(2);
  });

  it('leave / rejoin via code', async () => {
    const { roomId } = await createRoom(app, tokenA, `Rejoin ${stamp}`);
    const joinCode = await getOwnerJoinCode(app, tokenA, roomId);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(
      listB.body.data.some((item: { id: string }) => item.id === roomId),
    ).toBe(false);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode })
      .expect(200);

    const members = await prisma.sharedWorkoutRoomMember.findMany({
      where: { roomId, userId: userIdB },
    });
    expect(members).toHaveLength(1);
    expect(members[0]?.leftAt).toBeNull();
    expect(members[0]?.role).toBe('MEMBER');
  });

  it('rotate join code — owner only, invalidates old code', async () => {
    const { roomId } = await createRoom(app, tokenA, `Rotate ${stamp}`);
    const oldCode = await getOwnerJoinCode(app, tokenA, roomId);

    await joinWithCode(app, tokenA, tokenB, roomId);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/join-code/rotate`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    const rotated = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/join-code/rotate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(rotated.body.data.joinCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(rotated.body.data.joinCode).not.toBe(oldCode);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ code: oldCode })
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ code: rotated.body.data.joinCode })
      .expect(200);
  });

  it('rotate forbidden on terminal room', async () => {
    const { roomId } = await createRoom(app, tokenA, `Rotate terminal ${stamp}`);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/join-code/rotate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_WORKOUT_ROOM_INVALID_STATUS');
      });
  });

  it('member detail never exposes join code', async () => {
    const { roomId } = await createRoom(app, tokenA, `Member privacy ${stamp}`);
    const joinCode = await getOwnerJoinCode(app, tokenA, roomId);

    await request(app.getHttpServer())
      .post('/api/v1/shared-workouts/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: joinCode })
      .expect(200);

    const memberDetail = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(memberDetail.body.data.joinCode).toBeNull();
    expect(memberDetail.body.data.isOwner).toBe(false);
  });
});
