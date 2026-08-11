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
  validateProgramScheduleEntries,
  validateWorkoutTemplateSetTargets,
  type CoachProgramProposal,
  type CoachProposalExercise,
  type CoachWorkoutProposal,
} from '@gym-companion/validation';

import { PrismaService } from '../../../database/prisma/prisma.service';

export class AiCoachProposalBusinessError extends Error {}

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

function workoutsOf(
  kind: 'WORKOUT' | 'PROGRAM',
  workout: CoachWorkoutProposal | null,
  program: CoachProgramProposal | null,
): CoachWorkoutProposal[] {
  if (kind === 'WORKOUT') {
    if (!workout) {
      throw new AiCoachProposalBusinessError('data.workout manquant.');
    }
    return [workout];
  }
  if (!program) {
    throw new AiCoachProposalBusinessError('data.program manquant.');
  }
  return program.workouts;
}

function exercisesOf(workouts: CoachWorkoutProposal[]): CoachProposalExercise[] {
  return workouts.flatMap((item) => item.exercises);
}

/**
 * Revalide intégralement une proposal. Lève `AiCoachProposalBusinessError`
 * (message utilisateur clair, FR) si un exercice est obsolète/inaccessible,
 * un équipement invalide, ou une cible de série incohérente.
 */
export async function validateProposalContext(
  prisma: PrismaService,
  userId: string,
  kind: 'WORKOUT' | 'PROGRAM',
  workout: CoachWorkoutProposal | null,
  program: CoachProgramProposal | null,
): Promise<AiCoachProposalContext> {
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
    throw new AiCoachProposalBusinessError(
      'Un ou plusieurs exercices de cette proposition sont introuvables, archivés ou inaccessibles. Demande une nouvelle proposition au Coach.',
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
  if (equipmentRows.length !== equipmentTypeIds.length) {
    throw new AiCoachProposalBusinessError(
      'Un type d’équipement de cette proposition est invalide ou inactif. Demande une nouvelle proposition au Coach.',
    );
  }
  const equipmentMap = new Map<string, EquipmentInfo>(
    equipmentRows.map((row) => [row.id, row]),
  );

  for (const item of workouts) {
    for (const exercise of item.exercises) {
      const info = exerciseMap.get(exercise.exerciseId);
      if (!info) {
        throw new AiCoachProposalBusinessError(
          'Exercice introuvable dans la proposition.',
        );
      }
      for (const set of exercise.sets) {
        const validation = validateWorkoutTemplateSetTargets(
          info.measurementType,
          set,
        );
        if (!validation.ok) {
          throw new AiCoachProposalBusinessError(
            `Cible de série invalide pour « ${info.name} » : ${validation.message}`,
          );
        }
      }
    }
  }

  if (kind === 'PROGRAM' && program?.schedule) {
    const validation = validateProgramScheduleEntries(
      program.schedule.map((entry) => ({
        weekday: entry.weekday,
        position: entry.position,
        workoutTemplateId: String(entry.workoutIndex),
      })),
    );
    if (!validation.ok) {
      throw new AiCoachProposalBusinessError(validation.message);
    }
  }

  return { exerciseMap, equipmentMap };
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
      throw new AiCoachProposalBusinessError('data.workout manquant.');
    }
    return { kind: 'WORKOUT', workout: toPreviewWorkout(workout) };
  }
  if (!program) {
    throw new AiCoachProposalBusinessError('data.program manquant.');
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
