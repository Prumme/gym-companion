import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateTrainingShareResponse,
  ImportTrainingShareResponse,
  TrainingShareExercisePreview,
  TrainingSharePreviewResponse,
  TrainingShareWorkoutPreview,
} from '@gym-companion/shared';
import {
  TRAINING_SHARE_LIFETIME_MS,
  computeNextOrderedPosition,
  importTrainingShareSchema,
  isTrainingShareExpired,
  suggestProgramNameFromWorkoutTemplate,
  validateWorkoutTemplateSetTargets,
  type ImportTrainingShareInput,
  type SharedTemplateSet,
  type SharedWorkoutTemplateBody,
  type TrainingShareSnapshot,
} from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  collectEquipmentTypeIdsFromSnapshot,
  collectExerciseIdsFromSnapshot,
  generateTrainingShareToken,
  hashTrainingShareToken,
  parseTrainingShareSnapshot,
  serializeProgramForShare,
  serializeWorkoutTemplateForShare,
} from './training-share-snapshot';

const templateShareInclude = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: {
      exercise: {
        select: {
          id: true,
          name: true,
          source: true,
          archivedAt: true,
          measurementType: true,
        },
      },
      sets: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.WorkoutTemplateInclude;

type TemplateForShare = Prisma.WorkoutTemplateGetPayload<{
  include: typeof templateShareInclude;
}>;

@Injectable()
export class TrainingSharesService {
  private readonly logger = new Logger(TrainingSharesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createProgramShare(
    userId: string,
    programId: string,
  ): Promise<CreateTrainingShareResponse> {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, ownerUserId: userId },
      include: {
        workoutTemplates: {
          orderBy: { positionInProgram: 'asc' },
          include: templateShareInclude,
        },
      },
    });
    if (!program) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
    if (program.workoutTemplates.length === 0) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_EMPTY',
        message: 'Impossible de partager un programme sans séance.',
      });
    }

    this.assertNoPersonalExercises(
      program.workoutTemplates.flatMap((template) => template.exercises),
    );

    const snapshot = serializeProgramForShare({
      name: program.name,
      description: program.description,
      goal: program.goal,
      workouts: program.workoutTemplates,
    });
    parseTrainingShareSnapshot(snapshot);

    return this.persistShare(userId, 'PROGRAM', snapshot);
  }

  async createWorkoutTemplateShare(
    userId: string,
    programId: string,
    workoutTemplateId: string,
  ): Promise<CreateTrainingShareResponse> {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, ownerUserId: userId },
      select: { id: true },
    });
    if (!program) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }

    const template = await this.prisma.workoutTemplate.findFirst({
      where: { id: workoutTemplateId, programId },
      include: templateShareInclude,
    });
    if (!template) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_NOT_FOUND',
        message: 'Séance introuvable.',
      });
    }

    this.assertNoPersonalExercises(template.exercises);

    const snapshot = serializeWorkoutTemplateForShare(template);
    parseTrainingShareSnapshot(snapshot);

    return this.persistShare(userId, 'WORKOUT_TEMPLATE', snapshot);
  }

  async getPreview(
    token: string,
    now: Date = new Date(),
  ): Promise<TrainingSharePreviewResponse> {
    const share = await this.findShareByTokenOrThrow(token);
    this.assertShareUsable(share, now);
    const snapshot = this.parseSnapshotOrThrow(share.snapshot);
    const preview = await this.buildPreview(snapshot);
    return {
      kind: share.kind,
      expiresAt: share.expiresAt.toISOString(),
      preview,
    };
  }

  async importShare(
    userId: string,
    token: string,
    rawBody: unknown,
    now: Date = new Date(),
  ): Promise<ImportTrainingShareResponse> {
    const body = importTrainingShareSchema.parse(rawBody ?? {});
    const share = await this.findShareByTokenOrThrow(token);
    this.assertShareUsable(share, now);
    const snapshot = this.parseSnapshotOrThrow(share.snapshot);

    await this.validateSnapshotForImport(snapshot);

    if (snapshot.kind === 'PROGRAM') {
      if (body.destination) {
        throw new BadRequestException({
          code: 'TRAINING_SHARE_DESTINATION_UNEXPECTED',
          message:
            'Un partage de programme ne prend pas de destination : le programme est créé automatiquement.',
        });
      }
      const programId = await this.importProgram(userId, snapshot);
      this.logger.log({
        event: 'training_share.import',
        shareId: share.id,
        kind: 'PROGRAM',
        expired: false,
      });
      return { kind: 'PROGRAM', programId, workoutTemplateId: null };
    }

    return this.importWorkoutTemplate(userId, share.id, snapshot, body);
  }

  /** Visible pour les tests d’expiration. */
  async importShareAt(
    userId: string,
    token: string,
    rawBody: unknown,
    now: Date,
  ): Promise<ImportTrainingShareResponse> {
    return this.importShare(userId, token, rawBody, now);
  }

  private async persistShare(
    userId: string,
    kind: 'PROGRAM' | 'WORKOUT_TEMPLATE',
    snapshot: TrainingShareSnapshot,
  ): Promise<CreateTrainingShareResponse> {
    const token = generateTrainingShareToken();
    const tokenHash = hashTrainingShareToken(token);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + TRAINING_SHARE_LIFETIME_MS);

    const created = await this.prisma.trainingShareLink.create({
      data: {
        kind,
        tokenHash,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        createdByUserId: userId,
        createdAt,
        expiresAt,
      },
      select: { id: true, expiresAt: true, kind: true },
    });

    this.logger.log({
      event: 'training_share.created',
      shareId: created.id,
      kind: created.kind,
      expired: false,
    });

    return {
      token,
      expiresAt: created.expiresAt.toISOString(),
      kind: created.kind,
    };
  }

  private assertNoPersonalExercises(
    exercises: Array<{ exercise: { source: string; name: string } }>,
  ): void {
    const personal = exercises.find((item) => item.exercise.source === 'USER');
    if (personal) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_PERSONAL_EXERCISE',
        message:
          'Ce programme contient un exercice personnel. Les exercices personnels ne peuvent pas encore être partagés.',
      });
    }
  }

  private async findShareByTokenOrThrow(token: string) {
    if (!token || token.length < 16 || token.length > 128) {
      throw new NotFoundException({
        code: 'SHARE_LINK_INVALID',
        message: 'Ce lien de partage n’est pas valide.',
      });
    }
    const tokenHash = hashTrainingShareToken(token);
    const share = await this.prisma.trainingShareLink.findUnique({
      where: { tokenHash },
    });
    if (!share || share.revokedAt) {
      throw new NotFoundException({
        code: 'SHARE_LINK_INVALID',
        message: 'Ce lien de partage n’est pas valide.',
      });
    }
    return share;
  }

  private assertShareUsable(
    share: { id: string; expiresAt: Date; kind: string },
    now: Date,
  ): void {
    if (isTrainingShareExpired(share.expiresAt, now)) {
      this.logger.warn({
        event: 'training_share.expired',
        shareId: share.id,
        kind: share.kind,
        expired: true,
      });
      throw new GoneException({
        code: 'SHARE_LINK_EXPIRED',
        message:
          'Ce lien de partage a expiré. Les liens Gym Companion sont valides pendant 1 heure.',
      });
    }
  }

  private parseSnapshotOrThrow(raw: unknown): TrainingShareSnapshot {
    try {
      return parseTrainingShareSnapshot(raw);
    } catch {
      throw new BadRequestException({
        code: 'SHARE_VERSION_UNSUPPORTED',
        message: 'Ce lien de partage utilise un format non supporté.',
      });
    }
  }

  private async validateSnapshotForImport(
    snapshot: TrainingShareSnapshot,
  ): Promise<void> {
    const exerciseIds = collectExerciseIdsFromSnapshot(snapshot);
    const exercises =
      exerciseIds.length > 0
        ? await this.prisma.exercise.findMany({
            where: {
              id: { in: exerciseIds },
              source: 'SYSTEM',
              archivedAt: null,
            },
            select: {
              id: true,
              measurementType: true,
            },
          })
        : [];
    if (exercises.length !== exerciseIds.length) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_EXERCISE_UNAVAILABLE',
        message:
          'Un ou plusieurs exercices de ce partage ne sont plus disponibles.',
      });
    }
    const measurementById = new Map(
      exercises.map((item) => [item.id, item.measurementType]),
    );

    const equipmentIds = collectEquipmentTypeIdsFromSnapshot(snapshot);
    if (equipmentIds.length > 0) {
      const equipment = await this.prisma.equipmentType.findMany({
        where: { id: { in: equipmentIds }, isActive: true },
        select: { id: true },
      });
      if (equipment.length !== equipmentIds.length) {
        throw new BadRequestException({
          code: 'TRAINING_SHARE_EQUIPMENT_UNAVAILABLE',
          message:
            'Un ou plusieurs équipements de ce partage ne sont plus disponibles.',
        });
      }
    }

    const workouts =
      snapshot.kind === 'PROGRAM' ? snapshot.workouts : [snapshot];
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const measurementType = measurementById.get(exercise.exerciseId);
        if (!measurementType) continue;
        for (const set of exercise.sets) {
          const validation = validateWorkoutTemplateSetTargets(
            measurementType,
            set,
          );
          if (!validation.ok) {
            throw new BadRequestException({
              code: 'TRAINING_SHARE_SET_TARGET_INVALID',
              message: validation.message,
            });
          }
        }
      }
    }
  }

  private async buildPreview(
    snapshot: TrainingShareSnapshot,
  ): Promise<TrainingSharePreviewResponse['preview']> {
    const exerciseIds = collectExerciseIdsFromSnapshot(snapshot);
    const exercises =
      exerciseIds.length > 0
        ? await this.prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            select: { id: true, name: true, measurementType: true },
          })
        : [];
    const nameById = new Map(exercises.map((item) => [item.id, item]));

    const mapWorkout = (
      workout: SharedWorkoutTemplateBody,
    ): TrainingShareWorkoutPreview => ({
      name: workout.name,
      estimatedDurationMinutes: workout.estimatedDurationMinutes,
      exerciseCount: workout.exercises.length,
      exercises: workout.exercises.map((exercise) =>
        this.mapExercisePreview(exercise, nameById),
      ),
    });

    if (snapshot.kind === 'PROGRAM') {
      return {
        kind: 'PROGRAM',
        name: snapshot.name,
        description: snapshot.description,
        goal: snapshot.goal,
        workoutCount: snapshot.workouts.length,
        workouts: snapshot.workouts.map(mapWorkout),
      };
    }

    return {
      kind: 'WORKOUT_TEMPLATE',
      name: snapshot.name,
      description: snapshot.description,
      estimatedDurationMinutes: snapshot.estimatedDurationMinutes,
      exerciseCount: snapshot.exercises.length,
      exercises: snapshot.exercises.map((exercise) =>
        this.mapExercisePreview(exercise, nameById),
      ),
    };
  }

  private mapExercisePreview(
    exercise: {
      exerciseId: string;
      sets: SharedTemplateSet[];
    },
    nameById: Map<
      string,
      { id: string; name: string; measurementType: string }
    >,
  ): TrainingShareExercisePreview {
    const catalog = nameById.get(exercise.exerciseId);
    return {
      exerciseId: exercise.exerciseId,
      name: catalog?.name ?? 'Exercice indisponible',
      measurementType: catalog?.measurementType ?? 'WEIGHT_REPS',
      sets: exercise.sets.map((set) => ({
        setType: set.setType,
        targetRepMin: set.targetRepMin,
        targetRepMax: set.targetRepMax,
        targetDurationSeconds: set.targetDurationSeconds,
        targetDistanceMeters: set.targetDistanceMeters,
        targetWeightKg: set.targetWeightKg,
        restSeconds: set.restSeconds,
      })),
    };
  }

  private async importProgram(
    userId: string,
    snapshot: Extract<TrainingShareSnapshot, { kind: 'PROGRAM' }>,
  ): Promise<string> {
    const program = await this.prisma.$transaction(async (tx) => {
      return tx.program.create({
        data: {
          ownerUserId: userId,
          name: snapshot.name.trim(),
          description: snapshot.description,
          goal: snapshot.goal,
          status: 'DRAFT',
          workoutTemplates: {
            create: snapshot.workouts.map((workout, workoutIndex) =>
              this.templateCreateData(userId, workout, workoutIndex),
            ),
          },
        },
        select: { id: true },
      });
    });
    return program.id;
  }

  private async importWorkoutTemplate(
    userId: string,
    shareId: string,
    snapshot: Extract<TrainingShareSnapshot, { kind: 'WORKOUT_TEMPLATE' }>,
    body: ImportTrainingShareInput,
  ): Promise<ImportTrainingShareResponse> {
    if (!body.destination) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_DESTINATION_REQUIRED',
        message:
          'Indique où ajouter la séance : nouveau programme ou programme existant.',
      });
    }

    if (body.destination.type === 'NEW_PROGRAM') {
      const programName =
        body.destination.programName.trim() ||
        suggestProgramNameFromWorkoutTemplate(snapshot.name);
      const result = await this.prisma.$transaction(async (tx) => {
        const program = await tx.program.create({
          data: {
            ownerUserId: userId,
            name: programName,
            description: null,
            goal: 'GENERAL_FITNESS',
            status: 'DRAFT',
            workoutTemplates: {
              create: [this.templateCreateData(userId, snapshot, 0)],
            },
          },
          include: {
            workoutTemplates: { select: { id: true }, take: 1 },
          },
        });
        return {
          programId: program.id,
          workoutTemplateId: program.workoutTemplates[0]!.id,
        };
      });
      this.logger.log({
        event: 'training_share.import',
        shareId,
        kind: 'WORKOUT_TEMPLATE',
        expired: false,
      });
      return {
        kind: 'WORKOUT_TEMPLATE',
        programId: result.programId,
        workoutTemplateId: result.workoutTemplateId,
      };
    }

    const programId = body.destination.programId;
    const program = await this.prisma.program.findFirst({
      where: { id: programId, ownerUserId: userId },
      select: { id: true, archivedAt: true },
    });
    if (!program) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
    if (program.archivedAt) {
      throw new ForbiddenException({
        code: 'PROGRAM_NOT_EDITABLE',
        message: 'Un programme archivé ne peut pas être modifié.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { positionInProgram: true },
      });
      const position = computeNextOrderedPosition(
        existing.map((item) => item.positionInProgram),
      );
      const template = await tx.workoutTemplate.create({
        data: {
          ...this.templateCreateData(userId, snapshot, position),
          programId,
        },
        select: { id: true },
      });
      return template.id;
    });

    this.logger.log({
      event: 'training_share.import',
      shareId,
      kind: 'WORKOUT_TEMPLATE',
      expired: false,
    });

    return {
      kind: 'WORKOUT_TEMPLATE',
      programId,
      workoutTemplateId: result,
    };
  }

  private templateCreateData(
    userId: string,
    workout: SharedWorkoutTemplateBody,
    positionInProgram: number,
  ) {
    return {
      ownerUserId: userId,
      name: workout.name.trim(),
      description: workout.description,
      estimatedDurationMinutes: workout.estimatedDurationMinutes,
      positionInProgram,
      exercises: {
        create: workout.exercises.map((exercise, exerciseIndex) => ({
          exerciseId: exercise.exerciseId,
          position: exerciseIndex,
          equipmentTypeId: exercise.equipmentTypeId,
          notes: exercise.notes,
          restSecondsOverride: exercise.restSecondsOverride,
          sets: {
            create: exercise.sets.map((set, setIndex) => ({
              position: setIndex,
              setType: set.setType,
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
        })),
      },
    };
  }
}

export type { TemplateForShare };
