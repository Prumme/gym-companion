import type {
  UpdateWorkoutSetResult,
  WorkoutLifecycleResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import type { UpdateWorkoutSetInput } from '@gym-companion/validation';

import {
  cancelWorkoutSession,
  completeWorkoutSession,
  getWorkoutSessionDetail,
  pauseWorkoutSession,
  resumeWorkoutSession,
  updateWorkoutSet,
} from '../api/workout-api';
import { applyUpdateWorkoutSetResult } from '../lib/workout-cache';
import { broadcastWorkoutSync } from './broadcast';
import {
  getErrorCode,
  getErrorMessage,
  isAuthError,
  isBusinessRejectError,
  isConflictError,
  isNetworkError,
} from './network';
import { refreshLease, tryAcquireLease } from './sync-lease';
import {
  buildSyncState,
  deleteCommand,
  getSnapshot,
  getSyncState,
  listOpenCommands,
  listPendingCommands,
  putCommand,
  putSyncState,
  saveSnapshot,
} from './store';
import type {
  CancelWorkoutCommandPayload,
  CompleteWorkoutCommandPayload,
  StoredWorkoutCommand,
  UpdateWorkoutSetCommandPayload,
} from './types';
import { updateSetPayloadSchema } from './schemas';

export const SYNC_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const;

export function getBackoffDelayMs(attemptCount: number): number {
  const index = Math.min(
    Math.max(attemptCount - 1, 0),
    SYNC_BACKOFF_MS.length - 1,
  );
  return SYNC_BACKOFF_MS[index]!;
}

type SyncResult = {
  status: 'idle' | 'synced' | 'offline' | 'conflict' | 'rejected' | 'auth' | 'busy' | 'empty';
  applied: number;
};

const syncingSessions = new Set<string>();

async function executeCommand(
  command: StoredWorkoutCommand,
): Promise<UpdateWorkoutSetResult | WorkoutLifecycleResult> {
  if (command.type === 'UPDATE_WORKOUT_SET') {
    const payload = updateSetPayloadSchema.parse(
      command.payload,
    ) as UpdateWorkoutSetCommandPayload;
    const input: UpdateWorkoutSetInput = {
      status: payload.status,
      actualWeightKg: payload.actualWeightKg,
      actualReps: payload.actualReps,
      actualDurationSeconds: payload.actualDurationSeconds,
      actualDistanceMeters: payload.actualDistanceMeters,
      actualRir: payload.actualRir,
      actualRpe: payload.actualRpe,
      reachedFailure: payload.reachedFailure,
      notes: payload.notes,
      expectedVersion: command.expectedVersion,
      clientCommandId: command.id,
    };
    return updateWorkoutSet(
      command.workoutSessionId,
      payload.sessionExerciseId,
      payload.workoutSetId,
      input,
    );
  }

  if (command.type === 'PAUSE_WORKOUT') {
    return pauseWorkoutSession(command.workoutSessionId, {
      expectedVersion: command.expectedVersion,
      clientCommandId: command.id,
    });
  }
  if (command.type === 'RESUME_WORKOUT') {
    return resumeWorkoutSession(command.workoutSessionId, {
      expectedVersion: command.expectedVersion,
      clientCommandId: command.id,
    });
  }
  if (command.type === 'COMPLETE_WORKOUT') {
    const payload = command.payload as CompleteWorkoutCommandPayload;
    return completeWorkoutSession(command.workoutSessionId, {
      expectedVersion: command.expectedVersion,
      clientCommandId: command.id,
      notes: payload.notes,
    });
  }
  const payload = command.payload as CancelWorkoutCommandPayload;
  return cancelWorkoutSession(command.workoutSessionId, {
    expectedVersion: command.expectedVersion,
    clientCommandId: command.id,
    reason: payload.reason,
    keepRecordedData: true,
  });
}

function applyServerResultToSnapshot(
  current: WorkoutSessionDetail,
  command: StoredWorkoutCommand,
  result: UpdateWorkoutSetResult | WorkoutLifecycleResult,
): WorkoutSessionDetail {
  if ('workoutSet' in result) {
    return applyUpdateWorkoutSetResult(current, result);
  }
  return result.workoutSession;
}

export async function syncWorkoutSession(
  userId: string,
  workoutSessionId: string,
  options: {
    force?: boolean;
    onSessionUpdated?: (session: WorkoutSessionDetail | null) => void;
  } = {},
): Promise<SyncResult> {
  const lockKey = `${userId}:${workoutSessionId}`;
  if (syncingSessions.has(lockKey)) {
    return { status: 'busy', applied: 0 };
  }

  const syncState = await getSyncState(userId, workoutSessionId);
  const now = Date.now();
  if (
    !options.force &&
    syncState?.backoffUntilEpochMs &&
    syncState.backoffUntilEpochMs > now
  ) {
    return { status: 'offline', applied: 0 };
  }

  const lease = tryAcquireLease(syncState, now);
  if (!lease) {
    return { status: 'busy', applied: 0 };
  }

  syncingSessions.add(lockKey);
  let applied = 0;

  try {
    await putSyncState(
      buildSyncState({
        userId,
        workoutSessionId,
        status: 'SYNCING',
        pendingCount: (await listPendingCommands(userId, workoutSessionId))
          .length,
        lease,
        lastSyncedAt: syncState?.lastSyncedAt ?? null,
      }),
    );
    broadcastWorkoutSync({
      type: 'sync-started',
      userId,
      workoutSessionId,
    });

    const open = await listOpenCommands(userId, workoutSessionId);
    const blocking = open.find(
      (command) =>
        command.status === 'CONFLICT' || command.status === 'REJECTED',
    );
    if (blocking) {
      await putSyncState(
        buildSyncState({
          userId,
          workoutSessionId,
          status: blocking.status === 'CONFLICT' ? 'CONFLICT' : 'ERROR',
          pendingCount: open.length,
          conflictCommandId: blocking.id,
          lastErrorCode: blocking.errorCode,
          lastErrorMessage: blocking.errorMessage,
          lease: refreshLease(lease),
        }),
      );
      return {
        status: blocking.status === 'CONFLICT' ? 'conflict' : 'rejected',
        applied: 0,
      };
    }

    const pending = open.filter((command) => command.status === 'PENDING');
    if (pending.length === 0) {
      await putSyncState(
        buildSyncState({
          userId,
          workoutSessionId,
          status: 'IDLE',
          pendingCount: 0,
          lease: null,
          lastSyncedAt: new Date().toISOString(),
        }),
      );
      return { status: 'empty', applied: 0 };
    }

    for (const command of pending) {
      const syncingCommand: StoredWorkoutCommand = {
        ...command,
        status: 'SYNCING',
        attemptCount: command.attemptCount + 1,
        lastAttemptAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await putCommand(syncingCommand);
      await putSyncState(
        buildSyncState({
          userId,
          workoutSessionId,
          status: 'SYNCING',
          pendingCount: pending.length - applied,
          lease: refreshLease(lease),
        }),
      );

      try {
        const result = await executeCommand(syncingCommand);
        const snapshot = await getSnapshot(userId, workoutSessionId);
        if (snapshot) {
          const nextData = applyServerResultToSnapshot(
            snapshot.data,
            syncingCommand,
            result,
          );
          const remaining = (
            await listPendingCommands(userId, workoutSessionId)
          ).filter((item) => item.id !== syncingCommand.id);
          const serverVersion =
            'workoutSessionVersion' in result
              ? result.workoutSessionVersion
              : nextData.version;
          await saveSnapshot({
            ...snapshot,
            data: {
              ...nextData,
              version: serverVersion + remaining.length,
            },
            serverVersion,
            localVersion: serverVersion + remaining.length,
            savedAt: new Date().toISOString(),
            source: remaining.length > 0 ? 'local-optimistic' : 'server',
          });
          options.onSessionUpdated?.(
            remaining.length > 0
              ? {
                  ...nextData,
                  version: serverVersion + remaining.length,
                }
              : {
                  ...nextData,
                  version: serverVersion,
                },
          );
        } else if ('workoutSession' in result) {
          options.onSessionUpdated?.(result.workoutSession);
        }

        await deleteCommand(syncingCommand.id);
        applied += 1;
      } catch (error) {
        if (isAuthError(error)) {
          await putCommand({
            ...syncingCommand,
            status: 'PENDING',
            updatedAt: new Date().toISOString(),
          });
          await putSyncState(
            buildSyncState({
              userId,
              workoutSessionId,
              status: 'ERROR',
              pendingCount: pending.length - applied,
              lastErrorCode: 'UNAUTHORIZED',
              lastErrorMessage:
                'Session expirée. Reconnecte-toi pour synchroniser.',
              lease: null,
            }),
          );
          return { status: 'auth', applied };
        }

        if (isConflictError(error)) {
          await putCommand({
            ...syncingCommand,
            status: 'CONFLICT',
            errorCode: getErrorCode(error),
            errorMessage: getErrorMessage(error),
            updatedAt: new Date().toISOString(),
          });
          try {
            const serverDetail = await getWorkoutSessionDetail(
              workoutSessionId,
            );
            options.onSessionUpdated?.(serverDetail);
          } catch {
            // keep local
          }
          await putSyncState(
            buildSyncState({
              userId,
              workoutSessionId,
              status: 'CONFLICT',
              pendingCount: pending.length - applied,
              conflictCommandId: syncingCommand.id,
              lastErrorCode: getErrorCode(error),
              lastErrorMessage: getErrorMessage(error),
              lease: null,
            }),
          );
          return { status: 'conflict', applied };
        }

        if (isBusinessRejectError(error)) {
          await putCommand({
            ...syncingCommand,
            status: 'REJECTED',
            errorCode: getErrorCode(error),
            errorMessage: getErrorMessage(error),
            updatedAt: new Date().toISOString(),
          });
          await putSyncState(
            buildSyncState({
              userId,
              workoutSessionId,
              status: 'ERROR',
              pendingCount: pending.length - applied,
              conflictCommandId: syncingCommand.id,
              lastErrorCode: getErrorCode(error),
              lastErrorMessage: getErrorMessage(error),
              lease: null,
            }),
          );
          return { status: 'rejected', applied };
        }

        if (isNetworkError(error)) {
          const delay = getBackoffDelayMs(syncingCommand.attemptCount);
          await putCommand({
            ...syncingCommand,
            status: 'PENDING',
            updatedAt: new Date().toISOString(),
          });
          await putSyncState(
            buildSyncState({
              userId,
              workoutSessionId,
              status: 'OFFLINE',
              pendingCount: pending.length - applied,
              lastErrorCode: getErrorCode(error),
              lastErrorMessage:
                'Une connexion est nécessaire pour synchroniser.',
              backoffUntilEpochMs: Date.now() + delay,
              lease: null,
            }),
          );
          return { status: 'offline', applied };
        }

        await putCommand({
          ...syncingCommand,
          status: 'PENDING',
          errorCode: getErrorCode(error),
          errorMessage: getErrorMessage(error),
          updatedAt: new Date().toISOString(),
        });
        await putSyncState(
          buildSyncState({
            userId,
            workoutSessionId,
            status: 'ERROR',
            pendingCount: pending.length - applied,
            lastErrorCode: getErrorCode(error),
            lastErrorMessage: getErrorMessage(error),
            lease: null,
          }),
        );
        return { status: 'rejected', applied };
      }
    }

    await putSyncState(
      buildSyncState({
        userId,
        workoutSessionId,
        status: 'IDLE',
        pendingCount: 0,
        lease: null,
        lastSyncedAt: new Date().toISOString(),
        backoffUntilEpochMs: null,
      }),
    );
    return { status: 'synced', applied };
  } finally {
    syncingSessions.delete(lockKey);
    broadcastWorkoutSync({
      type: 'sync-finished',
      userId,
      workoutSessionId,
    });
  }
}

const scheduled = new Map<string, number>();

export function scheduleWorkoutSync(
  userId: string,
  workoutSessionId: string,
  options?: {
    delayMs?: number;
    onSessionUpdated?: (session: WorkoutSessionDetail | null) => void;
  },
): void {
  const key = `${userId}:${workoutSessionId}`;
  const existing = scheduled.get(key);
  if (existing != null) {
    window.clearTimeout(existing);
  }
  const delay = options?.delayMs ?? 300;
  const handle = window.setTimeout(() => {
    scheduled.delete(key);
    void syncWorkoutSession(userId, workoutSessionId, {
      onSessionUpdated: options?.onSessionUpdated,
    });
  }, delay);
  scheduled.set(key, handle);
}
