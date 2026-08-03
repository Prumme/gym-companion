import type { ExerciseListQuery } from './exercise-api';

export const exerciseQueryKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseQueryKeys.all, 'list'] as const,
  list: (filters: Omit<ExerciseListQuery, 'cursor' | 'limit'>) =>
    [...exerciseQueryKeys.lists(), filters] as const,
  details: () => [...exerciseQueryKeys.all, 'detail'] as const,
  detail: (exerciseId: string) => [...exerciseQueryKeys.details(), exerciseId] as const,
  preference: (exerciseId: string) =>
    [...exerciseQueryKeys.all, 'preference', exerciseId] as const,
  muscleGroups: () => ['reference', 'muscle-groups'] as const,
  equipmentTypes: () => ['reference', 'equipment-types'] as const,
};
