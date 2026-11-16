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
  TrainingShareExerciseDefinitionPreviewPayload,
  TrainingShareExercisePreview,
  TrainingSharePreviewResponse,
  TrainingShareWorkoutPreview,
} from '@gym-companion/shared';
import {
  TRAINING_SHARE_LIFETIME_MS,
  computeNextOrderedPosition,
  createExerciseSchema,
  importTrainingShareSchema,
  isTrainingShareExpired,
  normalizeExerciseName,
  suggestProgramNameFromWorkoutTemplate,
  validateWorkoutTemplateSetTargets,
  type CreateExerciseInput,
  type ImportTrainingShareInput,
  type SharedExerciseDefinition,
  type SharedTemplateExercise,
  type SharedTemplateSet,
  type SharedWorkoutTemplateBody,
  type TrainingShareSnapshot,
} from '@gym-companion/validation';
import type { ExerciseMeasurementType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  assertExerciseRelations,
  buildUserExerciseCreateData,
} from '../exercises/user-exercise-writer';
import {
  collectEquipmentTypeIdsFromSnapshot,
  collectExerciseIdsFromSnapshot,
  generateTrainingShareToken,
  hashTrainingShareToken,
  parseTrainingShareSnapshot,
  personalExercisesOfSnapshot,
  serializeExerciseSnapshotForShare,
  serializeProgramForShare,
  serializeWorkoutTemplateForShare,
  workoutsOfSnapshot,
} from './training-share-snapshot';

/** Champs d’exercice nécessaires pour décrire un exercice personnel partagé. */
const exerciseDefinitionSelect = {
  id: true,
  name: true,
  source: true,
  ownerUserId: true,
  archivedAt: true,
  measurementType: true,
  category: true,
  cardioType: true,
  primaryMuscleGroupId: true,
  defaultEquipmentTypeId: true,
  defaultRestSeconds: true,
  instructions: true,
  secondaryMuscles: { select: { muscleGroupId: true } },
  compatibleEquipment: {
    select: { equipmentTypeId: true, isPreferred: true, notes: true },
  },
} satisfies Prisma.ExerciseSelect;

