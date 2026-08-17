import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { TRAINING_SHARE_LIFETIME_MS } from '@gym-companion/validation';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { TrainingSharesService } from '../src/modules/training-shares/training-shares.service';
import { hashTrainingShareToken } from '../src/modules/training-shares/training-share-snapshot';

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

describe('Training shares API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sharesService: TrainingSharesService;
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let userAId: string;
  let systemExerciseId: string;
  let systemExerciseId2: string;
  let chest: { id: string };
  let machine: { id: string };

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
    sharesService = app.get(TrainingSharesService);

    const stamp = Date.now();
    const emailA = `share-a-${stamp}@example.com`;
    tokenA = await registerUser(app, emailA, 'Share A');
    tokenB = await registerUser(app, `share-b-${stamp}@example.com`, 'Share B');
    tokenC = await registerUser(app, `share-c-${stamp}@example.com`, 'Share C');

    const userA = await prisma.user.findUniqueOrThrow({ where: { email: emailA } });
    userAId = userA.id;

    const exercises = await prisma.exercise.findMany({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'WEIGHT_REPS',
      },
      take: 2,
      orderBy: { slug: 'asc' },
    });
    expect(exercises.length).toBeGreaterThanOrEqual(2);
    systemExerciseId = exercises[0]!.id;
    systemExerciseId2 = exercises[1]!.id;

    chest = await prisma.muscleGroup.findFirstOrThrow({
      where: { code: 'chest' },
    });
    machine = await prisma.equipmentType.findFirstOrThrow({
      where: { code: 'machine' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createProgramWithWorkout(token: string, name: string) {
    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, goal: 'HYPERTROPHY', description: 'Desc partage' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .post(`/api/v1/programs/${program.body.data.id}/workout-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Full Body A', estimatedDurationMinutes: 45 })
      .expect(201);

    const templateId = detail.body.data.workoutTemplates[0].id as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${program.body.data.id}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseId: systemExerciseId,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(201);

    const afterExercise = await request(app.getHttpServer())
      .get(`/api/v1/programs/${program.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const templateExerciseId = afterExercise.body.data.workoutTemplates[0]
      .exercises[0].id as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${program.body.data.id}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 8,
        targetRepMax: 12,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: null,
        targetIntensityPercent: null,
        targetRir: 2,
        targetRpe: null,
        restSeconds: 90,
      })
      .expect(201);

    return {
      programId: program.body.data.id as string,
      templateId,
    };
  }

  it('owner crée un share programme → token + expiresAt +1h ; hash ≠ token', async () => {
    const { programId } = await createProgramWithWorkout(
      tokenA,
      'Programme partage A',
    );

    const before = Date.now();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    const data = response.body.data;
    expect(data.kind).toBe('PROGRAM');
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThanOrEqual(32);
    expect(data.expiresAt).toBeTruthy();

    const expiresAt = new Date(data.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + TRAINING_SHARE_LIFETIME_MS - 2000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + TRAINING_SHARE_LIFETIME_MS + 2000);

    const row = await prisma.trainingShareLink.findUniqueOrThrow({
      where: { tokenHash: hashTrainingShareToken(data.token) },
    });
    expect(row.tokenHash).not.toBe(data.token);
    expect(row.createdByUserId).toBe(userAId);
    expect(row.snapshot).toMatchObject({
      version: 1,
      kind: 'PROGRAM',
      name: 'Programme partage A',
    });
    expect(JSON.stringify(row.snapshot)).not.toContain(userAId);
  });

  it('non-owner ne peut pas créer de share → 404', async () => {
    const { programId } = await createProgramWithWorkout(
      tokenA,
      'Programme privé',
    );
    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('refuse le partage si exercice PERSONAL', async () => {
    const personal = await prisma.exercise.create({
      data: {
        ownerUserId: userAId,
        source: 'USER',
        name: `Perso share ${Date.now()}`,
        normalizedName: `perso share ${Date.now()}`,
        primaryMuscleGroupId: chest.id,
        measurementType: 'WEIGHT_REPS',
        defaultEquipmentTypeId: machine.id,
      },
    });

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Avec perso', goal: 'STRENGTH' })
      .expect(201);
    const programId = program.body.data.id as string;

    const withTemplate = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Séance perso' })
      .expect(201);
    const templateId = withTemplate.body.data.workoutTemplates[0].id as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exerciseId: personal.id,
        equipmentTypeId: null,
        restSecondsOverride: null,
        notes: null,
      })
      .expect(201);

    const refused = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    expect(refused.body.error.code).toBe('TRAINING_SHARE_PERSONAL_EXERCISE');
  });

  it('preview public + import programme (copie DRAFT, source inchangé)', async () => {
    const { programId } = await createProgramWithWorkout(
      tokenA,
      'Source immuable',
    );
    const share = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    const token = share.body.data.token as string;

    const preview = await request(app.getHttpServer())
      .get(`/api/v1/shares/${token}`)
      .expect(200);
    expect(preview.body.data.kind).toBe('PROGRAM');
    expect(preview.body.data.preview.name).toBe('Source immuable');
    expect(preview.body.data.preview.workoutCount).toBe(1);
    expect(preview.body.data).not.toHaveProperty('createdByUserId');
    expect(preview.body.data).not.toHaveProperty('tokenHash');

    const imported = await request(app.getHttpServer())
      .post(`/api/v1/shares/${token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(201);

    expect(imported.body.data.kind).toBe('PROGRAM');
    expect(imported.body.data.programId).not.toBe(programId);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${imported.body.data.programId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(detail.body.data.status).toBe('DRAFT');
    expect(detail.body.data.isCurrent).toBe(false);
    expect(detail.body.data.workoutTemplates).toHaveLength(1);
    expect(detail.body.data.workoutTemplates[0].exercises).toHaveLength(1);
    expect(detail.body.data.workoutTemplates[0].exercises[0].sets).toHaveLength(
      1,
    );
    expect(
      detail.body.data.workoutTemplates[0].exercises[0].sets[0].targetRepMin,
    ).toBe(8);

    const source = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(source.body.data.name).toBe('Source immuable');

    const schedule = await prisma.programScheduleEntry.count({
      where: { programId: imported.body.data.programId },
    });
    expect(schedule).toBe(0);
    const activations = await prisma.programActivation.count({
      where: { programId: imported.body.data.programId },
    });
    expect(activations).toBe(0);
  });

  it('snapshot immutable après modification de la source', async () => {
    const { programId } = await createProgramWithWorkout(
      tokenA,
      'Avant modif',
    );
    const share = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Après modif' })
      .expect(200);

    const imported = await request(app.getHttpServer())
      .post(`/api/v1/shares/${share.body.data.token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${imported.body.data.programId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(detail.body.data.name).toBe('Avant modif');
  });

  it('multi-user : B et C importent indépendamment', async () => {
    const { programId } = await createProgramWithWorkout(
      tokenA,
      'Multi import',
    );
    const share = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    const token = share.body.data.token as string;

    const b = await request(app.getHttpServer())
      .post(`/api/v1/shares/${token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(201);
    const c = await request(app.getHttpServer())
      .post(`/api/v1/shares/${token}/import`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({})
      .expect(201);

    expect(b.body.data.programId).not.toBe(c.body.data.programId);

    await request(app.getHttpServer())
      .patch(`/api/v1/programs/${b.body.data.programId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Modifié par B' })
      .expect(200);

    const cDetail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${c.body.data.programId}`)
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(200);
    expect(cDetail.body.data.name).toBe('Multi import');

    const aDetail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(aDetail.body.data.name).toBe('Multi import');
  });

  it('share workout template → import NEW_PROGRAM et EXISTING_PROGRAM', async () => {
    const { programId, templateId } = await createProgramWithWorkout(
      tokenA,
      'Conteneur séance',
    );

    const share = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/share`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(share.body.data.kind).toBe('WORKOUT_TEMPLATE');

    const newProg = await request(app.getHttpServer())
      .post(`/api/v1/shares/${share.body.data.token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        destination: {
          type: 'NEW_PROGRAM',
          programName: 'Programme Full Body A',
        },
      })
      .expect(201);
    expect(newProg.body.data.workoutTemplateId).toBeTruthy();

    const dest = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Dest existant', goal: 'GENERAL_FITNESS' })
      .expect(201);

    const existing = await request(app.getHttpServer())
      .post(`/api/v1/shares/${share.body.data.token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        destination: {
          type: 'EXISTING_PROGRAM',
          programId: dest.body.data.id,
        },
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${dest.body.data.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(detail.body.data.workoutTemplates.some(
      (t: { id: string }) => t.id === existing.body.data.workoutTemplateId,
    )).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/shares/${share.body.data.token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        destination: {
          type: 'EXISTING_PROGRAM',
          programId: programId,
        },
      })
      .expect(404);
  });

  it('token invalide → 404 ; expiration → 410', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/shares/this-token-is-totally-invalid-xx')
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('SHARE_LINK_INVALID');
      });

    const { programId } = await createProgramWithWorkout(
      tokenA,
      'Expire bientôt',
    );
    const share = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    const token = share.body.data.token as string;
    const expiresAt = new Date(share.body.data.expiresAt);

    const justBefore = new Date(expiresAt.getTime() - 1);
    await sharesService.getPreview(token, justBefore);

    const atExpiry = new Date(expiresAt.getTime());
    await expect(sharesService.getPreview(token, atExpiry)).rejects.toMatchObject({
      response: { code: 'SHARE_LINK_EXPIRED' },
    });

    await expect(
      sharesService.importShareAt(userAId, token, {}, atExpiry),
    ).rejects.toMatchObject({
      response: { code: 'SHARE_LINK_EXPIRED' },
    });

    // HTTP 410
    await prisma.trainingShareLink.update({
      where: { tokenHash: hashTrainingShareToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const gone = await request(app.getHttpServer())
      .get(`/api/v1/shares/${token}`)
      .expect(410);
    expect(gone.body.error.code).toBe('SHARE_LINK_EXPIRED');
  });

  it('import refuse destination absente pour WORKOUT_TEMPLATE', async () => {
    const { programId, templateId } = await createProgramWithWorkout(
      tokenA,
      'Séance seule',
    );
    const share = await request(app.getHttpServer())
      .post(
        `/api/v1/programs/${programId}/workout-templates/${templateId}/share`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/shares/${share.body.data.token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('TRAINING_SHARE_DESTINATION_REQUIRED');
  });

  // silence unused second exercise id for lint if not used elsewhere
  it('catalogue SYSTEM prêt', () => {
    expect(systemExerciseId2).toBeTruthy();
  });
});
