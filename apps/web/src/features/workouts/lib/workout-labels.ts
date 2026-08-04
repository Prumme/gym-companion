import type {
  WorkoutSessionSetTarget,
  WorkoutSetType,
} from '@gym-companion/shared';

import { getWorkoutSetTypeLabel } from '@/features/programs/lib/program-labels';

export function formatWorkoutSetTargetSummary(
  set: WorkoutSessionSetTarget,
): string {
  const parts: string[] = [getWorkoutSetTypeLabel(set.setType)];

  if (set.targetRepMin != null && set.targetRepMax != null) {
    parts.push(
      set.targetRepMin === set.targetRepMax
        ? `${set.targetRepMin} répétitions`
        : `${set.targetRepMin} à ${set.targetRepMax} répétitions`,
    );
  } else if (set.targetRepMin != null) {
    parts.push(`${set.targetRepMin} répétitions`);
  }

  if (set.targetWeightKg != null) {
    parts.push(`${set.targetWeightKg} kg`);
  }

  if (set.targetDistanceMeters != null) {
    const formatted = new Intl.NumberFormat('fr-FR').format(
      set.targetDistanceMeters,
    );
    parts.push(`${formatted} m`);
  }

  if (set.targetDurationSeconds != null) {
    if (set.targetDistanceMeters != null) {
      const minutes = set.targetDurationSeconds / 60;
      parts.push(
        minutes >= 1 && Number.isInteger(minutes)
          ? `objectif ${minutes} minute${minutes > 1 ? 's' : ''}`
          : `objectif ${set.targetDurationSeconds} s`,
      );
    } else {
      parts.push(`${set.targetDurationSeconds} secondes`);
    }
  }

  if (set.targetIntensityPercent != null) {
    parts.push(`${set.targetIntensityPercent} %`);
  }

  if (set.targetRir != null) {
    parts.push(`RIR ${set.targetRir}`);
  }

  if (set.targetRpe != null) {
    parts.push(`RPE ${set.targetRpe}`);
  }

  if (set.targetRestSeconds != null) {
    parts.push(`repos ${set.targetRestSeconds} s`);
  }

  return parts.join(' — ');
}

export const WORKOUT_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifiée',
  ACTIVE: 'En cours',
  PAUSED: 'En pause',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export function getWorkoutStatusLabel(status: string): string {
  return WORKOUT_STATUS_LABELS[status] ?? status;
}

export function getWorkoutSetTypeLabelSafe(type: WorkoutSetType): string {
  return getWorkoutSetTypeLabel(type);
}
