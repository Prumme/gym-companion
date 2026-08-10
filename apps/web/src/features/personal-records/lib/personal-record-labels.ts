import type { PersonalRecord, PersonalRecordType } from '@gym-companion/shared';

import { getWorkoutSetTypeLabel } from '@/features/programs/lib/program-labels';

export const PERSONAL_RECORD_TYPE_LABELS: Record<PersonalRecordType, string> = {
  MAX_WEIGHT: 'Charge maximale',
  MAX_REPS: 'Répétitions maximales',
  MAX_DURATION: 'Durée maximale',
  MAX_DISTANCE: 'Distance maximale',
};

export function getPersonalRecordTypeLabel(type: PersonalRecordType): string {
  return PERSONAL_RECORD_TYPE_LABELS[type] ?? type;
}

/** Affiche une durée en secondes au format français lisible. */
export function formatPersonalRecordDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) {
    return `${minutes} min`;
  }
  return `${minutes} min ${rest} s`;
}

export function formatPersonalRecordDistance(meters: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(meters)} m`;
}

/**
 * Unités canoniques serveur (kg). La dette de conversion LB (phase 3)
 * n’est pas résolue ici : affichage explicite en kg.
 */
export function formatPersonalRecordWeight(kg: number): string {
  return `${kg} kg`;
}

export function formatPersonalRecordValue(record: PersonalRecord): string {
  switch (record.recordType) {
    case 'MAX_WEIGHT':
      return formatPersonalRecordWeight(record.value);
    case 'MAX_REPS':
      return `${record.value} répétition${record.value > 1 ? 's' : ''}`;
    case 'MAX_DURATION':
      return formatPersonalRecordDuration(record.value);
    case 'MAX_DISTANCE':
      return formatPersonalRecordDistance(record.value);
    default: {
      const _exhaustive: never = record.recordType;
      return _exhaustive;
    }
  }
}

export function formatPersonalRecordContext(record: PersonalRecord): string[] {
  const parts: string[] = [];
  const { context, recordType } = record;

  if (recordType === 'MAX_WEIGHT') {
    if (context.reps != null) {
      parts.push(
        `${context.reps} répétition${context.reps > 1 ? 's' : ''}`,
      );
    }
    if (context.durationSeconds != null) {
      parts.push(formatPersonalRecordDuration(context.durationSeconds));
    }
  }

  if (recordType === 'MAX_REPS' && context.weightKg != null) {
    parts.push(formatPersonalRecordWeight(context.weightKg));
  }

  if (recordType === 'MAX_DURATION' && context.weightKg != null) {
    parts.push(formatPersonalRecordWeight(context.weightKg));
  }

  if (recordType === 'MAX_DISTANCE' && context.durationSeconds != null) {
    parts.push(formatPersonalRecordDuration(context.durationSeconds));
  }

  if (context.rir != null) {
    parts.push(`RIR ${context.rir}`);
  }
  if (context.rpe != null) {
    parts.push(`RPE ${context.rpe}`);
  }
  if (context.reachedFailure) {
    parts.push('échec musculaire');
  }
  parts.push(getWorkoutSetTypeLabel(context.setType));

  return parts;
}

export function formatPersonalRecordDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  if (!year || !month || !day) {
    return localDate;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
