import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { buildIntervalTemplateSets } from '@gym-companion/validation';

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

async function registerUser(app: INestApplication, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'Password123!',
      acceptedTermsVersion: '2026-08',
      displayName: 'Cardio',
    })
    .expect(201);
  return response.body.data.accessToken as string;
}

const intervalSets = buildIntervalTemplateSets({
  rounds: 2,
  work: { durationSeconds: 60, speedKmh: 8, inclinePercent: null },
  recovery: { durationSeconds: 60, speedKmh: 4, inclinePercent: null },
  warmupSeconds: 300,
  cooldownSeconds: null,
});

describe('Cardio intervals API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let programId = '';
  let templateId = '';
  let cardioTemplateExerciseId = '';
  let strengthTemplateExerciseId = '';

  beforeAll(async () => {
    applyTestEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    const config = app.get(AppConfigService);
    app.use(cookieParser(config.cookieSecret));
    app.useGlobalFilters(new GlobalExceptionFilter(config));
    await app.init();
    prisma = app.get(PrismaService);
    await seedReferenceData(prisma);
    await seedSystemExercises(prisma);

    const stamp = Date.now();
    tokenA = await registerUser(app, `cardio-a-${stamp}@example.com`);
    tokenB = await registerUser(app, `cardio-b-${stamp}@example.com`);

    const treadmill = await prisma.exercise.findUniqueOrThrow({
      where: { slug: 'course-tapis' },
    });
    const legPress = await prisma.exercise.findUniqueOrThrow({
      where: { slug: 'presse-cuisses' },
    });

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Cardio', goal: 'ENDURANCE' })
      .expect(201);
    programId = program.body.data.id;
    const withTemplate = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Fractionné' })
      .expect(201);
    templateId = withTemplate.body.data.workoutTemplates[0].id;

    for (const exerciseId of [treadmill.id, legPress.id]) {
      await request(app.getHttpServer())
        .post(`/api/v1/programs/${programId}/workout-templates/${templateId}/exercises`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ exerciseId, equipmentTypeId: null, restSecondsOverride: null, notes: null })
        .expect(201);
    }
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/programs/${programId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const exercises = detail.body.data.workoutTemplates[0].exercises as Array<{
      id: string;
      exercise: { id: string };
    }>;
    cardioTemplateExerciseId = exercises.find((item) => item.exercise.id === treadmill.id)!.id;
    strengthTemplateExerciseId = exercises.find((item) => item.exercise.id === legPress.id)!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function setsUrl(templateExerciseId: string) {
    return `/api/v1/programs/${programId}/workout-templates/${templateId}/exercises/${templateExerciseId}/sets`;
  }

  it('remplace les séries d’un exercice cardio par un fractionné', async () => {
    const response = await request(app.getHttpServer())
      .put(setsUrl(cardioTemplateExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ sets: intervalSets })
      .expect(200);

    const exercise = (
      response.body.data.workoutTemplates[0].exercises as Array<{
        id: string;
        sets: Array<{ position: number; setType: string; targetSpeedKmh: number | null }>;
      }>
    ).find((item) => item.id === cardioTemplateExerciseId)!;
    expect(exercise.sets.map((set) => set.setType)).toEqual([
      'WARMUP',
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
    ]);
    expect(exercise.sets.map((set) => set.position)).toEqual([0, 1, 2, 3, 4]);
    expect(exercise.sets[1]!.targetSpeedKmh).toBe(8);
    expect(exercise.sets[2]!.targetSpeedKmh).toBe(4);
  });

  it('refuse le fractionné sur un exercice de musculation, sans rien modifier', async () => {
    const before = await prisma.workoutTemplateSet.count({
      where: { workoutTemplateExerciseId: strengthTemplateExerciseId },
    });
    const refused = await request(app.getHttpServer())
      .put(setsUrl(strengthTemplateExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ sets: intervalSets })
      .expect(400);
    expect(refused.body.error.code).toBe('WORKOUT_TEMPLATE_SET_CARDIO_ONLY');
    expect(
      await prisma.workoutTemplateSet.count({
        where: { workoutTemplateExerciseId: strengthTemplateExerciseId },
      }),
    ).toBe(before);

    await request(app.getHttpServer())
      .put(setsUrl(cardioTemplateExerciseId))
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ sets: intervalSets })
      .expect(404);
  });

  it('modifie la vitesse d’une série cardio et la conserve aux mises à jour partielles', async () => {
    const cardioSet = await prisma.workoutTemplateSet.findFirstOrThrow({
      where: { workoutTemplateExerciseId: cardioTemplateExerciseId, setType: 'INTERVAL_WORK' },
    });
    await request(app.getHttpServer())
      .patch(`${setsUrl(cardioTemplateExerciseId)}/${cardioSet.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetSpeedKmh: 8.5, targetInclinePercent: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${setsUrl(cardioTemplateExerciseId)}/${cardioSet.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetDurationSeconds: 90 })
      .expect(200);
    const updated = await prisma.workoutTemplateSet.findUniqueOrThrow({
      where: { id: cardioSet.id },
    });
    expect(Number(updated.targetSpeedKmh)).toBe(8.5);
    expect(Number(updated.targetInclinePercent)).toBe(1);
    expect(updated.targetDurationSeconds).toBe(90);

    // remet la cible d’origine pour les tests suivants
    await request(app.getHttpServer())
      .patch(`${setsUrl(cardioTemplateExerciseId)}/${cardioSet.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetSpeedKmh: 8, targetInclinePercent: null, targetDurationSeconds: 60 })
      .expect(200);

    const refused = await request(app.getHttpServer())
      .post(setsUrl(strengthTemplateExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 8,
        targetRepMax: 12,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: null,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        restSeconds: 90,
        targetSpeedKmh: 8,
      })
      .expect(400);
    expect(refused.body.error.code).toBe('WORKOUT_TEMPLATE_SET_CARDIO_ONLY');

    // une série classique reste acceptée (et rend la séance démarrable)
    await request(app.getHttpServer())
      .post(setsUrl(strengthTemplateExerciseId))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        setType: 'WORKING',
        targetRepMin: 8,
        targetRepMax: 12,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetWeightKg: null,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        restSeconds: 90,
      })
      .expect(201);
  });

  it('copie le fractionné et les vitesses dans la séance démarrée', async () => {
    const started = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceWorkoutTemplateId: templateId,
        localDate: '2026-11-16',
        timezone: 'Europe/Paris',
      })
      .expect(201);
    const cardio = (
      started.body.data.exercises as Array<{
        cardioType: string | null;
        sets: Array<{ setType: string; targetSpeedKmh: number | null; targetRestSeconds: number | null }>;
      }>
    ).find((item) => item.cardioType === 'TREADMILL')!;
    expect(cardio.sets.map((set) => set.setType)).toContain('INTERVAL_WORK');
    expect(cardio.sets.find((set) => set.setType === 'INTERVAL_WORK')!.targetSpeedKmh).toBe(8);
    expect(cardio.sets.every((set) => set.targetRestSeconds === 0)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${started.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: started.body.data.version, reason: null })
      .expect((res) => {
        if (res.status >= 500) throw new Error(`cancel failed ${res.status}`);
      });
  });

  it('partage et importe le fractionné avec ses vitesses', async () => {
    const shared = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    const imported = await request(app.getHttpServer())
      .post(`/api/v1/shares/${shared.body.data.token}/import`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(201);
    const sets = await prisma.workoutTemplateSet.findMany({
      where: {
        workoutTemplateExercise: {
          workoutTemplate: { programId: imported.body.data.programId },
          exercise: { slug: 'course-tapis' },
        },
      },
      orderBy: { position: 'asc' },
    });
    expect(sets.map((set) => set.setType)).toEqual([
      'WARMUP',
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
    ]);
    expect(Number(sets[1]!.targetSpeedKmh)).toBe(8);
  });
});
