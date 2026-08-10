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

describe('Shared workout invitations API (Shared 5.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let emailA: string;
  let tokenB: string;
  let userIdB: string;
  let emailB: string;
  let tokenC: string;
  let emailC: string;
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
    const a = await registerUser(app, `sw2-a-${stamp}@test.local`, 'Owner A');
    const b = await registerUser(app, `sw2-b-${stamp}@test.local`, 'Member B');
    const c = await registerUser(app, `sw2-c-${stamp}@test.local`, 'User C');
    tokenA = a.token;
    emailA = a.email;
    tokenB = b.token;
    userIdB = b.userId;
    emailB = b.email;
    tokenC = c.token;
    emailC = c.email;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  async function createRoom(name: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/shared-workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name })
      .expect(201);
    return created.body.data.id as string;
  }

  it('invite / decline / reinvite / accept / leave / rejoin', async () => {
    const roomId = await createRoom(`Invite flow ${stamp}`);
    const sessionsBefore = await prisma.workoutSession.count({
      where: { ownerUserId: userIdB },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ inviteeEmail: emailC })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailA })
      .expect(400);

    const invite1 = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: `  ${emailB.toUpperCase()}  ` })
      .expect(201);
    expect(invite1.body.data.status).toBe('PENDING');
    expect(invite1.body.data).not.toHaveProperty('email');
    expect(invite1.body.data.invitee).not.toHaveProperty('email');

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(409);

    const received = await request(app.getHttpServer())
      .get('/api/v1/shared-workout-invitations?status=PENDING')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(
      received.body.data.some((item: { id: string }) => item.id === invite1.body.data.id),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite1.body.data.id}/decline`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('DECLINED');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite1.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(409);

    const invite2 = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite2.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(404);

    const accepted = await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite2.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite2.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const detailB = await request(app.getHttpServer())
      .get(`/api/v1/shared-workouts/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(detailB.body.data.members).toHaveLength(2);
    expect(
      detailB.body.data.members.some(
        (m: { userId: string; role: string }) =>
          m.userId === userIdB && m.role === 'MEMBER',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/leave`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

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

    const invite3 = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite3.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const members = await prisma.sharedWorkoutRoomMember.findMany({
      where: { roomId, userId: userIdB },
    });
    expect(members).toHaveLength(1);
    expect(members[0]?.leftAt).toBeNull();
    expect(members[0]?.role).toBe('MEMBER');

    const sessionsAfter = await prisma.workoutSession.count({
      where: { ownerUserId: userIdB },
    });
    expect(sessionsAfter).toBe(sessionsBefore);
  });

  it('cancel invitation + terminal room cancels PENDING', async () => {
    const roomId = await createRoom(`Cancel invites ${stamp}`);
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workouts/${roomId}/invitations/${invite.body.data.id}/cancel`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workouts/${roomId}/invitations/${invite.body.data.id}/cancel`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('CANCELLED');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invite.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(409);

    const invitePending = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailC })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const stillPending = await prisma.sharedWorkoutRoomInvitation.findUniqueOrThrow(
      { where: { id: invitePending.body.data.id } },
    );
    expect(stillPending.status).toBe('PENDING');

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientCommandId: randomUUID() })
      .expect(200);

    const cancelled = await prisma.sharedWorkoutRoomInvitation.findUniqueOrThrow(
      { where: { id: invitePending.body.data.id } },
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(
        `/api/v1/shared-workout-invitations/${invitePending.body.data.id}/accept`,
      )
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(400);
  });

  it('accept vs cancel concurrence — un seul gagnant cohérent', async () => {
    const roomId = await createRoom(`Race invite ${stamp}`);
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: emailB })
      .expect(201);
    const invitationId = invite.body.data.id as string;

    const [acceptRes, cancelRes] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/shared-workout-invitations/${invitationId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`),
      request(app.getHttpServer())
        .post(
          `/api/v1/shared-workouts/${roomId}/invitations/${invitationId}/cancel`,
        )
        .set('Authorization', `Bearer ${tokenA}`),
    ]);

    const statuses = [acceptRes.status, cancelRes.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);

    const invitation = await prisma.sharedWorkoutRoomInvitation.findUniqueOrThrow(
      { where: { id: invitationId } },
    );
    const member = await prisma.sharedWorkoutRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: userIdB } },
    });

    if (invitation.status === 'ACCEPTED') {
      expect(member?.leftAt).toBeNull();
      expect(member?.role).toBe('MEMBER');
    } else {
      expect(invitation.status).toBe('CANCELLED');
      expect(member == null || member.leftAt != null).toBe(true);
    }
  });

  it('utilisateur inexistant → erreur générique (anti-énumération)', async () => {
    const roomId = await createRoom(`Enum ${stamp}`);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/shared-workouts/${roomId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ inviteeEmail: `nobody-${stamp}@test.local` })
      .expect(400);
    expect(res.body.error.code).toBe('SHARED_WORKOUT_INVITATION_CANNOT_CREATE');
  });
});
