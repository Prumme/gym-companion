/**
 * Jalon 8 — revalidation métier des propositions structurées Coach IA.
 *
 * L’IA ne fait jamais confiance à elle-même : chaque proposal est revalidée
 * intégralement côté serveur (exercices accessibles/non archivés, équipement
 * actif, cibles de séries cohérentes) — à la persistance ET à nouveau à
 * l’acceptation, car le catalogue peut avoir changé entre les deux (exercice
 * archivé, équipement désactivé…).
 */
import type {
  AiCoachProposalKind,
  AiCoachProposalPreview,
  AiCoachProposalPreviewExercise,
  AiCoachProposalPreviewWorkout,
  AiCoachProposalStatus,
  AiCoachProposalSummary,
  ExerciseMeasurementType,
} from '@gym-companion/shared';
import {
  sanitizeCoachProposalSetForMeasurement,
  validateProgramScheduleEntries,
  validateWorkoutTemplateSetTargets,
  type CoachProgramProposal,
  type CoachProposalExercise,
  type CoachProposalSet,
  type CoachWorkoutProposal,
} from '@gym-companion/validation';

import { PrismaService } from '../../../database/prisma/prisma.service';

export type AiCoachProposalValidationCode =
  | 'PROPOSAL_DATA_MISSING'
  | 'PROPOSAL_EXERCISE_NOT_FOUND'
  | 'PROPOSAL_EQUIPMENT_INCOMPATIBLE'
  | 'PROPOSAL_SET_TARGET_INVALID'
  | 'PROPOSAL_PROGRAM_INVALID';

export class AiCoachProposalBusinessError extends Error {
  constructor(
    message: string,
    readonly code: AiCoachProposalValidationCode,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AiCoachProposalBusinessError';
  }
}

type ExerciseInfo = {
  id: string;
  name: string;
  measurementType: ExerciseMeasurementType;
};

type EquipmentInfo = {
  id: string;
  name: string;
};

export type AiCoachProposalContext = {
  exerciseMap: Map<string, ExerciseInfo>;
  equipmentMap: Map<string, EquipmentInfo>;
};

export type ValidatedAiCoachProposal = {
  context: AiCoachProposalContext;
  /** Payloads sanitizés (measurementType DB = source de vérité). */
  workout: CoachWorkoutProposal | null;
  program: CoachProgramProposal | null;
};

function workoutsOf(
  kind: 'WORKOUT' | 'PROGRAM',
  workout: CoachWorkoutProposal | null,
  program: CoachProgramProposal | null,
): CoachWorkoutProposal[] {
  if (kind === 'WORKOUT') {
    if (!workout) {
      throw new AiCoachProposalBusinessError(
        'data.workout manquant.',
        'PROPOSAL_DATA_MISSING',
      );
    }
    return [workout];
  }
  if (!program) {
    throw new AiCoachProposalBusinessError(
      'data.program manquant.',
      'PROPOSAL_DATA_MISSING',
    );
  }
  return program.workouts;
}

function exercisesOf(workouts: CoachWorkoutProposal[]): CoachProposalExercise[] {
  return workouts.flatMap((item) => item.exercises);
}

function sanitizeExercise(
  exercise: CoachProposalExercise,
  info: ExerciseInfo,
  equipmentMap: Map<string, EquipmentInfo>,
): CoachProposalExercise {
  const equipmentTypeId =
    exercise.equipmentTypeId && equipmentMap.has(exercise.equipmentTypeId)
      ? exercise.equipmentTypeId
      : null;

  return {
    ...exercise,
    equipmentTypeId,
    sets: exercise.sets.map((set) =>
      sanitizeCoachProposalSetForMeasurement(info.measurementType, set),
    ),
  };
}

function sanitizeWorkout(
  workout: CoachWorkoutProposal,
  exerciseMap: Map<string, ExerciseInfo>,
  equipmentMap: Map<string, EquipmentInfo>,
): CoachWorkoutProposal {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => {
      const info = exerciseMap.get(exercise.exerciseId);
      if (!info) return exercise;
      return sanitizeExercise(exercise, info, equipmentMap);
    }),
  };
}

/**
 * Revalide intégralement une proposal. Lève `AiCoachProposalBusinessError`
 * avec un code machine si un exercice est obsolète/inaccessible,
 * un équipement invalide, ou une cible de série incohérente.
 *
 * Avant validation des sets : sanitize déterministe selon `Exercise.measurementType`
 * (source de vérité DB, pas l’IA) — ex. retire `sec`/`m` d’un WEIGHT_REPS.
 */
