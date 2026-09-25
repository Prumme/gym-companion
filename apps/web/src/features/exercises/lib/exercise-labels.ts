import type {
  CardioType,
  ExerciseCategory,
  ExerciseMeasurementType,
  ExerciseSource,
} from '@gym-companion/shared';

export const MEASUREMENT_TYPE_LABELS: Record<ExerciseMeasurementType, string> = {
  WEIGHT_REPS: 'Poids et répétitions',
  BODYWEIGHT_REPS: 'Poids du corps et répétitions',
  ASSISTED_BODYWEIGHT_REPS: 'Assistance et répétitions',
  REPS_ONLY: 'Répétitions',
  DURATION: 'Durée',
  DISTANCE: 'Distance',
  DISTANCE_DURATION: 'Distance et durée',
  WEIGHT_DURATION: 'Poids et durée',
};

export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
  RUNNING: 'Course extérieure',
  WALKING: 'Marche',
  TREADMILL: 'Tapis de course',
  CYCLING: 'Vélo',
  ROWING: 'Rameur',
  STAIR_CLIMBING: 'StairMaster',
  ELLIPTICAL: 'Vélo elliptique',
  OTHER: 'Autre cardio',
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  STRENGTH: 'Musculation',
  CARDIO: 'Cardio',
};

export const CARDIO_MEASUREMENT_TYPES: ExerciseMeasurementType[] = [
  'DURATION',
  'DISTANCE',
  'DISTANCE_DURATION',
];

export function suggestedCardioMeasurement(type: CardioType): ExerciseMeasurementType {
  if (type === 'STAIR_CLIMBING' || type === 'ELLIPTICAL' || type === 'OTHER') {
    return 'DURATION';
  }
  if (type === 'ROWING') {
    return 'DISTANCE';
  }
  return 'DISTANCE_DURATION';
}

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
