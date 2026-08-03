import type { ExerciseMeasurementType, ExerciseSource } from '@gym-companion/shared';

export const MEASUREMENT_TYPE_LABELS: Record<ExerciseMeasurementType, string> = {
  WEIGHT_REPS: 'Poids et répétitions',
  BODYWEIGHT_REPS: 'Poids du corps et répétitions',
  ASSISTED_BODYWEIGHT_REPS: 'Assistance et répétitions',
  REPS_ONLY: 'Répétitions',
  DURATION: 'Durée',
  DISTANCE_DURATION: 'Distance et durée',
  WEIGHT_DURATION: 'Poids et durée',
};

export const MEASUREMENT_TYPE_OPTIONS = Object.entries(MEASUREMENT_TYPE_LABELS).map(
  ([value, label]) => ({
    value: value as ExerciseMeasurementType,
    label,
  }),
);

export function getMeasurementTypeLabel(type: ExerciseMeasurementType): string {
  return MEASUREMENT_TYPE_LABELS[type];
}

export const SOURCE_OPTIONS: Array<{ value: '' | ExerciseSource; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'SYSTEM', label: 'Système' },
  { value: 'USER', label: 'Personnels' },
];

export function getSourceLabel(source: ExerciseSource): string {
  return source === 'SYSTEM' ? 'Système' : 'Personnel';
}