export async function validateProposalContext(
  prisma: PrismaService,
  userId: string,
  kind: 'WORKOUT' | 'PROGRAM',
  workout: CoachWorkoutProposal | null,
  program: CoachProgramProposal | null,
): Promise<ValidatedAiCoachProposal> {
  const workouts = workoutsOf(kind, workout, program);
  const exercises = exercisesOf(workouts);
  const exerciseIds = [...new Set(exercises.map((item) => item.exerciseId))];
  const equipmentTypeIds = [
    ...new Set(
      exercises
        .map((item) => item.equipmentTypeId)
        .filter((id): id is string => id != null),
    ),
  ];

  const exerciseRows = await prisma.exercise.findMany({
    where: {
      id: { in: exerciseIds },
      OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
      archivedAt: null,
    },
    select: { id: true, name: true, measurementType: true },
  });
  if (exerciseRows.length !== exerciseIds.length) {
    const found = new Set(exerciseRows.map((row) => row.id));
    const missing = exerciseIds.filter((id) => !found.has(id));
    throw new AiCoachProposalBusinessError(
      'Un ou plusieurs exercices de cette proposition sont introuvables, archivés ou inaccessibles. Demande une nouvelle proposition au Coach.',
      'PROPOSAL_EXERCISE_NOT_FOUND',
      { missingExerciseIds: missing.slice(0, 8) },
    );
  }
  const exerciseMap = new Map<string, ExerciseInfo>(
    exerciseRows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        measurementType: row.measurementType as ExerciseMeasurementType,
      },
    ]),
  );

  const equipmentRows =
    equipmentTypeIds.length > 0
      ? await prisma.equipmentType.findMany({
          where: { id: { in: equipmentTypeIds }, isActive: true },
          select: { id: true, name: true },
        })
      : [];
  const equipmentMap = new Map<string, EquipmentInfo>(
    equipmentRows.map((row) => [row.id, row]),
  );
  // Équipements inventés / inactifs → retirés au sanitize (pas d’échec dur).

  const sanitizedWorkouts = workouts.map((item) =>
    sanitizeWorkout(item, exerciseMap, equipmentMap),
  );

  for (let wi = 0; wi < sanitizedWorkouts.length; wi += 1) {
    const item = sanitizedWorkouts[wi]!;
    for (let ei = 0; ei < item.exercises.length; ei += 1) {
      const exercise = item.exercises[ei]!;
      const info = exerciseMap.get(exercise.exerciseId);
      if (!info) {
        throw new AiCoachProposalBusinessError(
          'Exercice introuvable dans la proposition.',
          'PROPOSAL_EXERCISE_NOT_FOUND',
          { exerciseId: exercise.exerciseId, workoutIndex: wi, exerciseIndex: ei },
        );
      }
      for (let si = 0; si < exercise.sets.length; si += 1) {
        const set = exercise.sets[si]!;
        const validation = validateWorkoutTemplateSetTargets(
          info.measurementType,
          set,
        );
        if (!validation.ok) {
          throw new AiCoachProposalBusinessError(
            `Cible de série invalide pour « ${info.name} » : ${validation.message}`,
            'PROPOSAL_SET_TARGET_INVALID',
            {
              exerciseId: info.id,
              exerciseName: info.name,
              measurementType: info.measurementType,
              workoutIndex: wi,
              exerciseIndex: ei,
              setIndex: si,
              validationCode: validation.code,
              rule: validation.message,
              set: summarizeSetForLog(set),
            },
          );
        }
      }
    }
  }

  let sanitizedProgram: CoachProgramProposal | null = null;
  let sanitizedWorkout: CoachWorkoutProposal | null = null;

  if (kind === 'WORKOUT') {
    sanitizedWorkout = sanitizedWorkouts[0] ?? null;
  } else if (program) {
    sanitizedProgram = {
      ...program,
      workouts: sanitizedWorkouts,
    };
    if (sanitizedProgram.schedule) {
      const validation = validateProgramScheduleEntries(
        sanitizedProgram.schedule.map((entry) => ({
          weekday: entry.weekday,
          position: entry.position,
          workoutTemplateId: String(entry.workoutIndex),
        })),
      );
      if (!validation.ok) {
        throw new AiCoachProposalBusinessError(
          validation.message,
          'PROPOSAL_PROGRAM_INVALID',
          { scheduleError: validation.code },
        );
      }
    }
  }

  return {
    context: { exerciseMap, equipmentMap },
    workout: sanitizedWorkout,
    program: sanitizedProgram,
  };
}