const templateShareInclude = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: {
      exercise: { select: exerciseDefinitionSelect },
      sets: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.WorkoutTemplateInclude;

/** Exercice personnel résolu chez l’importeur (créé ou réutilisé), par clé de snapshot. */
type ResolvedPersonalExercises = Map<string, string>;

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

    this.assertPersonalExercisesShareable(
      userId,
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

    this.assertPersonalExercisesShareable(userId, template.exercises);

    const snapshot = serializeWorkoutTemplateForShare(template);
    parseTrainingShareSnapshot(snapshot);

    return this.persistShare(userId, 'WORKOUT_TEMPLATE', snapshot);
  }

  /** Partage d’un exercice personnel : recréé chez la personne qui l’importe. */
  async createExerciseShare(
    userId: string,
    exerciseId: string,
  ): Promise<CreateTrainingShareResponse> {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, ownerUserId: userId, source: 'USER' },
      select: exerciseDefinitionSelect,
    });
    if (!exercise) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice personnel introuvable.',
      });
    }
    if (exercise.archivedAt) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_EXERCISE_ARCHIVED',
        message: 'Un exercice archivé ne peut pas être partagé.',
      });
    }

    const snapshot = serializeExerciseSnapshotForShare(exercise);
    parseTrainingShareSnapshot(snapshot);

    return this.persistShare(userId, 'EXERCISE', snapshot);
  }

  async getPreview(token: string, now: Date = new Date()): Promise<TrainingSharePreviewResponse> {
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

    if (snapshot.kind === 'EXERCISE') {
      if (body.destination) {
        throw new BadRequestException({
          code: 'TRAINING_SHARE_DESTINATION_UNEXPECTED',
          message:
            'Un partage d’exercice ne prend pas de destination : l’exercice est ajouté à ta bibliothèque.',
        });
      }
      const exerciseId = await this.prisma.$transaction(async (tx) => {
        const resolved = await this.resolvePersonalExercisesForImport(tx, userId, [
          snapshot.exercise,
        ]);
        return resolved.get(snapshot.exercise.key)!;
      });
      this.logger.log({
        event: 'training_share.import',
        shareId: share.id,
        kind: 'EXERCISE',
        expired: false,
      });
      return {
        kind: 'EXERCISE',
        programId: null,
        workoutTemplateId: null,
        exerciseId,
      };
    }

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
      return {
        kind: 'PROGRAM',
        programId,
        workoutTemplateId: null,
        exerciseId: null,
      };
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
    kind: 'PROGRAM' | 'WORKOUT_TEMPLATE' | 'EXERCISE',
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

  /**
   * Les exercices personnels d’un programme sont embarqués dans le partage.
   * Ils doivent appartenir à l’auteur et ne pas être archivés.
   */
  private assertPersonalExercisesShareable(
    userId: string,
    exercises: Array<{
      exercise: {
        source: string;
        ownerUserId: string | null;
        archivedAt: Date | null;
      };
    }>,
  ): void {
    const unavailable = exercises.find(
      (item) =>
        item.exercise.source === 'USER' &&
        (item.exercise.ownerUserId !== userId || item.exercise.archivedAt !== null),
    );
    if (unavailable) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_PERSONAL_EXERCISE_UNAVAILABLE',
        message:
          'Ce contenu utilise un exercice personnel archivé ou qui ne t’appartient pas : il ne peut pas être partagé.',
      });
    }
  }

  /**
   * Résout chaque exercice personnel du partage chez l’importeur :
   * réutilise un exercice personnel actif équivalent (même nom normalisé,
   * même mesure, même catégorie) ou en crée un nouveau.
   */
  private async resolvePersonalExercisesForImport(
    tx: Prisma.TransactionClient,
    userId: string,
    definitions: SharedExerciseDefinition[],
  ): Promise<ResolvedPersonalExercises> {
    const resolved: ResolvedPersonalExercises = new Map();
    for (const definition of definitions) {
      const data = this.parsePersonalExerciseDefinition(definition);
      await assertExerciseRelations(tx, data);

      const existing = await tx.exercise.findFirst({
        where: {
          ownerUserId: userId,
          source: 'USER',
          archivedAt: null,
          normalizedName: normalizeExerciseName(data.name),
          measurementType: data.measurementType,
          category: data.category,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (existing) {
        resolved.set(definition.key, existing.id);
        continue;
      }

      const created = await tx.exercise.create({
        data: buildUserExerciseCreateData(userId, data),
        select: { id: true },
      });
      resolved.set(definition.key, created.id);
    }
    return resolved;
  }

  private parsePersonalExerciseDefinition(
    definition: SharedExerciseDefinition,
  ): CreateExerciseInput {
    const parsed = createExerciseSchema.safeParse({
      name: definition.name,
      primaryMuscleGroupId: definition.primaryMuscleGroupId,
      secondaryMuscleGroupIds: definition.secondaryMuscleGroupIds,
      measurementType: definition.measurementType,
      category: definition.category,
      cardioType: definition.cardioType,
      defaultEquipmentTypeId: definition.defaultEquipmentTypeId,
      compatibleEquipmentTypes: definition.compatibleEquipmentTypes,
      defaultRestSeconds: definition.defaultRestSeconds,
      instructions: definition.instructions,
    });
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'TRAINING_SHARE_PERSONAL_EXERCISE_INVALID',
        message: `L’exercice personnel « ${definition.name} » de ce partage est invalide.`,
      });
    }
    return parsed.data;
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

  private assertShareUsable(share: { id: string; expiresAt: Date; kind: string }, now: Date): void {
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

  private async validateSnapshotForImport(snapshot: TrainingShareSnapshot): Promise<void> {
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
        message: 'Un ou plusieurs exercices de ce partage ne sont plus disponibles.',
      });
    }
    const measurementById = new Map<string, ExerciseMeasurementType>(
      exercises.map((item) => [item.id, item.measurementType]),
    );
    const measurementByPersonalKey = new Map<string, ExerciseMeasurementType>(
      personalExercisesOfSnapshot(snapshot).map((item) => [item.key, item.measurementType]),
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
          message: 'Un ou plusieurs équipements de ce partage ne sont plus disponibles.',
        });
      }
    }

    for (const workout of workoutsOfSnapshot(snapshot)) {
      for (const exercise of workout.exercises) {
        const measurementType = exercise.exerciseId
          ? measurementById.get(exercise.exerciseId)
          : measurementByPersonalKey.get(exercise.personalExerciseKey ?? '');
        if (!measurementType) continue;
        for (const set of exercise.sets) {
          const validation = validateWorkoutTemplateSetTargets(measurementType, set);
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
    if (snapshot.kind === 'EXERCISE') {
      return this.buildExerciseDefinitionPreview(snapshot.exercise);
    }

    const exerciseIds = collectExerciseIdsFromSnapshot(snapshot);
    const exercises =
      exerciseIds.length > 0
        ? await this.prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            select: { id: true, name: true, measurementType: true },
          })
        : [];
    const catalogById = new Map(exercises.map((item) => [item.id, item]));
    const personalByKey = new Map(
      personalExercisesOfSnapshot(snapshot).map((item) => [item.key, item]),
    );

    const mapExercise = (exercise: SharedTemplateExercise) =>
      this.mapExercisePreview(exercise, catalogById, personalByKey);

    const mapWorkout = (workout: SharedWorkoutTemplateBody): TrainingShareWorkoutPreview => ({
      name: workout.name,
      estimatedDurationMinutes: workout.estimatedDurationMinutes,
      exerciseCount: workout.exercises.length,
      exercises: workout.exercises.map(mapExercise),
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
      exercises: snapshot.exercises.map(mapExercise),
    };
  }

  private async buildExerciseDefinitionPreview(
    definition: SharedExerciseDefinition,
  ): Promise<TrainingShareExerciseDefinitionPreviewPayload> {
    const muscleIds = [definition.primaryMuscleGroupId, ...definition.secondaryMuscleGroupIds];
    const [muscles, equipment] = await Promise.all([
      this.prisma.muscleGroup.findMany({
        where: { id: { in: muscleIds } },
        select: { id: true, name: true },
      }),
      definition.defaultEquipmentTypeId
        ? this.prisma.equipmentType.findUnique({
            where: { id: definition.defaultEquipmentTypeId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    const muscleNameById = new Map(muscles.map((item) => [item.id, item.name]));
    return {
      kind: 'EXERCISE',
      name: definition.name,
      measurementType: definition.measurementType,
      category: definition.category,
      cardioType: definition.cardioType,
      primaryMuscleGroupName: muscleNameById.get(definition.primaryMuscleGroupId) ?? null,
      secondaryMuscleGroupNames: definition.secondaryMuscleGroupIds
        .map((id) => muscleNameById.get(id))
        .filter((name): name is string => name !== undefined),
      defaultEquipmentName: equipment?.name ?? null,
      instructions: definition.instructions,
    };
  }

  private mapExercisePreview(
    exercise: SharedTemplateExercise,
    catalogById: Map<string, { id: string; name: string; measurementType: string }>,
    personalByKey: Map<string, SharedExerciseDefinition>,
  ): TrainingShareExercisePreview {
    const personal = exercise.personalExerciseKey
      ? personalByKey.get(exercise.personalExerciseKey)
      : undefined;
    const catalog = exercise.exerciseId ? catalogById.get(exercise.exerciseId) : undefined;
    const source = personal ?? catalog;
    return {
      exerciseId: exercise.exerciseId,
      name: source?.name ?? 'Exercice indisponible',
      measurementType: source?.measurementType ?? 'WEIGHT_REPS',
      isPersonal: personal !== undefined,
      sets: exercise.sets.map((set: SharedTemplateSet) => ({
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
      const personal = await this.resolvePersonalExercisesForImport(
        tx,
        userId,
        personalExercisesOfSnapshot(snapshot),
      );
      return tx.program.create({
        data: {
          ownerUserId: userId,
          name: snapshot.name.trim(),
          description: snapshot.description,
          goal: snapshot.goal,
          status: 'DRAFT',
          workoutTemplates: {
            create: snapshot.workouts.map((workout, workoutIndex) =>
              this.templateCreateData(userId, workout, workoutIndex, personal),
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
        message: 'Indique où ajouter la séance : nouveau programme ou programme existant.',
      });
    }

    if (body.destination.type === 'NEW_PROGRAM') {
      const programName =
        body.destination.programName.trim() || suggestProgramNameFromWorkoutTemplate(snapshot.name);
      const result = await this.prisma.$transaction(async (tx) => {
        const personal = await this.resolvePersonalExercisesForImport(
          tx,
          userId,
          personalExercisesOfSnapshot(snapshot),
        );
        const program = await tx.program.create({
          data: {
            ownerUserId: userId,
            name: programName,
            description: null,
            goal: 'GENERAL_FITNESS',
            status: 'DRAFT',
            workoutTemplates: {
              create: [this.templateCreateData(userId, snapshot, 0, personal)],
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
        exerciseId: null,
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
      const personal = await this.resolvePersonalExercisesForImport(
        tx,
        userId,
        personalExercisesOfSnapshot(snapshot),
      );
      const existing = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { positionInProgram: true },
      });
      const position = computeNextOrderedPosition(existing.map((item) => item.positionInProgram));
      const template = await tx.workoutTemplate.create({
        data: {
          ...this.templateCreateData(userId, snapshot, position, personal),
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
      exerciseId: null,
    };
  }

  private templateCreateData(
    userId: string,
    workout: SharedWorkoutTemplateBody,
    positionInProgram: number,
    personal: ResolvedPersonalExercises,
  ) {
    return {
      ownerUserId: userId,
      name: workout.name.trim(),
      description: workout.description,
      estimatedDurationMinutes: workout.estimatedDurationMinutes,
      positionInProgram,
      exercises: {
        create: workout.exercises.map((exercise, exerciseIndex) => ({
          exerciseId: this.resolveImportedExerciseId(exercise, personal),
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

  private resolveImportedExerciseId(
    exercise: SharedTemplateExercise,
    personal: ResolvedPersonalExercises,
  ): string {
    if (exercise.exerciseId) return exercise.exerciseId;
    const resolved = personal.get(exercise.personalExerciseKey ?? '');
    if (!resolved) {
      // Garanti par le schéma de snapshot (clés référencées ⇔ décrites).
      throw new BadRequestException({
        code: 'TRAINING_SHARE_PERSONAL_EXERCISE_INVALID',
        message: 'Un exercice personnel de ce partage est introuvable.',
      });
    }
    return resolved;
  }
}

export type { TemplateForShare };
