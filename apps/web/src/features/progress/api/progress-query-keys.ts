import type {
  ExerciseProgressFilters,
  ExerciseStrengthFilters,
  ProgressOverviewFilters,
} from './progress-api';

export const progressQueryKeys = {
  all: ['progress'] as const,
  overview: (filters: ProgressOverviewFilters) =>
    [...progressQueryKeys.all, 'overview', filters] as const,
  exercises: () => [...progressQueryKeys.all, 'exercise'] as const,
  exercise: (exerciseId: string, filters: ExerciseProgressFilters) =>
    [...progressQueryKeys.exercises(), exerciseId, filters] as const,
  exerciseStrength: (exerciseId: string, filters: ExerciseStrengthFilters) =>
    [...progressQueryKeys.exercises(), exerciseId, 'strength', filters] as const,
};
