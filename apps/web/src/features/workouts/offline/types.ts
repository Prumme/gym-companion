import type {
  WorkoutSessionDetail,
  WorkoutSetStatus,
} from '@gym-companion/shared';

export type OfflineWorkoutCommandType =
  | 'UPDATE_WORKOUT_SET'
  | 'PAUSE_WORKOUT'
  | 'RESUME_WORKOUT'
  | 'COMPLETE_WORKOUT'
  | 'CANCEL_WORKOUT';

export type OfflineCommandStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'APPLIED'
  | 'CONFLICT'
  | 'REJECTED';

export type WorkoutSyncStatus =
  | 'IDLE'
  | 'OFFLINE'
  | 'PENDING'
  | 'SYNCING'
  | 'CONFLICT'
  | 'ERROR';

export type UpdateWorkoutSetCommandPayload = {
  sessionExerciseId: string;
  workoutSetId: string;
  status: WorkoutSetStatus;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  notes: string | null;
};

export type CompleteWorkoutCommandPayload = {
  notes: string | null;
};

export type CancelWorkoutCommandPayload = {
  reason: string | null;
  keepRecordedData: boolean;
};

export type StoredWorkoutSnapshot = {
  key: string;
  userId: string;
  workoutSessionId: string;
  data: WorkoutSessionDetail;
  serverVersion: number;
  localVersion: number;
  savedAt: string;
  source: 'server' | 'local-optimistic';
};

export type StoredWorkoutCommand = {
  id: string;
  userId: string;
  workoutSessionId: string;
  type: OfflineWorkoutCommandType;
  sequence: number;
  expectedVersion: number;
  payload: unknown;
  status: OfflineCommandStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SyncLease = {
  ownerTabId: string;
  acquiredAt: number;
  expiresAt: number;
};

export type StoredWorkoutSyncState = {
  key: string;
  userId: string;
  workoutSessionId: string;
  status: WorkoutSyncStatus;
  pendingCount: number;
  conflictCommandId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastSyncedAt: string | null;
  backoffUntilEpochMs: number | null;
  lease: SyncLease | null;
  updatedAt: string;
};

export function snapshotStorageKey(
  userId: string,
  workoutSessionId: string,
): string {
  return `${userId}:${workoutSessionId}`;
}
