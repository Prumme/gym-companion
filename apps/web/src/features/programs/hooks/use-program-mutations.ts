import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProgramDetail } from '@gym-companion/shared';
import type {
  ActivateProgramInput,
  AddWorkoutTemplateExerciseInput,
  CreateProgramInput,
  CreateWorkoutTemplateInput,
  CreateWorkoutTemplateSetInput,
  ReorderWorkoutTemplateExercisesInput,
  ReorderWorkoutTemplatesInput,
  ReorderWorkoutTemplateSetsInput,
  ReplaceProgramScheduleInput,
  UpdateProgramInput,
  UpdateWorkoutTemplateExerciseInput,
  UpdateWorkoutTemplateInput,
  UpdateWorkoutTemplateSetInput,
} from '@gym-companion/validation';

import {
  activateProgram,
  addWorkoutTemplateExercise,
  archiveProgram,
  createProgram,
  createWorkoutTemplate,
  createWorkoutTemplateSet,
  deactivateProgram,
  deleteWorkoutTemplate,
  deleteWorkoutTemplateSet,
  removeWorkoutTemplateExercise,
  reorderWorkoutTemplateExercises,
  reorderWorkoutTemplates,
  reorderWorkoutTemplateSets,
  replaceProgramSchedule,
  restoreProgram,
  updateProgram,
  updateWorkoutTemplate,
  updateWorkoutTemplateExercise,
  updateWorkoutTemplateSet,
} from '../api/program-api';
import { programQueryKeys } from '../api/program-query-keys';
import { coachingQueryKeys } from '@/features/coaching/api/coaching-query-keys';
import {
  syncAfterActivation,
  syncAfterDeactivation,
  syncAfterScheduleReplace,
} from '../lib/activation-cache';

function useSyncProgramDetail() {
  const queryClient = useQueryClient();

  return (detail: ProgramDetail, invalidateLists = false) => {
    queryClient.setQueryData(programQueryKeys.detail(detail.id), detail);
    if (invalidateLists) {
      void queryClient.invalidateQueries({ queryKey: programQueryKeys.lists() });
    }
    void queryClient.invalidateQueries({ queryKey: coachingQueryKeys.all });
  };
}

export function useCreateProgramMutation() {
  const sync = useSyncProgramDetail();
  return useMutation({
    mutationFn: (input: CreateProgramInput) => createProgram(input),
    onSuccess: (detail) => sync(detail, true),
  });
}

export function useUpdateProgramMutation() {
  const sync = useSyncProgramDetail();
  return useMutation({
    mutationFn: ({
      programId,
      input,
    }: {
      programId: string;
      input: UpdateProgramInput;
    }) => updateProgram(programId, input),
    onSuccess: (detail) => sync(detail, true),
  });
}

export function useArchiveProgramMutation() {
  const sync = useSyncProgramDetail();
  return useMutation({
    mutationFn: (programId: string) => archiveProgram(programId),
    onSuccess: (detail) => sync(detail, true),
  });
}

export function useRestoreProgramMutation() {
  const sync = useSyncProgramDetail();
  return useMutation({
    mutationFn: (programId: string) => restoreProgram(programId),
    onSuccess: (detail) => sync(detail, true),
  });
}

export function useActivateProgramMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      programId,
      input,
    }: {
      programId: string;
      input: ActivateProgramInput;
      previousProgramId: string | null;
    }) => activateProgram(programId, input),
    onSuccess: (active, variables) => {
      syncAfterActivation(
        queryClient,
        active,
        variables.previousProgramId,
      );
    },
  });
}

export function useDeactivateProgramMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (programId: string) => deactivateProgram(programId),
    onSuccess: (_active, programId) => {
      syncAfterDeactivation(queryClient, programId);
    },
  });
}

export function useReplaceProgramScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      programId,
      input,
    }: {
      programId: string;
      input: ReplaceProgramScheduleInput;
    }) => replaceProgramSchedule(programId, input),
    onSuccess: (schedule, variables) => {
      syncAfterScheduleReplace(queryClient, variables.programId, schedule);
    },
  });
}

