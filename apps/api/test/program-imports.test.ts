import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
  process.env.AI_COACH_ENABLED = 'false';
  process.env.AI_COACH_PROVIDER = 'none';
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

function weightSet(repsMin = 8, repsMax = 10) {
  return { repsMin, repsMax, rir: 2, restSeconds: 120 };
}

describe('Program imports API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let weightSlug: string;
  let weightExerciseId: string;
  let durationSlug: string;
  let distanceSlug: string;
  let bodyweightSlug: string;
  let chestId: string;
  let machineId: string;

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

    const stamp = Date.now();
    const emailA = `import-a-${stamp}@example.com`;
    tokenA = await registerUser(app, emailA, 'Import A');
    tokenB = await registerUser(app, `import-b-${stamp}@example.com`, 'Import B');
    const userA = await prisma.user.findUniqueOrThrow({
      where: { email: emailA },
    });
    userAId = userA.id;

    const weight = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        archivedAt: null,
        measurementType: 'WEIGHT_REPS',
        slug: { not: null },
      },
      orderBy: { slug: 'asc' },
    });
    weightSlug = weight.slug!;
    weightExerciseId = weight.id;

    const duration = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', slug: 'planche' },
    });
    durationSlug = duration.slug!;

    const distance = await prisma.exercise.findFirstOrThrow({
      where: { source: 'SYSTEM', slug: 'farmer-carry' },
    });
    distanceSlug = distance.slug!;

    const bodyweight = await prisma.exercise.findFirstOrThrow({
      where: {
        source: 'SYSTEM',
        measurementType: 'BODYWEIGHT_REPS',
        slug: { not: null },
      },
      orderBy: { slug: 'asc' },
    });
    bodyweightSlug = bodyweight.slug!;

    chestId = (
      await prisma.muscleGroup.findFirstOrThrow({ where: { code: 'chest' } })
    ).id;
    machineId = (
      await prisma.equipmentType.findFirstOrThrow({ where: { code: 'machine' } })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires auth for validate, import and system-catalog', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/program-imports/validate')
      .send({ schemaVersion: 1, program: {} })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/program-imports')
      .send({ schemaVersion: 1, program: {} })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/exercises/system-catalog')
      .expect(401);
  });

  it('returns a compact SYSTEM catalog without UUID or personal data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/exercises/system-catalog')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const items = response.body.data as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(10);
    const first = items[0]!;
    expect(first).toEqual({
      slug: expect.any(String),
      name: expect.any(String),
      primaryMuscleCode: expect.any(String),
      defaultEquipmentCode: expect.any(String),
      measurementType: expect.any(String),
    });
    expect(first).not.toHaveProperty('id');
    expect(JSON.stringify(items)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(items.some((item) => item.slug === weightSlug)).toBe(true);
  });

  it('validates a payload without persisting anything', async () => {
    const before = await prisma.program.count({ where: { ownerUserId: userAId } });
    const payload = {
      schemaVersion: 1,
      program: {
        name: 'Import validate only',
        description: null,
        goal: 'HYPERTROPHY',
        workouts: [
          {
            name: 'Push',
            description: null,
            estimatedDurationMinutes: 60,
            exercises: [
              {
                exerciseSlug: weightSlug,
                notes: null,
                sets: [weightSet(), weightSet(6, 8)],
              },
              {
                exerciseSlug: durationSlug,
                notes: null,
                sets: [{ durationSeconds: 45, restSeconds: 60 }],
              },
            ],
          },
          {
            name: 'Carry',
            description: null,
            estimatedDurationMinutes: 45,
            exercises: [
              {
                exerciseSlug: distanceSlug,
                notes: null,
                sets: [{ distanceMeters: 40, restSeconds: 90 }],
              },
            ],
          },
        ],
      },
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/program-imports/validate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload)
      .expect(200);

    expect(response.body.data.valid).toBe(true);
    expect(response.body.data.errors).toEqual([]);
    expect(response.body.data.preview.name).toBe('Import validate only');
    expect(response.body.data.preview.workoutCount).toBe(2);
    expect(response.body.data.preview.exerciseCount).toBe(3);
    expect(response.body.data.preview.setCount).toBe(4);
    expect(response.body.data.preview.workouts[0].exercises[0].exerciseSlug).toBe(
      weightSlug,
    );
    expect(response.body.data.preview.workouts[0].exercises[0].name).not.toBe(
      weightSlug,
    );

    const after = await prisma.program.count({ where: { ownerUserId: userAId } });
    expect(after).toBe(before);
  });

  it('returns UNKNOWN_EXERCISE with a precise path', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/program-imports/validate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        schemaVersion: 1,
        program: {
          name: 'Bad',
          description: null,
          goal: 'HYPERTROPHY',
          workouts: [
            {
              name: 'Push',
              description: null,
              estimatedDurationMinutes: 60,
              exercises: [
                {
                  exerciseSlug: 'fake-chest-machine',
                  sets: [weightSet()],
                },
              ],
            },
          ],
        },
      })
      .expect(200);

    expect(response.body.data.valid).toBe(false);
    expect(response.body.data.preview).toBeNull();
    const error = response.body.data.errors[0];
    expect(error.code).toBe('UNKNOWN_EXERCISE');
    expect(error.path).toBe('program.workouts[0].exercises[0].exerciseSlug');
    expect(error.message).toContain('fake-chest-machine');
  });

  it('rejects incompatible measurement targets', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/program-imports/validate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        schemaVersion: 1,
        program: {
          name: 'Plank reps',
          description: null,
          goal: 'GENERAL_FITNESS',
          workouts: [
            {
              name: 'Core',
              description: null,
              estimatedDurationMinutes: 30,
              exercises: [
                {
                  exerciseSlug: durationSlug,
                  sets: [{ repsMin: 10, repsMax: 10 }],
                },
              ],
            },
          ],
        },
      })
      .expect(200);

    expect(response.body.data.valid).toBe(false);
    expect(response.body.data.errors[0].code).toBe('INCOMPATIBLE_MEASUREMENT');
    expect(response.body.data.errors[0].path).toContain('repsMin');
  });

  it('imports a program as DRAFT without touching the current program', async () => {
    const existing = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Déjà actif', goal: 'STRENGTH' })
      .expect(201);
    const existingId = existing.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/programs/${existingId}/workout-templates`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A', estimatedDurationMinutes: 40 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/programs/${existingId}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startedOn: '2026-09-08', replaceCurrentProgram: false })
      .expect(200);

    const payload = {
      schemaVersion: 1,
      program: {
        name: 'Push Pull Legs IA',
        description: 'Importé',
        goal: 'HYPERTROPHY',
        workouts: [
          {
            name: 'Push',
            description: null,
            estimatedDurationMinutes: 60,
            exercises: [
              {
                exerciseSlug: weightSlug,
                notes: 'Notes IA ignorées côté metadata',
                sets: [weightSet(8, 10), weightSet(8, 10), weightSet(8, 10)],
              },
            ],
          },
          {
            name: 'Pull',
            description: null,
            estimatedDurationMinutes: 60,
            exercises: [
              {
                exerciseSlug: bodyweightSlug,
                notes: null,
                sets: [{ repsMin: 8, repsMax: 12, restSeconds: 90 }],
              },
            ],
          },
          {
            name: 'Legs',
            description: null,
            estimatedDurationMinutes: 75,
            exercises: [
              {
                exerciseSlug: durationSlug,
                notes: null,
                sets: [{ durationSeconds: 40, restSeconds: 45 }],
              },
            ],
          },
        ],
      },
    };

    const imported = await request(app.getHttpServer())
      .post('/api/v1/program-imports')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload)
      .expect(201);

    expect(imported.body.data.status).toBe('DRAFT');
    expect(imported.body.data.isCurrent).toBe(false);
    expect(imported.body.data.workoutTemplates).toHaveLength(3);
    expect(imported.body.data.workoutTemplates[0].position).toBe(0);
    expect(imported.body.data.workoutTemplates[1].name).toBe('Pull');
    expect(
      imported.body.data.workoutTemplates[0].exercises[0].exercise.id,
    ).toBe(weightExerciseId);
    expect(
      imported.body.data.workoutTemplates[0].exercises[0].sets,
    ).toHaveLength(3);
    expect(
      imported.body.data.workoutTemplates[0].exercises[0].sets[0].setType,
    ).toBe('WORKING');
    expect(
      imported.body.data.workoutTemplates[0].exercises[0].sets[0].targetRepMin,
    ).toBe(8);
    expect(
      imported.body.data.workoutTemplates[2].exercises[0].sets[0]
        .targetDurationSeconds,
    ).toBe(40);

    const activations = await prisma.programActivation.count({
      where: { userId: userAId, endedOn: null },
    });
    expect(activations).toBe(1);

    const active = await request(app.getHttpServer())
      .get('/api/v1/programs/active')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(active.body.data.program.id).toBe(existingId);

    const sessions = await prisma.workoutSession.count({
      where: { ownerUserId: userAId, sourceProgramId: imported.body.data.id },
    });
    expect(sessions).toBe(0);
  });

  it('does not overwrite a program that already has the same name', async () => {
    const name = `Homonyme ${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/program-imports')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        schemaVersion: 1,
        program: {
          name,
          description: 'premier',
          goal: 'ENDURANCE',
          workouts: [
            {
              name: 'A',
              description: null,
              estimatedDurationMinutes: 30,
              exercises: [
                {
                  exerciseSlug: bodyweightSlug,
                  sets: [{ repsMin: 10, repsMax: 15 }],
                },
              ],
            },
          ],
        },
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/program-imports')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        schemaVersion: 1,
        program: {
          name,
          description: 'second',
          goal: 'ENDURANCE',
          workouts: [
            {
              name: 'B',
              description: null,
              estimatedDurationMinutes: 30,
              exercises: [
                {
                  exerciseSlug: bodyweightSlug,
                  sets: [{ repsMin: 8, repsMax: 10 }],
                },
              ],
            },
          ],
        },
      })
      .expect(201);

    expect(second.body.data.id).not.toBe(first.body.data.id);
    const original = await prisma.program.findUniqueOrThrow({
      where: { id: first.body.data.id },
    });
    expect(original.description).toBe('premier');
  });

  it('revalidates on import and refuses unknown properties', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/program-imports')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        schemaVersion: 1,
        ownerUserId: userAId,
        program: {
          name: 'Malveillant',
          description: null,
          goal: 'HYPERTROPHY',
          workouts: [
            {
              name: 'A',
              description: null,
              estimatedDurationMinutes: 40,
              exercises: [
                {
                  exerciseSlug: weightSlug,
                  sets: [weightSet()],
                },
              ],
            },
          ],
        },
      })
      .expect(400);

    expect(response.body.error.code).toBe('PROGRAM_IMPORT_INVALID');
    expect(response.body.error.details.errors[0].code).toBe('UNKNOWN_FIELD');
  });

  it('does not resolve USER exercises even if they have a slug', async () => {
    const personalSlug = `secret-personal-${Date.now()}`;
    await prisma.exercise.create({
      data: {
        source: 'USER',
        ownerUserId: userAId,
        name: 'Secret personal press',
        normalizedName: `secret personal press ${Date.now()}`,
        slug: personalSlug,
        primaryMuscleGroupId: chestId,
        measurementType: 'WEIGHT_REPS',
        defaultEquipmentTypeId: machineId,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/program-imports/validate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        schemaVersion: 1,
        program: {
          name: 'Leak',
          description: null,
          goal: 'HYPERTROPHY',
          workouts: [
            {
              name: 'A',
              description: null,
              estimatedDurationMinutes: 40,
              exercises: [
                {
                  exerciseSlug: personalSlug,
                  sets: [weightSet()],
                },
              ],
            },
          ],
        },
      })
      .expect(200);

    expect(response.body.data.valid).toBe(false);
    expect(response.body.data.errors[0].code).toBe('UNKNOWN_EXERCISE');
  });

  it('rolls back the transaction when creation fails', async () => {
    const before = await prisma.program.count({ where: { ownerUserId: userAId } });
    const original = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((
      fn: unknown,
      options?: unknown,
    ) => {
      if (typeof fn !== 'function') {
        return original(fn as never, options as never);
      }
      return original(async (tx) => {
        await (fn as (client: unknown) => Promise<unknown>)(tx);
        throw new Error('force-rollback');
      }, options as never);
    }) as PrismaService['$transaction']);

    try {
      await request(app.getHttpServer())
        .post('/api/v1/program-imports')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          schemaVersion: 1,
          program: {
            name: 'Rollback',
            description: null,
            goal: 'HYPERTROPHY',
            workouts: [
              {
                name: 'A',
                description: null,
                estimatedDurationMinutes: 40,
                exercises: [
                  {
                    exerciseSlug: weightSlug,
                    sets: [weightSet()],
                  },
                ],
              },
            ],
          },
        })
        .expect(500);
    } finally {
      spy.mockRestore();
    }

    const after = await prisma.program.count({ where: { ownerUserId: userAId } });
    expect(after).toBe(before);
  });

  it('does not allow another user to own the imported program', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/program-imports')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        schemaVersion: 1,
        program: {
          name: 'Chez B',
          description: null,
          goal: 'STRENGTH',
          workouts: [
            {
              name: 'A',
              description: null,
              estimatedDurationMinutes: 40,
              exercises: [
                {
                  exerciseSlug: weightSlug,
                  sets: [weightSet()],
                },
              ],
            },
          ],
        },
      })
      .expect(201);

    const row = await prisma.program.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });
    expect(row.ownerUserId).not.toBe(userAId);
  });
});
