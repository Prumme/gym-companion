import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { SHARED_WORKOUT_SOCKET_NAMESPACE } from '@gym-companion/shared';

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
  return { token, userId: me.body.data.id as string, email };
}

async function joinWithCode(
  app: INestApplication,
  ownerToken: string,
  memberToken: string,
  roomId: string,
) {
  const detail = await request(app.getHttpServer())
    .get(`/api/v1/shared-workouts/${roomId}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  const joinCode = detail.body.data.joinCode as string;
  await request(app.getHttpServer())
    .post('/api/v1/shared-workouts/join')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ code: joinCode })
    .expect(200);
}

function connectSocket(port: number, token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}${SHARED_WORKOUT_SOCKET_NAMESPACE}`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('socket connect timeout'));
    }, 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function emitAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (ack: T) => resolve(ack));
  });
}

describe('Shared workout realtime gateway (Shared 5.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
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
    await app.listen(0);
    const address = app.getHttpServer().address();
    port =
      typeof address === 'object' && address && 'port' in address
        ? address.port
        : 0;
    prisma = app.get(PrismaService);
    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);
    const a = await registerUser(app, `sw3-a-${stamp}@test.local`, 'Owner A');
    const b = await registerUser(app, `sw3-b-${stamp}@test.local`, 'Member B');
    tokenA = a.token;
    userIdA = a.userId;
    tokenB = b.token;
    userIdB = b.userId;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('refuse connexion sans token valide', async () => {
    await new Promise<void>((resolve, reject) => {
      const socket = io(
        `http://127.0.0.1:${port}${SHARED_WORKOUT_SOCKET_NAMESPACE}`,
        {
          auth: {},
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
          timeout: 4000,
        },
      );
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('expected disconnect'));
      }, 4000);
      socket.on('disconnect', () => {
        clearTimeout(timer);
        expect(socket.connected).toBe(false);
        resolve();
      });
      socket.on('connect_error', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });

  it('subscribe owner/member, multi-tab, outsider, rename/start events', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `RT ${stamp}` })
      .expect(201);
    const roomId = created.body.data.id as string;

    await joinWithCode(app, tokenA, tokenB, roomId);

    const socketA = await connectSocket(port, tokenA);
    const socketB1 = await connectSocket(port, tokenB);
    const socketB2 = await connectSocket(port, tokenB);

    const joinedA: string[] = [];
    const leftA: string[] = [];
    const changedA: string[] = [];
    socketA.on('presence:joined', (e: { userId: string }) =>
      joinedA.push(e.userId),
    );
    socketA.on('presence:left', (e: { userId: string }) =>
      leftA.push(e.userId),
    );
    socketA.on('room:changed', (e: { reason: string }) =>
      changedA.push(e.reason),
    );

    const ackA = await emitAck<{
      ok: boolean;
      presence: { connectedUserIds: string[] };
    }>(socketA, 'room:subscribe', { roomId });
    expect(ackA.ok).toBe(true);
    expect(ackA.presence.connectedUserIds).toContain(userIdA);

    const ackB1 = await emitAck<{ ok: boolean }>(socketB1, 'room:subscribe', {
      roomId,
    });
    expect(ackB1.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(joinedA).toContain(userIdB);

    const ackB2 = await emitAck<{ ok: boolean }>(socketB2, 'room:subscribe', {
      roomId,
    });
    expect(ackB2.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(joinedA.filter((id) => id === userIdB)).toHaveLength(1);

    socketB1.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    expect(leftA.filter((id) => id === userIdB)).toHaveLength(0);

    socketB2.disconnect();
    await new Promise((r) => setTimeout(r, 80));
    expect(leftA).toContain(userIdB);

    const outsider = await connectSocket(port, tokenB);
    // tokenB is member - use a third user? Use invalid room or create C
    // For outsider: subscribe with B after leave
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const denied = await emitAck<{ ok: boolean; code?: string }>(
      outsider,
      'room:subscribe',
      { roomId },
    );
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe('ROOM_NOT_ACCESSIBLE');
    outsider.disconnect();

    // Re-join B for remaining tests
    await joinWithCode(app, tokenA, tokenB, roomId);
    expect(changedA).toContain('MEMBER_JOINED');

    const socketB = await connectSocket(port, tokenB);
    await emitAck(socketB, 'room:subscribe', { roomId });

    await request(app.getHttpServer())
      .patch(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Renamed ${stamp}` })
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(changedA).toContain('RENAMED');

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(changedA).toContain('STARTED');

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(changedA).toContain('COMPLETED');

    const afterComplete = await emitAck<{ ok: boolean; code?: string }>(
      socketB,
      'room:subscribe',
      { roomId },
    );
    expect(afterComplete.ok).toBe(false);

    // historique REST toujours lisible
    await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    socketA.disconnect();
    socketB.disconnect();
  }, 60_000);

  it('MEMBER_WORKOUT_CHANGED after create ; failed attach emits nothing', async () => {
    const system = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'WEIGHT_REPS',
      },
    });
    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: `Prog RT ${stamp}`, goal: 'HYPERTROPHY' })
      .expect(201);
    const programId = program.body.data.id as string;
    const tpl = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: `Séance RT ${stamp}` })
      .expect(201);
    const templateId = tpl.body.data.workoutTemplates[0].id as string;
    const ex = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
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
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 8,
        targetRepMax: 10,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: 50,
        targetIntensityPercent: null,
        targetRir: 2,
        targetRpe: null,
        restSeconds: 90,
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `MWC ${stamp}` })
      .expect(201);
    const roomId = created.body.data.id as string;

    await joinWithCode(app, tokenA, tokenB, roomId);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const socketA = await connectSocket(port, tokenA);
    const socketB = await connectSocket(port, tokenB);
    const payloads: Array<Record<string, unknown>> = [];
    socketA.on('room:changed', (e: Record<string, unknown>) => {
      payloads.push(e);
    });

    await emitAck(socketA, 'room:subscribe', { roomId });
    await emitAck(socketB, 'room:subscribe', { roomId });
    payloads.length = 0;

    // Mutation échouée : B tente d’attacher une séance inexistante / étrangère.
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionId: randomUUID() })
      .expect(404);
    await new Promise((r) => setTimeout(r, 80));
    expect(
      payloads.some((p) => p.reason === 'MEMBER_WORKOUT_CHANGED'),
    ).toBe(false);

    const createdSession = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutTemplateId: templateId })
      .expect(201);
    const workoutId = createdSession.body.data.workoutSession.id as string;

    await new Promise((r) => setTimeout(r, 120));
    const mwc = payloads.filter((p) => p.reason === 'MEMBER_WORKOUT_CHANGED');
    expect(mwc.length).toBeGreaterThanOrEqual(1);
    const event = mwc[0]!;
    expect(event.roomId).toBe(roomId);
    expect(event.reason).toBe('MEMBER_WORKOUT_CHANGED');
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(
      /actualWeight|actualReps|"rir"|"rpe"|targetWeight|notes|email/i,
    );
    expect(event).not.toHaveProperty('workoutSession');
    expect(event).not.toHaveProperty('sets');
    expect(event).not.toHaveProperty('progress');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const memberB = detail.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdB,
    );
    expect(memberB.memberWorkout.status).toBe('ACTIVE');
    expect(memberB.memberWorkout.workoutName).toBeTruthy();
    expect(detail.body.data.myWorkoutSessionId).toBeNull();
    expect(JSON.stringify(detail.body.data)).not.toMatch(
      /actualWeightKg|actualReps|"rir"|"rpe"/i,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${workoutId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        expectedVersion: createdSession.body.data.workoutSession.version,
        clientCommandId: randomUUID(),
        keepRecordedData: true,
        reason: 'cleanup',
      })
      .expect(200);

    socketA.disconnect();
    socketB.disconnect();
  }, 90_000);
});
