import type { TrainingGoal, WorkoutSetType } from '@gym-companion/shared';

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
};

export const WORKOUT_SET_TYPE_OPTIONS = (
  Object.entries(WORKOUT_SET_TYPE_LABELS) as Array<[WorkoutSetType, string]>
).map(([value, label]) => ({ value, label }));

export function getWorkoutSetTypeLabel(type: WorkoutSetType): string {
  return WORKOUT_SET_TYPE_LABELS[type];
}
