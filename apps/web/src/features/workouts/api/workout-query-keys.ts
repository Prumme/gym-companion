export type WorkoutHistoryFilters = {
  status?: 'COMPLETED' | 'CANCELLED';
  from?: string;
  to?: string;
  programId?: string;
  workoutTemplateId?: string;
};

export const workoutQueryKeys = {
  all: ['workouts'] as const,
  active: () => [...workoutQueryKeys.all, 'active'] as const,
  activeFromLocal: () =>
    [...workoutQueryKeys.all, 'active', 'fromLocal'] as const,
  historyLists: () => [...workoutQueryKeys.all, 'history'] as const,
  history: (filters: WorkoutHistoryFilters) =>
    [...workoutQueryKeys.historyLists(), filters] as const,
  pendingTerminalLocal: () =>
    [...workoutQueryKeys.all, 'pendingTerminalLocal'] as const,
  details: () => [...workoutQueryKeys.all, 'detail'] as const,
  detail: (workoutSessionId: string) =>
    [...workoutQueryKeys.details(), workoutSessionId] as const,
  detailFromLocal: (workoutSessionId: string) =>
    [...workoutQueryKeys.detail(workoutSessionId), 'fromLocal'] as const,
};
