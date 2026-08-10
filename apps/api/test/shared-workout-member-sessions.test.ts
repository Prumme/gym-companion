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
  return { token, userId: me.body.data.id as string };
}

async function createStartableTemplate(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  name: string,
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

async function completeActiveWorkout(
  app: INestApplication,
  token: string,
  workoutSessionId: string,
  expectedVersion: number,
) {
  await request(app.getHttpServer())
    .post(`/api/v1/workouts/${workoutSessionId}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      expectedVersion,
      clientCommandId: randomUUID(),
    })
    .expect(200);
}

describe('Shared workout member sessions (Shared 5.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let userIdA: string;
  let tokenB: string;
  let userIdB: string;
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
    await app.init();
    prisma = app.get(PrismaService);
    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);
    const a = await registerUser(app, `sw54-a-${stamp}@test.local`, 'Owner A');
    const b = await registerUser(app, `sw54-b-${stamp}@test.local`, 'Member B');
    const c = await registerUser(app, `sw54-c-${stamp}@test.local`, 'Outsider C');
    tokenA = a.token;
    userIdA = a.userId;
    tokenB = b.token;
    userIdB = b.userId;
    tokenC = c.token;
    templateA = (await createStartableTemplate(app, tokenA, prisma, 'A')).templateId;
    templateB = (await createStartableTemplate(app, tokenB, prisma, 'B')).templateId;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  it('refuse attach/create en LOBBY', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Lobby only' })
      .expect(201);
    const roomId = created.body.data.id as string;

    const session = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-10',
        timezone: 'Europe/Paris',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionId: session.body.data.id })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_WORKOUT_ROOM_NOT_ACTIVE');
      });

    await cancelActiveWorkout(app, tokenA, session.body.data.id, 1);
  });

  it('attach ACTIVE + détail membre + IDOR + unicité room', async () => {
    const roomId = await createActiveRoom(app, tokenA, 'Attach room');

    // Invite B
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: `sw54-b-${stamp}@test.local` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workout-invitations/${invite.body.data.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const session = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-10',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    const sessionId = session.body.data.id as string;

    const attached = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionId: sessionId })
      .expect(200);
    expect(attached.body.data.linked).toBe(true);
    expect(attached.body.data.workoutSession.id).toBe(sessionId);

    // Idempotent re-attach
    const again = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionId: sessionId })
      .expect(200);
    expect(again.body.data.workoutSession.id).toBe(sessionId);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ownerMember = detail.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdA,
    );
    expect(ownerMember.memberWorkout.status).toBe('ACTIVE');
    expect(ownerMember.memberWorkout.workoutName).toBeTruthy();
    expect(detail.body.data.myWorkoutSessionId).toBeNull();
    expect(JSON.stringify(detail.body.data)).not.toMatch(/actualWeightKg|actualReps|rir|rpe/i);

    // B cannot attach A's session
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionId: sessionId })
      .expect(404);

    // Outsider
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ workoutSessionId: sessionId })
      .expect(404);

    // Second room — same session conflict
    const room2 = await createActiveRoom(app, tokenA, 'Second room');
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${room2}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionId: sessionId })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_WORKOUT_SESSION_ALREADY_LINKED');
      });

    // Room complete does not complete workout
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);
    const stillActive = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(stillActive.body.data.status).toBe('ACTIVE');

    await completeActiveWorkout(
      app,
      tokenA,
      sessionId,
      stillActive.body.data.version,
    );
  });

  it('create depuis room atomique + leave independence + rejoin', async () => {
    const roomId = await createActiveRoom(app, tokenA, 'Create room');
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: `sw54-b-${stamp}@test.local` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workout-invitations/${invite.body.data.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutTemplateId: templateB })
      .expect(201);

    expect(created.body.data.mySession.linked).toBe(true);
    const workoutId = created.body.data.workoutSession.id as string;
    expect(created.body.data.workoutSession.status).toBe('ACTIVE');
    expect(created.body.data.workoutSession.exercises.length).toBeGreaterThan(0);

    // Duplicate create blocked
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutTemplateId: templateB })
      .expect(409);

    // Leave keeps workout
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const afterLeave = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(afterLeave.body.data.status).toBe('ACTIVE');

    const links = await prisma.sharedWorkoutRoomMemberSession.count({
      where: { workoutSessionId: workoutId },
    });
    expect(links).toBe(1);

    // Rejoin via new invite
    const invite2 = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: `sw54-b-${stamp}@test.local` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workout-invitations/${invite2.body.data.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const my = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}/my-workout-session`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(my.body.data.linked).toBe(true);
    expect(my.body.data.workoutSession.id).toBe(workoutId);

    const linkCount = await prisma.sharedWorkoutRoomMemberSession.count({
      where: {
        roomMember: { roomId, userId: userIdB },
      },
    });
    expect(linkCount).toBe(1);

    await cancelActiveWorkout(
      app,
      tokenB,
      workoutId,
      afterLeave.body.data.version,
    );
  });

  it('refuse attach séance terminale + template étranger', async () => {
    const roomId = await createActiveRoom(app, tokenA, 'Terminal attach');
    const session = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateA,
        localDate: '2026-08-10',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    await completeActiveWorkout(app, tokenA, session.body.data.id, 1);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionId: session.body.data.id })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARED_WORKOUT_SESSION_NOT_ATTACHABLE');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/create`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutTemplateId: templateB })
      .expect(404);
  });

  it('attach PAUSED autorisé — ownership, unicité, lifecycle inchangé', async () => {
    const roomId = await createActiveRoom(app, tokenA, 'Paused attach');

    const invite = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: `sw54-b-${stamp}@test.local` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workout-invitations/${invite.body.data.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const session = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        sourceWorkoutTemplateId: templateB,
        localDate: '2026-08-10',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    const sessionId = session.body.data.id as string;
    const version = session.body.data.version as number;

    const paused = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${sessionId}/pause`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ expectedVersion: version, clientCommandId: randomUUID() })
      .expect(200);
    expect(paused.body.data.workoutSession.status).toBe('PAUSED');
    const pausedVersion = paused.body.data.workoutSessionVersion as number;

    // Ownership : A ne peut pas rattacher la séance PAUSED de B.
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workoutSessionId: sessionId })
      .expect(404);

    const attached = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionId: sessionId })
      .expect(200);
    expect(attached.body.data.linked).toBe(true);
    expect(attached.body.data.workoutSession.id).toBe(sessionId);
    expect(attached.body.data.workoutSession.status).toBe('PAUSED');

    const afterAttach = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${sessionId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(afterAttach.body.data.status).toBe('PAUSED');
    expect(afterAttach.body.data.version).toBe(pausedVersion);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const memberB = detail.body.data.members.find(
      (m: { userId: string }) => m.userId === userIdB,
    );
    expect(memberB.memberWorkout.status).toBe('PAUSED');
    expect(memberB.memberWorkout.workoutName).toBeTruthy();
    expect(JSON.stringify(detail.body.data)).not.toMatch(
      /actualWeightKg|actualReps|"rir"|"rpe"/i,
    );

    const linkCount = await prisma.sharedWorkoutRoomMemberSession.count({
      where: {
        roomMember: { roomId, userId: userIdB },
      },
    });
    expect(linkCount).toBe(1);

    // Unicité : second attach d’une autre séance bloqué.
    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/my-workout-session/attach`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ workoutSessionId: randomUUID() })
      .expect(409);

    await cancelActiveWorkout(app, tokenB, sessionId, pausedVersion);
  });
});
