import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  ProgramDetail,
  ProgramImportError,
  ProgramImportPreview,
  ProgramImportSetPreview,
  ProgramImportValidateResponse,
} from '@gym-companion/shared';
import {
  findDuplicateExerciseSlugsInWorkout,
  measureJsonPayloadBytes,
  parseProgramImportPayload,
  PROGRAM_IMPORT_MAX_PAYLOAD_BYTES,
  programImportSetToTargetFields,
  suggestExerciseSlugs,
  validateProgramImportSetForMeasurement,
  type ProgramImportIssue,
  type ProgramImportPayloadV1,
} from '@gym-companion/validation';
import type { ExerciseMeasurementType } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import { ProgramsService } from '../programs/programs.service';

type CatalogRow = {
  id: string;
  slug: string;
  name: string;
  measurementType: ExerciseMeasurementType;
  archivedAt: Date | null;
  defaultEquipmentTypeId: string | null;
};

type EvaluatedImport =
  | {
      ok: true;
      payload: ProgramImportPayloadV1;
      preview: ProgramImportPreview;
      catalogBySlug: Map<string, CatalogRow>;
    }
  | { ok: false; errors: ProgramImportError[] };

@Injectable()
export class ProgramImportsService {
  private readonly logger = new Logger(ProgramImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly programsService: ProgramsService,
  ) {}

  async validate(
    _userId: string,
    raw: unknown,
  ): Promise<ProgramImportValidateResponse> {
    const evaluated = await this.evaluate(raw);
    if (!evaluated.ok) {
      this.logger.log({
        event: 'program_import.validated',
        valid: false,
        errorCount: evaluated.errors.length,
      });
      return {
        valid: false,
        preview: null,
        errors: evaluated.errors,
      };
    }
    this.logger.log({
      event: 'program_import.validated',
      valid: true,
      workoutCount: evaluated.preview.workoutCount,
    });
    return {
      valid: true,
      preview: evaluated.preview,
      errors: [],
    };
  }

