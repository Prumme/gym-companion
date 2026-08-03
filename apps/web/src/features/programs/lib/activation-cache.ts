import type {
  ActiveProgramSummary,
  ProgramDetail,
  ProgramSchedule,
} from '@gym-companion/shared';
import type { QueryClient } from '@tanstack/react-query';

import { programQueryKeys } from '../api/program-query-keys';

function patchDetailIsCurrent(
  detail: ProgramDetail | undefined,
  isCurrent: boolean,
): ProgramDetail | undefined {
  if (!detail) {
    return undefined;
  }
  return { ...detail, isCurrent };
}

export function syncActiveProgramCache(
  queryClient: QueryClient,
  active: ActiveProgramSummary | null,
) {
  queryClient.setQueryData(programQueryKeys.active(), active);
}

export function syncScheduleCache(
  queryClient: QueryClient,
  programId: string,
  schedule: ProgramSchedule,
) {
  queryClient.setQueryData(programQueryKeys.schedule(programId), schedule);
}

export function syncAfterActivation(
  queryClient: QueryClient,
  active: ActiveProgramSummary,
  previousProgramId: string | null,
) {
  syncActiveProgramCache(queryClient, active);
  syncScheduleCache(queryClient, active.program.id, active.schedule);

  const newProgramId = active.program.id;
  queryClient.setQueryData(
    programQueryKeys.detail(newProgramId),
    (current: ProgramDetail | undefined) =>
      current
        ? { ...current, isCurrent: true }
        : ({ ...active.program, workoutTemplates: [] } satisfies ProgramDetail),
  );

  if (previousProgramId && previousProgramId !== newProgramId) {
    queryClient.setQueryData(
      programQueryKeys.detail(previousProgramId),
      (current: ProgramDetail | undefined) =>
        patchDetailIsCurrent(current, false),
    );
  }

  void queryClient.invalidateQueries({ queryKey: programQueryKeys.lists() });
}

export function syncAfterDeactivation(
  queryClient: QueryClient,
  programId: string,
) {
  syncActiveProgramCache(queryClient, null);
  queryClient.setQueryData(
    programQueryKeys.detail(programId),
    (current: ProgramDetail | undefined) =>
      patchDetailIsCurrent(current, false),
  );
  void queryClient.invalidateQueries({ queryKey: programQueryKeys.lists() });
}

export function syncAfterScheduleReplace(
  queryClient: QueryClient,
  programId: string,
  schedule: ProgramSchedule,
) {
  syncScheduleCache(queryClient, programId, schedule);

  const active = queryClient.getQueryData<ActiveProgramSummary | null>(
    programQueryKeys.active(),
  );
  if (active?.program.id === programId) {
    syncActiveProgramCache(queryClient, { ...active, schedule });
  }
}
