import type {
  ProgramDetail,
  ProgramListItem,
  ProgramPermissions,
  ProgramStatus,
  TrainingGoal,
  WorkoutTemplateSummary,
} from '@gym-companion/shared';

export type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  goal: TrainingGoal;
  status: ProgramStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerUserId: string;
  _count?: { workoutTemplates: number };
  workoutTemplates?: WorkoutTemplateRow[];
};

export type WorkoutTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  positionInProgram: number;
  estimatedDurationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export function computeProgramPermissions(
  archivedAt: Date | null,
): ProgramPermissions {
  const archived = archivedAt !== null;
  return {
    canEdit: !archived,
    canArchive: !archived,
    canRestore: archived,
  };
}

export function toWorkoutTemplateSummary(
  row: WorkoutTemplateRow,
): WorkoutTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    position: row.positionInProgram,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    exerciseCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProgramListItem(row: ProgramRow): ProgramListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    goal: row.goal,
    status: row.status,
    workoutTemplateCount: row._count?.workoutTemplates ?? row.workoutTemplates?.length ?? 0,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    permissions: computeProgramPermissions(row.archivedAt),
  };
}

export function toProgramDetail(row: ProgramRow): ProgramDetail {
  const templates = [...(row.workoutTemplates ?? [])].sort(
    (a, b) => a.positionInProgram - b.positionInProgram,
  );
  return {
    ...toProgramListItem({
      ...row,
      _count: { workoutTemplates: templates.length },
    }),
    workoutTemplates: templates.map(toWorkoutTemplateSummary),
  };
}
