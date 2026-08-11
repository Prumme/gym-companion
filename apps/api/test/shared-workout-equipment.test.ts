import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
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

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
  equipmentCode?: string,
) {
  const system = await prisma.exercise.findFirstOrThrow({
    where: {
      source: 'SYSTEM',
      archivedAt: null,
      measurementType: 'WEIGHT_REPS',
      ...(equipmentCode
        ? { defaultEquipmentType: { code: equipmentCode } }
        : { defaultEquipmentTypeId: { not: null } }),
    },
    include: { defaultEquipmentType: true },
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
  return {
    templateId,
    equipmentCode: system.defaultEquipmentType?.code ?? null,
  };
}

async function createActiveRoom(
  app: INestApplication,
  ownerToken: string,
  name: string,
) {
  const created = await request(app.getHttpServer())
    .post('/api/v1/shared-workouts')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name })
    .expect(201);
  const roomId = created.body.data.id as string;
  await request(app.getHttpServer())
    .post(`/api/v1/shared-workouts/${roomId}/start`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ clientCommandId: randomUUID() })
    .expect(200);
  return roomId;
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

async function cancelAnyActiveWorkout(
  app: INestApplication,
  token: string,
) {
  const active = await request(app.getHttpServer())
    .get('/api/v1/workouts/active')
    .set('Authorization', `Bearer ${token}`);
  if (active.status !== 200 || !active.body?.data) return;
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${active.body.data.id}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion: active.body.data.version,
      clientCommandId: randomUUID(),
      keepRecordedData: true,
      reason: 'cleanup',
    })
    .expect(200);
}

async function attachCreatedSession(
  app: INestApplication,
  token: string,
  roomId: string,
  templateId: string,
) {
  const created = await request(app.getHttpServer())
    .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
    .set('Authorization', `Bearer ${token}`)
    .send({ workoutTemplateId: templateId })
    .expect(201);
  const session = created.body.data.workoutSession;
  const exerciseId = session.exercises[0].id as string;
  await request(app.getHttpServer())
    .put(
      `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({ workoutSessionExerciseId: exerciseId })
    .expect(200);
  return { sessionId: session.id as string, exerciseId, session };
}

function connectSocket(port: number, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(
      `http://127.0.0.1:${port}${SHARED_WORKOUT_SOCKET_NAMESPACE}`,
      {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        timeout: 5000,
      },
    );
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('socket connect timeout'));
    }, 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      setTimeout(() => resolve(socket), 30);
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`ack timeout ${event}`)),
      5000,
    );
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

