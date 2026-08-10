import type { ExerciseProgressFilters } from './progress-api';

export const progressQueryKeys = {
  all: ['progress'] as const,
  exercises: () => [...progressQueryKeys.all, 'exercise'] as const,
  exercise: (exerciseId: string, filters: ExerciseProgressFilters) =>
    [...progressQueryKeys.exercises(), exerciseId, filters] as const,
};