function summarizeSetForLog(set: CoachProposalSet): Record<string, unknown> {
  return {
    setType: set.setType,
    hasReps: set.targetRepMin != null && set.targetRepMax != null,
    hasDuration: set.targetDurationSeconds != null,
    hasDistance: set.targetDistanceMeters != null,
    hasWeight: set.targetWeightKg != null,
    hasPct: set.targetIntensityPercent != null,
    hasRir: set.targetRir != null,
    hasRpe: set.targetRpe != null,
  };
}

/**
 * Feedback machine compact pour UNE tentative de repair OpenAI.
 * Pas de payload complet, pas d’historique.
 */
export function buildProposalRepairFeedback(
  error: AiCoachProposalBusinessError,
): string {
  const compact: Record<string, unknown> = {
    reason: error.code,
    exerciseId: error.details.exerciseId ?? null,
    measurementType: error.details.measurementType ?? null,
    workoutIndex: error.details.workoutIndex ?? null,
    exerciseIndex: error.details.exerciseIndex ?? null,
    setIndex: error.details.setIndex ?? null,
    rule: error.details.validationCode ?? error.details.rule ?? error.code,
    missingExerciseIds: error.details.missingExerciseIds ?? null,
  };
  return [
    'PROPOSAL_REPAIR (machine feedback, not user-visible):',
    'La proposal précédente a échoué la validation métier.',
    'Corrige uniquement le JSON wire final. Respecte measurementType DB via les tools.',
    'WEIGHT_REPS/BODYWEIGHT/REPS_ONLY: r:[min,max] requis, sec=null, m=null.',
    'DURATION/WEIGHT_DURATION: sec requis, r=null, m=null.',
    'DISTANCE_DURATION: m requis, r=null.',
    'st=WORKING, omets kg/pct si débutant. Un seul de rir|rpe.',
    JSON.stringify(compact),
  ].join('\n');
}

/** Aperçu compact dénormalisé (affichage uniquement, non fiable côté métier). */
export function buildProposalPreview(
  kind: 'WORKOUT' | 'PROGRAM',
  workout: CoachWorkoutProposal | null,
  program: CoachProgramProposal | null,
  context: AiCoachProposalContext,
): AiCoachProposalPreview {
  const toPreviewWorkout = (
    item: CoachWorkoutProposal,
  ): AiCoachProposalPreviewWorkout => ({
    name: item.name,
    estimatedDurationMinutes: item.estimatedDurationMinutes,
    exercises: item.exercises.map(
      (exercise): AiCoachProposalPreviewExercise => {
        const info = context.exerciseMap.get(exercise.exerciseId);
        const equipment = exercise.equipmentTypeId
          ? context.equipmentMap.get(exercise.equipmentTypeId) ?? null
          : null;
        return {
          exerciseId: exercise.exerciseId,
          exerciseName: info?.name ?? 'Exercice',
          measurementType: info?.measurementType ?? 'WEIGHT_REPS',
          equipmentTypeId: exercise.equipmentTypeId,
          equipmentName: equipment?.name ?? null,
          notes: exercise.notes,
          sets: exercise.sets.map((set) => ({ ...set })),
        };
      },
    ),
  });

  if (kind === 'WORKOUT') {
    if (!workout) {
      throw new AiCoachProposalBusinessError(
        'data.workout manquant.',
        'PROPOSAL_DATA_MISSING',
      );
    }
    return { kind: 'WORKOUT', workout: toPreviewWorkout(workout) };
  }
  if (!program) {
    throw new AiCoachProposalBusinessError(
      'data.program manquant.',
      'PROPOSAL_DATA_MISSING',
    );
  }
  return {
    kind: 'PROGRAM',
    program: {
      name: program.name,
      description: program.description,
      goal: program.goal,
      workouts: program.workouts.map(toPreviewWorkout),
      schedule: program.schedule
        ? program.schedule.map((entry) => ({
            weekday: entry.weekday,
            workoutIndex: entry.workoutIndex,
            position: entry.position,
          }))
        : null,
    },
  };
}

/** Ligne Prisma `AiCoachProposal` (ou sous-ensemble suffisant) → DTO. */
export function toAiCoachProposalSummary(row: {
  id: string;
  kind: AiCoachProposalKind;
  status: AiCoachProposalStatus;
  previewJson: unknown;
  createdProgramId: string | null;
  createdWorkoutTemplateId: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  dismissedAt: Date | null;
}): AiCoachProposalSummary {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    // `previewJson` est produit exclusivement par `buildProposalPreview` côté
    // serveur (jamais par l’IA) : la lecture directe est sûre.
    preview: row.previewJson as AiCoachProposalPreview,
    createdProgramId: row.createdProgramId,
    createdWorkoutTemplateId: row.createdWorkoutTemplateId,
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
  };
}
