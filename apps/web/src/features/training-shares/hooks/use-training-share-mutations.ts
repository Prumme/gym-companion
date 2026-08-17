import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ImportTrainingShareRequest } from '@gym-companion/shared';

import { programQueryKeys } from '@/features/programs/api/program-query-keys';

import {
  createProgramShare,
  createWorkoutTemplateShare,
  importShare,
} from '../api/training-share-api';

export function useCreateProgramShareMutation() {
  return useMutation({
    mutationFn: (programId: string) => createProgramShare(programId),
  });
}

export function useCreateWorkoutTemplateShareMutation() {
  return useMutation({
    mutationFn: (input: { programId: string; workoutTemplateId: string }) =>
      createWorkoutTemplateShare(input.programId, input.workoutTemplateId),
  });
}

export function useImportShareMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      token: string;
      body?: ImportTrainingShareRequest;
    }) => importShare(input.token, input.body ?? {}),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: programQueryKeys.all });
      if (result.programId) {
        await queryClient.invalidateQueries({
          queryKey: programQueryKeys.detail(result.programId),
        });
      }
    },
  });
}