  async import(userId: string, raw: unknown): Promise<ProgramDetail> {
    const evaluated = await this.evaluate(raw);
    if (!evaluated.ok) {
      throw new BadRequestException({
        code: 'PROGRAM_IMPORT_INVALID',
        message: 'Le programme ne peut pas être importé.',
        details: { errors: evaluated.errors },
      });
    }

    const { payload, catalogBySlug } = evaluated;

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.program.create({
        data: {
          ownerUserId: userId,
          name: payload.program.name,
          description: payload.program.description ?? null,
          goal: payload.program.goal,
          status: 'DRAFT',
          workoutTemplates: {
            create: payload.program.workouts.map((workout, workoutIndex) => ({
              ownerUserId: userId,
              name: workout.name,
              description: workout.description ?? null,
              estimatedDurationMinutes: workout.estimatedDurationMinutes,
              positionInProgram: workoutIndex,
              exercises: {
                create: workout.exercises.map((exercise, exerciseIndex) => {
                  const catalog = catalogBySlug.get(exercise.exerciseSlug);
                  if (!catalog) {
                    throw new Error('PROGRAM_IMPORT_CATALOG_MISS');
                  }
                  const targets = exercise.sets.map((set) =>
                    programImportSetToTargetFields(set),
                  );
                  return {
                    exerciseId: catalog.id,
                    position: exerciseIndex,
                    equipmentTypeId: catalog.defaultEquipmentTypeId,
                    notes: exercise.notes ?? null,
                    sets: {
                      create: targets.map((set, setIndex) => ({
                        position: setIndex,
                        setType: 'WORKING' as const,
                        targetRepMin: set.targetRepMin,
                        targetRepMax: set.targetRepMax,
                        targetDurationSeconds: set.targetDurationSeconds,
                        targetDistanceMeters: set.targetDistanceMeters,
                        targetWeightKg: set.targetWeightKg,
                        targetIntensityPercent: set.targetIntensityPercent,
                        targetRir: set.targetRir,
                        targetRpe: set.targetRpe,
                        restSeconds: set.restSeconds,
                      })),
                    },
                  };
                }),
              },
            })),
          },
        },
        select: { id: true },
      });
    });

    this.logger.log({
      event: 'program_import.imported',
      programId: created.id,
      workoutCount: payload.program.workouts.length,
    });

    return this.programsService.getById(userId, created.id);
  }

  async evaluate(raw: unknown): Promise<EvaluatedImport> {
    const bytes = measureJsonPayloadBytes(raw ?? {});
    if (bytes > PROGRAM_IMPORT_MAX_PAYLOAD_BYTES) {
      return {
        ok: false,
        errors: [
          {
            path: '',
            code: 'PAYLOAD_TOO_LARGE',
            message: `Le JSON dépasse la taille maximale autorisée (${PROGRAM_IMPORT_MAX_PAYLOAD_BYTES} octets).`,
          },
        ],
      };
    }

    const parsed = parseProgramImportPayload(raw);
    if (!parsed.ok) {
      return { ok: false, errors: parsed.errors };
    }

    const payload = parsed.data;
    const businessErrors: ProgramImportIssue[] = [];

    for (let workoutIndex = 0; workoutIndex < payload.program.workouts.length; workoutIndex += 1) {
      const workout = payload.program.workouts[workoutIndex]!;
      businessErrors.push(
        ...findDuplicateExerciseSlugsInWorkout(
          `program.workouts[${workoutIndex}]`,
          workout.exercises,
        ),
      );
    }

    const slugs = [
      ...new Set(
        payload.program.workouts.flatMap((workout) =>
          workout.exercises.map((exercise) => exercise.exerciseSlug),
        ),
      ),
    ];

    const rows =
      slugs.length > 0
        ? await this.prisma.exercise.findMany({
            where: {
              slug: { in: slugs },
              source: 'SYSTEM',
            },
            select: {
              id: true,
              slug: true,
              name: true,
              measurementType: true,
              archivedAt: true,
              defaultEquipmentTypeId: true,
            },
          })
        : [];

    const catalogBySlug = new Map<string, CatalogRow>();
    for (const row of rows) {
      if (row.slug) {
        catalogBySlug.set(row.slug, {
          id: row.id,
          slug: row.slug,
          name: row.name,
          measurementType: row.measurementType,
          archivedAt: row.archivedAt,
          defaultEquipmentTypeId: row.defaultEquipmentTypeId,
        });
      }
    }

    const unknownSlugs = slugs.filter((slug) => {
      const catalog = catalogBySlug.get(slug);
      return !catalog || catalog.archivedAt != null;
    });

    let knownSlugs: string[] = [];
    if (unknownSlugs.length > 0) {
      knownSlugs = (
        await this.prisma.exercise.findMany({
          where: { source: 'SYSTEM', archivedAt: null, slug: { not: null } },
          select: { slug: true },
        })
      )
        .map((item) => item.slug)
        .filter((slug): slug is string => slug != null);
    }

    for (let workoutIndex = 0; workoutIndex < payload.program.workouts.length; workoutIndex += 1) {
      const workout = payload.program.workouts[workoutIndex]!;
      for (let exerciseIndex = 0; exerciseIndex < workout.exercises.length; exerciseIndex += 1) {
        const exercise = workout.exercises[exerciseIndex]!;
        const path = `program.workouts[${workoutIndex}].exercises[${exerciseIndex}].exerciseSlug`;
        const catalog = catalogBySlug.get(exercise.exerciseSlug);
        if (!catalog) {
          businessErrors.push({
            path,
            code: 'UNKNOWN_EXERCISE',
            message: `Exercice inconnu : ${exercise.exerciseSlug}.`,
            suggestions: suggestExerciseSlugs(exercise.exerciseSlug, knownSlugs),
          });
          continue;
        }
        if (catalog.archivedAt) {
          businessErrors.push({
            path,
            code: 'EXERCISE_ARCHIVED',
            message: `L’exercice « ${exercise.exerciseSlug} » n’est plus disponible.`,
          });
          continue;
        }
        for (let setIndex = 0; setIndex < exercise.sets.length; setIndex += 1) {
          const set = exercise.sets[setIndex]!;
          businessErrors.push(
            ...validateProgramImportSetForMeasurement(
              catalog.measurementType,
              set,
              `program.workouts[${workoutIndex}].exercises[${exerciseIndex}].sets[${setIndex}]`,
            ),
          );
        }
      }
    }

    if (businessErrors.length > 0) {
      return { ok: false, errors: businessErrors };
    }

    return {
      ok: true,
      payload,
      preview: this.buildPreview(payload, catalogBySlug),
      catalogBySlug,
    };
  }

  private buildPreview(
    payload: ProgramImportPayloadV1,
    catalogBySlug: Map<string, CatalogRow>,
  ): ProgramImportPreview {
    const workouts = payload.program.workouts.map((workout) => ({
      name: workout.name,
      description: workout.description ?? null,
      estimatedDurationMinutes: workout.estimatedDurationMinutes,
      exercises: workout.exercises.map((exercise) => {
        const catalog = catalogBySlug.get(exercise.exerciseSlug);
        return {
          exerciseSlug: exercise.exerciseSlug,
          name: catalog?.name ?? exercise.exerciseSlug,
          measurementType: catalog?.measurementType ?? 'WEIGHT_REPS',
          notes: exercise.notes ?? null,
          sets: exercise.sets.map((set): ProgramImportSetPreview => ({
            repsMin: set.repsMin ?? null,
            repsMax: set.repsMax ?? null,
            durationSeconds: set.durationSeconds ?? null,
            distanceMeters: set.distanceMeters ?? null,
            weightKg: set.weightKg ?? null,
            rir: set.rir ?? null,
            rpe: set.rpe ?? null,
            restSeconds: set.restSeconds ?? null,
          })),
        };
      }),
    }));

    return {
      name: payload.program.name,
      description: payload.program.description ?? null,
      goal: payload.program.goal,
      workoutCount: workouts.length,
      exerciseCount: workouts.reduce(
        (sum, workout) => sum + workout.exercises.length,
        0,
      ),
      setCount: workouts.reduce(
        (sum, workout) =>
          sum +
          workout.exercises.reduce(
            (inner, exercise) => inner + exercise.sets.length,
            0,
          ),
        0,
      ),
      workouts,
    };
  }
}
