import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProgramDetail } from '@gym-companion/shared';

import { importProgramFromJson, validateProgramImport } from '../api/program-import-api';
import { programQueryKeys } from '../api/program-query-keys';
import { coachingQueryKeys } from '@/features/coaching/api/coaching-query-keys';

export function useValidateProgramImportMutation() {
  return useMutation({
    mutationFn: (payload: unknown) => validateProgramImport(payload),
  });
}

export function useImportProgramFromJsonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => importProgramFromJson(payload),
    onSuccess: (detail: ProgramDetail) => {
      queryClient.setQueryData(programQueryKeys.detail(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: programQueryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: coachingQueryKeys.all });
    },
  });
}
