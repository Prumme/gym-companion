import { formatPersonalRecordWeight } from '@/features/personal-records/lib/personal-record-labels';

/** Affichage e1RM à 0,1 kg près (valeur canonique serveur inchangée). */
export function formatEstimatedOneRepMaxKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  }).format(rounded)} kg`;
}

export function formatStrengthSourceSet(source: {
  weightKg: number;
  reps: number;
}): string {
  return `${formatPersonalRecordWeight(source.weightKg)} × ${source.reps} répétition${source.reps > 1 ? 's' : ''}`;
}