describe('Shared equipment coordination (Shared 5.6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let userIdB: string;
  let templateA: string;
  let templateB: string;
  let templateC: string;
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

    const a = await registerUser(app, `sw56-a-${stamp}@test.local`, 'Aurélien');
    const b = await registerUser(app, `sw56-b-${stamp}@test.local`, 'Thomas');
    const c = await registerUser(app, `sw56-c-${stamp}@test.local`, 'Alice');
    tokenA = a.token;
    tokenB = b.token;
    tokenC = c.token;
    userIdB = b.userId;

    templateA = (await createStartableTemplate(app, tokenA, prisma, `A-${stamp}`, 'cable'))
      .templateId;
    templateB = (await createStartableTemplate(app, tokenB, prisma, `B-${stamp}`, 'cable'))
      .templateId;
    templateC = (await createStartableTemplate(app, tokenC, prisma, `C-${stamp}`, 'machine'))
      .templateId;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await cancelAnyActiveWorkout(app, tokenA);
    await cancelAnyActiveWorkout(app, tokenB);
    await cancelAnyActiveWorkout(app, tokenC);
  });

  it('request libre → USING ; concurrent → 1 USING + WAITING ; release FIFO', async () => {
    const roomId = await createActiveRoom(app, tokenA, `Eq ${stamp}`);
    await joinWithCode(app, tokenA, tokenB, roomId);
    await joinWithCode(app, tokenA, tokenC, roomId);

    await attachCreatedSession(app, tokenA, roomId, templateA);
    await attachCreatedSession(app, tokenB, roomId, templateB);
    await attachCreatedSession(app, tokenC, roomId, templateC);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clientCommandId: randomUUID() }),
      request(app.getHttpServer())
        .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ clientCommandId: randomUUID() }),
    ]);
    expect([resA.status, resB.status].every((s) => s === 200)).toBe(true);

    const states = [resA.body.data, resB.body.data];
    const usingCount = states.filter((s: { state: string }) => s.state === 'USING').length;
    const waitingCount = states.filter((s: { state: string }) => s.state === 'WAITING').length;
    expect(usingCount).toBe(1);
    expect(waitingCount).toBe(1);

    // C on different equipment → USING immediately
    const resC = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    expect(resC.body.data.state).toBe('USING');

    const coord = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/equipment-coordination`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(JSON.stringify(coord.body.data)).not.toMatch(
      /actualWeight|actualReps|"rir"|"rpe"|email/i,
    );

    const usingA = states.find((s: { state: string }) => s.state === 'USING');
    const waitingB = states.find((s: { state: string }) => s.state === 'WAITING');
    expect(usingA && waitingB).toBeTruthy();

    const releaserToken = usingA === resA.body.data ? tokenA : tokenB;
    const waiterToken = waitingB === resA.body.data ? tokenA : tokenB;

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/release`)
      .set('Authorization', `Bearer ${releaserToken}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/my-equipment`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(200);
    expect(after.body.data.state).toBe('USING');
  }, 90_000);

  it('refuse change exercise while USING different equipment ; WAITING cancel on change', async () => {
    const roomId = await createActiveRoom(app, tokenA, `Change ${stamp}`);
    await joinWithCode(app, tokenA, tokenB, roomId);

    const a = await attachCreatedSession(app, tokenA, roomId, templateA);
    await attachCreatedSession(app, tokenB, roomId, templateB);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    // B WAITING — change exercise to null cancels waiting
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionExerciseId: null })
      .expect(200);

    const bAfter = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/my-equipment`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(bAfter.body.data.state).toBe('NONE');

    // A USING — cannot clear current exercise
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: null })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_EQUIPMENT_STILL_USING');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/release`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: a.exerciseId })
      .expect(200);
  }, 90_000);

  it('leave USING promotes next ; socket disconnect does not release', async () => {
    const roomId = await createActiveRoom(app, tokenA, `Leave ${stamp}`);
    await joinWithCode(app, tokenA, tokenB, roomId);

    await attachCreatedSession(app, tokenA, roomId, templateA);
    await attachCreatedSession(app, tokenB, roomId, templateB);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const socketB = await connectSocket(port, tokenB);
    const ack = await emitAck<{ ok: boolean }>(socketB, 'room:subscribe', {
      roomId,
    });
    expect(ack.ok).toBe(true);
    socketB.disconnect();
    await new Promise((r) => setTimeout(r, 50));

    const stillUsing = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/my-equipment`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(stillUsing.body.data.state).toBe('USING');

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const aNow = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/my-equipment`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(aNow.body.data.state).toBe('USING');
  }, 90_000);

  it('room complete clears queues without promotion ; outsider 404 ; forged equipment rejected', async () => {
    const roomId = await createActiveRoom(app, tokenA, `Term ${stamp}`);
    await joinWithCode(app, tokenA, tokenB, roomId);
    await attachCreatedSession(app, tokenA, roomId, templateA);
    await attachCreatedSession(app, tokenB, roomId, templateB);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        clientCommandId: randomUUID(),
        equipmentTypeId: randomUUID(),
      })
      .expect(400);

    const outsider = await registerUser(
      app,
      `sw56-out-${stamp}@test.local`,
      'Out',
    );
    await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/equipment-coordination`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(400);

    const active = await prisma.sharedWorkoutEquipmentQueueEntry.count({
      where: {
        roomId,
        status: { in: ['USING', 'WAITING'] },
      },
    });
    expect(active).toBe(0);
  }, 90_000);

  it('race leave vs release — membership left, no active entry, max 1 USING', async () => {
    const roomId = await createActiveRoom(app, tokenA, `LeaveRace ${stamp}`);
    await joinWithCode(app, tokenA, tokenB, roomId);
    // Même équipement logique (cable) : A WAITING pendant que B USING.
    await attachCreatedSession(app, tokenA, roomId, templateA);
    const sessionB = await attachCreatedSession(app, tokenB, roomId, templateB);

    const bUser = { id: userIdB };
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.state).toBe('USING');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.state).toBe('WAITING');
      });

    const [leaveRes, releaseRes] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/shared-workouts/${roomId}/leave`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/api/v1/shared-workouts/${roomId}/my-equipment/release`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ clientCommandId: randomUUID() }),
    ]);

    // Leave doit réussir ; release peut 200 (avant leave) ou 4xx (après leave).
    expect(leaveRes.status).toBe(200);
    expect([200, 400, 403, 404]).toContain(releaseRes.status);

    const membership = await prisma.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId: bUser.id },
    });
    expect(membership?.leftAt).not.toBeNull();

    const bActive = await prisma.sharedWorkoutEquipmentQueueEntry.count({
      where: {
        roomId,
        roomMemberId: membership!.id,
        status: { in: ['WAITING', 'USING'] },
      },
    });
    expect(bActive).toBe(0);

    const usingCount = await prisma.sharedWorkoutEquipmentQueueEntry.count({
      where: { roomId, status: 'USING' },
    });
    expect(usingCount).toBeLessThanOrEqual(1);

    const aState = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/my-equipment`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    // FIFO : A était WAITING #1 → promu USING après départ/release de B.
    expect(aState.body.data.state).toBe('USING');

    const workout = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionB.sessionId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(workout.body.data.status).toBe('ACTIVE');
  }, 90_000);

  it('realtime EQUIPMENT_COORDINATION_CHANGED on request/release', async () => {
    const roomId = await createActiveRoom(app, tokenA, `RT eq ${stamp}`);
    await joinWithCode(app, tokenA, tokenB, roomId);
    await attachCreatedSession(app, tokenA, roomId, templateA);
    await attachCreatedSession(app, tokenB, roomId, templateB);

    const socketB = await connectSocket(port, tokenB);
    const reasons: string[] = [];
    socketB.on('room:changed', (payload: { reason: string }) => {
      reasons.push(payload.reason);
    });
    const ack = await emitAck<{ ok: boolean }>(socketB, 'room:subscribe', {
      roomId,
    });
    expect(ack.ok).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/request`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await new Promise((r) => setTimeout(r, 120));
    expect(reasons).toContain('EQUIPMENT_COORDINATION_CHANGED');

    socketB.disconnect();
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-equipment/release`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
  }, 60_000);
});