export function useProgramContentMutations() {
  const sync = useSyncProgramDetail();
  const queryClient = useQueryClient();

  const createTemplate = useMutation({
    mutationFn: ({
      programId,
      input,
    }: {
      programId: string;
      input: CreateWorkoutTemplateInput;
    }) => createWorkoutTemplate(programId, input),
    onSuccess: (detail) => sync(detail, true),
  });

  const updateTemplate = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      input: UpdateWorkoutTemplateInput;
    }) => updateWorkoutTemplate(programId, workoutTemplateId, input),
    onSuccess: (detail) => sync(detail),
  });

  const deleteTemplate = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
    }: {
      programId: string;
      workoutTemplateId: string;
    }) => deleteWorkoutTemplate(programId, workoutTemplateId),
    onSuccess: (detail) => sync(detail, true),
  });

  const reorderTemplates = useMutation({
    mutationFn: ({
      programId,
      input,
    }: {
      programId: string;
      input: ReorderWorkoutTemplatesInput;
    }) => reorderWorkoutTemplates(programId, input),
    onSuccess: (detail) => sync(detail),
  });

  const addExercise = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      input: AddWorkoutTemplateExerciseInput;
    }) => addWorkoutTemplateExercise(programId, workoutTemplateId, input),
    onSuccess: (detail) => sync(detail, true),
  });

  const updateExercise = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      templateExerciseId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      templateExerciseId: string;
      input: UpdateWorkoutTemplateExerciseInput;
    }) =>
      updateWorkoutTemplateExercise(
        programId,
        workoutTemplateId,
        templateExerciseId,
        input,
      ),
    onSuccess: (detail) => sync(detail),
  });

  const removeExercise = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      templateExerciseId,
    }: {
      programId: string;
      workoutTemplateId: string;
      templateExerciseId: string;
    }) =>
      removeWorkoutTemplateExercise(
        programId,
        workoutTemplateId,
        templateExerciseId,
      ),
    onSuccess: (detail) => sync(detail, true),
  });

  const reorderExercises = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      input: ReorderWorkoutTemplateExercisesInput;
    }) => reorderWorkoutTemplateExercises(programId, workoutTemplateId, input),
    onSuccess: (detail) => sync(detail),
  });

  const createSet = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      templateExerciseId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      templateExerciseId: string;
      input: CreateWorkoutTemplateSetInput;
    }) =>
      createWorkoutTemplateSet(
        programId,
        workoutTemplateId,
        templateExerciseId,
        input,
      ),
    onSuccess: (detail) => sync(detail),
  });

  const updateSet = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      templateExerciseId,
      setId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      templateExerciseId: string;
      setId: string;
      input: UpdateWorkoutTemplateSetInput;
    }) =>
      updateWorkoutTemplateSet(
        programId,
        workoutTemplateId,
        templateExerciseId,
        setId,
        input,
      ),
    onSuccess: (detail) => sync(detail),
  });

  const deleteSet = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      templateExerciseId,
      setId,
    }: {
      programId: string;
      workoutTemplateId: string;
      templateExerciseId: string;
      setId: string;
    }) =>
      deleteWorkoutTemplateSet(
        programId,
        workoutTemplateId,
        templateExerciseId,
        setId,
      ),
    onSuccess: (detail) => sync(detail),
  });

  const reorderSets = useMutation({
    mutationFn: ({
      programId,
      workoutTemplateId,
      templateExerciseId,
      input,
    }: {
      programId: string;
      workoutTemplateId: string;
      templateExerciseId: string;
      input: ReorderWorkoutTemplateSetsInput;
    }) =>
      reorderWorkoutTemplateSets(
        programId,
        workoutTemplateId,
        templateExerciseId,
        input,
      ),
    onSuccess: (detail) => sync(detail),
  });

  return {
    queryClient,
    syncDetail: (detail: ProgramDetail) => sync(detail, false),
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
    addExercise,
    updateExercise,
    removeExercise,
    reorderExercises,
    createSet,
    updateSet,
    deleteSet,
    reorderSets,
  };
}
