import type { ProgramListQuery } from './program-api';

export const programQueryKeys = {
  all: ['programs'] as const,
  lists: () => [...programQueryKeys.all, 'list'] as const,
  list: (filters: Omit<ProgramListQuery, 'cursor' | 'limit'>) =>
    [...programQueryKeys.lists(), filters] as const,
  details: () => [...programQueryKeys.all, 'detail'] as const,
  detail: (programId: string) => [...programQueryKeys.details(), programId] as const,
  active: () => [...programQueryKeys.all, 'active'] as const,
  schedules: () => [...programQueryKeys.all, 'schedule'] as const,
  schedule: (programId: string) =>
    [...programQueryKeys.schedules(), programId] as const,
};
