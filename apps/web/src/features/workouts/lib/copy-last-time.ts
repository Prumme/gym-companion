import type {
  ExerciseMeasurementType,
  LastWorkingSetCue,
  WorkoutSessionSetDetail,
} from '@gym-companion/shared';

import {
  canCopyPreviousSetIntoCurrent,
  getWorkoutSetActualFieldVisibility,
  pickCopyableActuals,
  type CopyableActuals,
} from './copy-previous-set';

/**
 * « Reprendre la dernière fois » : ne reprend que la charge et les répétitions
 * (repère « Dernière fois »), jamais la durée, la distance, l’effort ou les notes.
 */
export function supportsLastTimeCopy(measurementType: ExerciseMeasurementType): boolean {
  const visibility = getWorkoutSetActualFieldVisibility(measurementType);
  return visibility.weight || visibility.reps;
}

export function pickLastTimeActuals(
  cue: LastWorkingSetCue | null | undefined,
  measurementType: ExerciseMeasurementType,
): CopyableActuals {
  if (!cue) {
    return {};
  }
  const copied = pickCopyableActuals(cue, measurementType);
  const picked: CopyableActuals = {};
  if (copied.actualWeightKg != null) {
    picked.actualWeightKg = copied.actualWeightKg;
  }
  if (copied.actualReps != null) {
    picked.actualReps = copied.actualReps;
  }
  return picked;
}

/** Raison lisible de désactivation, ou `null` si l’action est disponible. */
export function getLastTimeCopyDisabledReason(
  cue: LastWorkingSetCue | null | undefined,
  measurementType: ExerciseMeasurementType,
  currentStatus: WorkoutSessionSetDetail['status'],
): string | null {
  if (!canCopyPreviousSetIntoCurrent(currentStatus)) {
    return 'Cette série est déjà terminée.';
  }
  if (Object.keys(pickLastTimeActuals(cue, measurementType)).length === 0) {
    return 'Aucune performance précédente pour cet exercice.';
  }
  return null;
}
