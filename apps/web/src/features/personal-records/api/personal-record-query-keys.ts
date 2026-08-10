export const personalRecordQueryKeys = {
  all: ['personal-records'] as const,
  lists: () => [...personalRecordQueryKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...personalRecordQueryKeys.lists(), filters] as const,
  exercise: (exerciseId: string) =>
    [...personalRecordQueryKeys.all, 'exercise', exerciseId] as const,
};
