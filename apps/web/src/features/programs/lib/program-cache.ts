import type {
  ProgramDetail,
  WorkoutTemplateDetail,
  WorkoutTemplateExerciseDetail,
  WorkoutTemplateSetTarget,
} from '@gym-companion/shared';

import { moveItemDown, moveItemUp, orderedIdsFromItems } from './reorder';

function withReindexedTemplates(
  templates: WorkoutTemplateDetail[],
): WorkoutTemplateDetail[] {
  return templates.map((template, index) => ({
    ...template,
    position: index,
  }));
}

function withReindexedExercises(
  exercises: WorkoutTemplateExerciseDetail[],
): WorkoutTemplateExerciseDetail[] {
  return exercises.map((exercise, index) => ({
    ...exercise,
    position: index,
  }));
}

function withReindexedSets(
  sets: WorkoutTemplateSetTarget[],
): WorkoutTemplateSetTarget[] {
  return sets.map((set, index) => ({
    ...set,
    position: index,
  }));
}

export function reorderTemplatesInDetail(
  detail: ProgramDetail,
  fromIndex: number,
  direction: 'up' | 'down',
): { next: ProgramDetail; orderedIds: string[] } {
  const moved =
    direction === 'up'
      ? moveItemUp(detail.workoutTemplates, fromIndex)
      : moveItemDown(detail.workoutTemplates, fromIndex);
  const templates = withReindexedTemplates(moved);
  return {
    next: {
      ...detail,
      workoutTemplates: templates,
      workoutTemplateCount: templates.length,
    },
    orderedIds: orderedIdsFromItems(templates),
  };
}

export function reorderExercisesInDetail(
  detail: ProgramDetail,
  workoutTemplateId: string,
  fromIndex: number,
  direction: 'up' | 'down',
): { next: ProgramDetail; orderedIds: string[] } | null {
  const templateIndex = detail.workoutTemplates.findIndex(
    (item) => item.id === workoutTemplateId,
  );
  if (templateIndex < 0) {
    return null;
  }
  const template = detail.workoutTemplates[templateIndex]!;
  const moved =
    direction === 'up'
      ? moveItemUp(template.exercises, fromIndex)
      : moveItemDown(template.exercises, fromIndex);
  const exercises = withReindexedExercises(moved);
  const templates = [...detail.workoutTemplates];
  templates[templateIndex] = {
    ...template,
    exercises,
    exerciseCount: exercises.length,
  };
  return {
    next: { ...detail, workoutTemplates: templates },
    orderedIds: orderedIdsFromItems(exercises),
  };
}

export function reorderSetsInDetail(
  detail: ProgramDetail,
  workoutTemplateId: string,
  templateExerciseId: string,
  fromIndex: number,
  direction: 'up' | 'down',
): { next: ProgramDetail; orderedIds: string[] } | null {
  const templateIndex = detail.workoutTemplates.findIndex(
    (item) => item.id === workoutTemplateId,
  );
  if (templateIndex < 0) {
    return null;
  }
  const template = detail.workoutTemplates[templateIndex]!;
  const exerciseIndex = template.exercises.findIndex(
    (item) => item.id === templateExerciseId,
  );
  if (exerciseIndex < 0) {
    return null;
  }
  const exercise = template.exercises[exerciseIndex]!;
  const moved =
    direction === 'up'
      ? moveItemUp(exercise.sets, fromIndex)
      : moveItemDown(exercise.sets, fromIndex);
  const sets = withReindexedSets(moved);
  const exercises = [...template.exercises];
  exercises[exerciseIndex] = { ...exercise, sets };
  const templates = [...detail.workoutTemplates];
  templates[templateIndex] = { ...template, exercises };
  return {
    next: { ...detail, workoutTemplates: templates },
    orderedIds: orderedIdsFromItems(sets),
  };
}
