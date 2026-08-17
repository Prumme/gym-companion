import type { TrainingShareSetPreview } from '@gym-companion/shared';

export function formatShareSetSummary(set: TrainingShareSetPreview): string {
  if (set.targetRepMin != null && set.targetRepMax != null) {
    if (set.targetRepMin === set.targetRepMax) {
      return `${set.targetRepMin} reps`;
    }
    return `${set.targetRepMin}–${set.targetRepMax}`;
  }
  if (set.targetDurationSeconds != null) {
    const minutes = Math.floor(set.targetDurationSeconds / 60);
    const seconds = set.targetDurationSeconds % 60;
    if (minutes > 0 && seconds === 0) return `${minutes} min`;
    if (minutes > 0) return `${minutes} min ${seconds} s`;
    return `${set.targetDurationSeconds} s`;
  }
  if (set.targetDistanceMeters != null) {
    return `${set.targetDistanceMeters} m`;
  }
  return set.setType;
}

export function formatShareSetsLine(
  sets: TrainingShareSetPreview[],
): string {
  if (sets.length === 0) return 'Aucune série';
  const first = sets[0]!;
  const same = sets.every(
    (set) =>
      set.targetRepMin === first.targetRepMin &&
      set.targetRepMax === first.targetRepMax &&
      set.targetDurationSeconds === first.targetDurationSeconds,
  );
  if (same) {
    return `${sets.length} × ${formatShareSetSummary(first)}`;
  }
  return `${sets.length} séries`;
}

export function formatRemainingShareTime(
  expiresAtIso: string,
  nowMs: number = Date.now(),
): string {
  const remainingMs = new Date(expiresAtIso).getTime() - nowMs;
  if (remainingMs <= 0) return 'expiré';
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }
  return `${totalMinutes} min`;
}

export function getTrainingShareErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: string }).code === 'string'
  ) {
    const code = (error as { code: string }).code;
    if (code === 'SHARE_LINK_EXPIRED') {
      return 'Ce lien de partage a expiré. Les liens Gym Companion sont valides pendant 1 heure.';
    }
    if (code === 'SHARE_LINK_INVALID') {
      return 'Ce lien de partage n’est pas valide.';
    }
    if (code === 'TRAINING_SHARE_PERSONAL_EXERCISE') {
      return 'Ce programme contient un exercice personnel. Les exercices personnels ne peuvent pas encore être partagés.';
    }
    if (code === 'SHARE_VERSION_UNSUPPORTED') {
      return 'Ce lien de partage utilise un format non supporté.';
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
