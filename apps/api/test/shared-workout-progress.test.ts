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
  return {
    token,
    userId: me.body.data.id as string,
    email,
  };
}

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
  setCount = 2,
) {
  const system = await prisma.exercise.findFirstOrThrow({
    where: {
      source: 'SYSTEM',
      archivedAt: null,
      measurementType: 'WEIGHT_REPS',
    },
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
  for (let i = 0; i < setCount; i += 1) {
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
  }
  return { programId, templateId };
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

async function inviteAndAccept(
  app: INestApplication,
  ownerToken: string,
  inviteeToken: string,
  roomId: string,
  inviteeEmail: string,
) {
  const invite = await request(app.getHttpServer())
    .post(`/api/v1/shared-workouts/${roomId}/invitations`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ inviteeEmail })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/v1/shared-workout-invitations/${invite.body.data.id}/accept`)
    .set('Authorization', `Bearer ${inviteeToken}`)
    .expect(200);
}

async function cancelActiveWorkout(
  app: INestApplication,
  token: string,
  workoutSessionId: string,
  expectedVersion: number,
) {
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${workoutSessionId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion,
      clientCommandId: randomUUID(),
      keepRecordedData: true,
      reason: 'test cleanup',
    })
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
  await cancelActiveWorkout(
    app,
    token,
    active.body.data.id,
    active.body.data.version,
  );
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
      // handleConnection JWT est async — laisser l’auth se terminer.
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
    const timer = setTimeout(() => reject(new Error(`ack timeout ${event}`)), 5000);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function privacyLeakPattern(): RegExp {
  return /actualWeightKg|actualReps|targetWeightKg|targetMinReps|targetMaxReps|"rir"|"rpe"|reachedFailure|externalVolume|notes/i;
}

describe('Shared workout progress (Shared 5.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
  let tokenA: string;
  let userIdA: string;
  let tokenB: string;
  let emailB: string;
  let tokenC: string;
  let templateA: string;
  let templateB: string;
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

    const a = await registerUser(app, `sw55-a-${stamp}@test.local`, 'Aurélien');
    const b = await registerUser(app, `sw55-b-${stamp}@test.local`, 'Thomas');
    const c = await registerUser(app, `sw55-c-${stamp}@test.local`, 'Outsider');
    tokenA = a.token;
    userIdA = a.userId;
    tokenB = b.token;
    emailB = b.email;
    tokenC = c.token;

    templateA = (await createStartableTemplate(app, tokenA, prisma, `A-${stamp}`, 2))
      .templateId;
    templateB = (await createStartableTemplate(app, tokenB, prisma, `B-${stamp}`, 2))
      .templateId;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await cancelAnyActiveWorkout(app, tokenA);
    await cancelAnyActiveWorkout(app, tokenB);
  });

  it('current exercise update + progress + privacy + context', async () => {
    const roomId = await createActiveRoom(app, tokenA, `Progress ${stamp}`);
    await inviteAndAccept(app, tokenA, tokenB, roomId, emailB);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateId: templateA })
      .expect(201);
    const sessionId = created.body.data.workoutSession.id as string;
    const exercise = created.body.data.workoutSession.exercises[0];
    expect(exercise).toBeTruthy();
    const exerciseId = exercise.id as string;
    const set0 = exercise.sets[0];
    const set1 = exercise.sets[1];
    expect(set0 && set1).toBeTruthy();

    const detailBefore = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ownerBefore = detailBefore.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdA,
    );
    expect(ownerBefore.memberWorkout.currentExercise).toBeNull();
    expect(ownerBefore.memberWorkout.progress).toMatchObject({
      processedSetCount: 0,
      totalSetCount: 2,
      processedExerciseCount: 0,
      totalExerciseCount: 1,
    });
    expect(JSON.stringify(detailBefore.body.data)).not.toMatch(
      privacyLeakPattern(),
    );

    const setCurrent = await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: exerciseId })
      .expect(200);
    expect(setCurrent.body.data.currentWorkoutSessionExerciseId).toBe(
      exerciseId,
    );

    // Idempotent
    const again = await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: exerciseId })
      .expect(200);
    expect(again.body.data.currentWorkoutSessionExerciseId).toBe(exerciseId);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const owner = detail.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdA,
    );
    expect(owner.memberWorkout.currentExercise).toMatchObject({
      name: exercise.exerciseName,
      processedSetCount: 0,
      totalSetCount: 2,
    });
    expect(owner.memberWorkout.currentExercise).not.toHaveProperty(
      'workoutSessionExerciseId',
    );
    expect(JSON.stringify(detail.body.data)).not.toMatch(privacyLeakPattern());

    // Cross-user: B cannot set A's exercise
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionExerciseId: exerciseId })
      .expect(400);

    // Context owner
    const ctx = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/by-workout-session/${sessionId}/context`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(ctx.body.data).toMatchObject({
      linked: true,
      room: { id: roomId, status: 'ACTIVE' },
      currentWorkoutSessionExerciseId: exerciseId,
    });

    // IDOR context
    await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/by-workout-session/${sessionId}/context`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/by-workout-session/${sessionId}/context`)
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(404);

    // Complete one set → progress 1/2
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/${set0.id}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 1,
      })
      .expect(200);

    const afterSet = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ownerAfter = afterSet.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdA,
    );
    expect(ownerAfter.memberWorkout.currentExercise.processedSetCount).toBe(1);
    expect(ownerAfter.memberWorkout.progress.processedSetCount).toBe(1);
    expect(JSON.stringify(afterSet.body.data)).not.toMatch(privacyLeakPattern());

    // Clear current exercise
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: null })
      .expect(200);

    const cleared = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ownerCleared = cleared.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdA,
    );
    expect(ownerCleared.memberWorkout.currentExercise).toBeNull();

    await cancelActiveWorkout(app, tokenA, sessionId, 2);
  }, 60_000);

  it('refuse cross-session exercise + room/workout states', async () => {
    const roomId = await createActiveRoom(app, tokenA, `States ${stamp}`);
    await inviteAndAccept(app, tokenA, tokenB, roomId, emailB);

    const createdA = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateId: templateA })
      .expect(201);
    const sessionId = createdA.body.data.workoutSession.id as string;
    const exerciseId = createdA.body.data.workoutSession.exercises[0].id as string;

    const createdB = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutTemplateId: templateB })
      .expect(201);
    const foreignExerciseId = createdB.body.data.workoutSession
      .exercises[0].id as string;
    const sessionB = createdB.body.data.workoutSession.id as string;

    // Cross-session / cross-user exercise → 404
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: foreignExerciseId })
      .expect(404);

    // PAUSED allowed
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/pause`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: 1,
        clientCommandId: randomUUID(),
      })
      .expect(200);
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: exerciseId })
      .expect(200);

    // Complete workout → refuse current exercise
    const beforeComplete = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        expectedVersion: beforeComplete.body.data.version,
        clientCommandId: randomUUID(),
      })
      .expect(200);

    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: exerciseId })
      .expect(400);

    const afterComplete = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const self = afterComplete.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdA,
    );
    expect(self.memberWorkout.status).toBe('COMPLETED');
    expect(self.memberWorkout.currentExercise).toBeNull();

    // LOBBY room refuse
    const lobby = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Lobby ${stamp}` })
      .expect(201);
    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${lobby.body.data.id}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionExerciseId: null })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_WORKOUT_ROOM_NOT_ACTIVE');
      });

    await cancelActiveWorkout(app, tokenB, sessionB, 1);
  }, 90_000);

  it('realtime current exercise + progress without noise', async () => {
    const roomId = await createActiveRoom(app, tokenA, `RT ${stamp}`);
    await inviteAndAccept(app, tokenA, tokenB, roomId, emailB);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutTemplateId: templateB })
      .expect(201);
    const sessionId = created.body.data.workoutSession.id as string;
    const exercise = created.body.data.workoutSession.exercises[0];
    const exerciseId = exercise.id as string;
    const set0 = exercise.sets[0];

    const socketA = await connectSocket(port, tokenA);
    const reasons: string[] = [];
    socketA.on('room:changed', (payload: { reason: string }) => {
      reasons.push(payload.reason);
    });
    const ack = await emitAck<{ ok: boolean; code?: string; message?: string }>(
      socketA,
      'room:subscribe',
      { roomId },
    );
    expect(ack, JSON.stringify(ack)).toMatchObject({ ok: true });

    await request(app.getHttpServer())
      .patch(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `RT renamed ${stamp}` })
      .expect(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(reasons).toContain('RENAMED');

    await request(app.getHttpServer())
      .put(
        `/api/v1/shared-workouts/${roomId}/my-workout-session/current-exercise`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionExerciseId: exerciseId })
      .expect(200);
    await new Promise((r) => setTimeout(r, 150));
    expect(reasons).toContain('MEMBER_CURRENT_EXERCISE_CHANGED');

    const beforeProgress = reasons.filter(
      (r) => r === 'MEMBER_WORKOUT_PROGRESS_CHANGED',
    ).length;

    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/${set0.id}`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 50,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 1,
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 80));
    expect(
      reasons.filter((r) => r === 'MEMBER_WORKOUT_PROGRESS_CHANGED').length,
    ).toBe(beforeProgress + 1);

    // Same processed status, change reps only → no progress event
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/${set0.id}`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 50,
        actualReps: 9,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 2,
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 80));
    expect(
      reasons.filter((r) => r === 'MEMBER_WORKOUT_PROGRESS_CHANGED').length,
    ).toBe(beforeProgress + 1);

    // Room complete → further set updates do not broadcast
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const progressAfterComplete = reasons.filter(
      (r) => r === 'MEMBER_WORKOUT_PROGRESS_CHANGED',
    ).length;
    const set1 = exercise.sets[1];
    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${exerciseId}/sets/${set1.id}`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 50,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 3,
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 80));
    expect(
      reasons.filter((r) => r === 'MEMBER_WORKOUT_PROGRESS_CHANGED').length,
    ).toBe(progressAfterComplete);

    socketA.disconnect();
    await cancelActiveWorkout(app, tokenB, sessionId, 4);
  }, 90_000);

  it('leave stops progress broadcast; unlinked context', async () => {
    const roomId = await createActiveRoom(app, tokenA, `Leave ${stamp}`);
    await inviteAndAccept(app, tokenA, tokenB, roomId, emailB);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutTemplateId: templateB })
      .expect(201);
    const sessionId = created.body.data.workoutSession.id as string;
    const exercise = created.body.data.workoutSession.exercises[0];

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const socketA = await connectSocket(port, tokenA);
    const reasons: string[] = [];
    socketA.on('room:changed', (payload: { reason: string }) => {
      reasons.push(payload.reason);
    });
    const ack = await emitAck<{ ok: boolean }>(socketA, 'room:subscribe', {
      roomId,
    });
    expect(ack.ok).toBe(true);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/workouts/${sessionId}/exercises/${exercise.id}/sets/${exercise.sets[0].id}`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        status: 'COMPLETED',
        actualWeightKg: 40,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
        expectedVersion: 1,
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 80));
    expect(reasons).not.toContain('MEMBER_WORKOUT_PROGRESS_CHANGED');

    // Context for left member: linked=false (membership inactive)
    const ctx = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/by-workout-session/${sessionId}/context`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(ctx.body.data.linked).toBe(false);

    socketA.disconnect();
    await cancelActiveWorkout(app, tokenB, sessionId, 2);
  }, 60_000);
});
