import type { ExerciseCategory, TrainingGoal, WorkoutSetType } from '@gym-companion/shared';
import { isIntervalSetType } from '@gym-companion/validation';

export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = {
  ENDURANCE: 'Endurance',
  HYPERTROPHY: 'Hypertrophie',
  STRENGTH: 'Force',
  GENERAL_FITNESS: 'Forme générale',
};

export const TRAINING_GOAL_OPTIONS = (
  Object.entries(TRAINING_GOAL_LABELS) as Array<[TrainingGoal, string]>
).map(([value, label]) => ({ value, label }));

export function getTrainingGoalLabel(goal: TrainingGoal): string {
  return TRAINING_GOAL_LABELS[goal];
}

export const WORKOUT_SET_TYPE_LABELS: Record<WorkoutSetType, string> = {
  WARMUP: 'Échauffement',
  WORKING: 'Travail',
  BACKOFF: 'Allégée',
  DROP_SET: 'Dégressive',
  AMRAP: 'Maximum de répétitions',
  FAILURE_OPTIONAL: 'Échec facultatif',
  INTERVAL_WORK: 'Fractionné — effort',
  INTERVAL_RECOVERY: 'Fractionné — récupération',
};

/** Libellés courts pour TargetSetRow (Program Builder). */
export const WORKOUT_SET_TYPE_SHORT_LABELS: Record<WorkoutSetType, string> = {
  WARMUP: 'Échauff.',
  WORKING: 'Travail',
  BACKOFF: 'Allégée',
  DROP_SET: 'Dégressive',
  AMRAP: 'AMRAP',
  FAILURE_OPTIONAL: 'Échec opt.',
  INTERVAL_WORK: 'Effort',
  INTERVAL_RECOVERY: 'Récup',
};

export const WORKOUT_SET_TYPE_OPTIONS = (
  Object.entries(WORKOUT_SET_TYPE_LABELS) as Array<[WorkoutSetType, string]>
).map(([value, label]) => ({ value, label }));

/** Types de série proposés : le fractionné n’existe que pour le cardio. */
export function getWorkoutSetTypeOptions(category: ExerciseCategory) {
  return WORKOUT_SET_TYPE_OPTIONS.filter(
    (option) => category === 'CARDIO' || !isIntervalSetType(option.value),
  );
}

export function getWorkoutSetTypeLabel(type: WorkoutSetType): string {
  return WORKOUT_SET_TYPE_LABELS[type];
}

export function getWorkoutSetTypeShortLabel(type: WorkoutSetType): string {
  return WORKOUT_SET_TYPE_SHORT_LABELS[type];
}
