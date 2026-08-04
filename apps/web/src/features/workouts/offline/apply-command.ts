import type {
  WorkoutSessionDetail,
  WorkoutSessionPermissions,
  WorkoutSessionSetDetail,
  WorkoutStatus,
} from '@gym-companion/shared';

import type {
  CancelWorkoutCommandPayload,
  CompleteWorkoutCommandPayload,
  OfflineWorkoutCommandType,
  StoredWorkoutCommand,
  UpdateWorkoutSetCommandPayload,
} from './types';
import { updateSetPayloadSchema } from './schemas';

export function permissionsForStatus(
  status: WorkoutStatus,
): WorkoutSessionPermissions {
  switch (status) {
    case 'ACTIVE':
      return {
        canPause: true,
        canResume: false,
        canComplete: true,
        canCancel: true,
        canRecordSets: true,
      };
    case 'PAUSED':
      return {
        canPause: false,
        canResume: true,
        canComplete: true,
        canCancel: true,
        canRecordSets: false,
      };
    default:
      return {
        canPause: false,
        canResume: false,
        canComplete: false,
        canCancel: false,
        canRecordSets: false,
      };
  }
}

function patchSet(
  set: WorkoutSessionSetDetail,
  payload: UpdateWorkoutSetCommandPayload,
): WorkoutSessionSetDetail {
  const isFinalized =
    payload.status === 'COMPLETED' ||
    payload.status === 'PARTIAL' ||
    payload.status === 'FAILED' ||
    payload.status === 'SKIPPED';
  const now = new Date().toISOString();
  return {
    ...set,
    status: payload.status,
    actualWeightKg: payload.actualWeightKg,
    actualReps: payload.actualReps,
    actualDurationSeconds: payload.actualDurationSeconds,
    actualDistanceMeters: payload.actualDistanceMeters,
    actualRir: payload.actualRir,
    actualRpe: payload.actualRpe,
    reachedFailure: payload.reachedFailure,
    notes: payload.notes,
    startedAt: set.startedAt ?? (payload.status !== 'PENDING' ? now : null),
    completedAt: isFinalized
      ? now
      : payload.status === 'PENDING'
        ? null
        : set.completedAt,
  };
}

export function applyOptimisticSetUpdate(
  session: WorkoutSessionDetail,
  payload: UpdateWorkoutSetCommandPayload,
  nextVersion: number,
): WorkoutSessionDetail | null {
  if (session.status !== 'ACTIVE') {
    return null;
  }
  let found = false;
  const exercises = session.exercises.map((exercise) => {
    if (exercise.id !== payload.sessionExerciseId) {
      return exercise;
    }
    return {
      ...exercise,
      sets: exercise.sets.map((set) => {
        if (set.id !== payload.workoutSetId) {
          return set;
        }
        found = true;
        return patchSet(set, payload);
      }),
    };
  });
  if (!found) {
    return null;
  }
  return {
    ...session,
    version: nextVersion,
    exercises,
    permissions: permissionsForStatus(session.status),
  };
}

export function applyOptimisticLifecycle(
  session: WorkoutSessionDetail,
  type: Exclude<OfflineWorkoutCommandType, 'UPDATE_WORKOUT_SET'>,
  payload: unknown,
  nextVersion: number,
): WorkoutSessionDetail | null {
  const now = new Date().toISOString();

  if (type === 'PAUSE_WORKOUT') {
    if (session.status !== 'ACTIVE' && session.status !== 'PAUSED') {
      return null;
    }
    return {
      ...session,
      status: 'PAUSED',
      pausedAt: session.pausedAt ?? now,
      version: nextVersion,
      permissions: permissionsForStatus('PAUSED'),
    };
  }

  if (type === 'RESUME_WORKOUT') {
    if (session.status !== 'PAUSED' && session.status !== 'ACTIVE') {
      return null;
    }
    return {
      ...session,
      status: 'ACTIVE',
      pausedAt: null,
      version: nextVersion,
      permissions: permissionsForStatus('ACTIVE'),
    };
  }

  if (type === 'COMPLETE_WORKOUT') {
    if (session.status !== 'ACTIVE' && session.status !== 'PAUSED') {
      if (session.status === 'COMPLETED') {
        return { ...session, version: nextVersion };
      }
      return null;
    }
    const notesPayload = payload as CompleteWorkoutCommandPayload;
    return {
      ...session,
      status: 'COMPLETED',
      completedAt: now,
      pausedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      notes:
        notesPayload.notes !== undefined ? notesPayload.notes : session.notes,
      version: nextVersion,
      permissions: permissionsForStatus('COMPLETED'),
    };
  }

  if (type === 'CANCEL_WORKOUT') {
    if (session.status !== 'ACTIVE' && session.status !== 'PAUSED') {
      if (session.status === 'CANCELLED') {
        return { ...session, version: nextVersion };
      }
      return null;
    }
    const cancelPayload = payload as CancelWorkoutCommandPayload;
    return {
      ...session,
      status: 'CANCELLED',
      cancelledAt: now,
      pausedAt: null,
      completedAt: null,
      cancellationReason: cancelPayload.reason ?? null,
      version: nextVersion,
      permissions: permissionsForStatus('CANCELLED'),
    };
  }

  return null;
}

export function applyCommandToSession(
  session: WorkoutSessionDetail,
  command: Pick<StoredWorkoutCommand, 'type' | 'payload' | 'expectedVersion'>,
  nextVersion: number = command.expectedVersion + 1,
): WorkoutSessionDetail | null {
  if (command.type === 'UPDATE_WORKOUT_SET') {
    const parsed = updateSetPayloadSchema.safeParse(command.payload);
    if (!parsed.success) {
      return null;
    }
    return applyOptimisticSetUpdate(session, parsed.data, nextVersion);
  }
  return applyOptimisticLifecycle(
    session,
    command.type,
    command.payload,
    nextVersion,
  );
}

export function applyCommandsInOrder(
  session: WorkoutSessionDetail,
  commands: Array<Pick<StoredWorkoutCommand, 'type' | 'payload' | 'expectedVersion' | 'id'>>,
): {
  session: WorkoutSessionDetail;
  ok: boolean;
  failedCommandId: string | null;
} {
  let current = session;
  for (const command of commands) {
    const next = applyCommandToSession(
      current,
      command,
      current.version + 1,
    );
    if (!next) {
      return {
        session: current,
        ok: false,
        failedCommandId: command.id,
      };
    }
    current = next;
  }
  return { session: current, ok: true, failedCommandId: null };
}
