import { z } from 'zod';

const workoutSetStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
]);

export const offlineCommandTypeSchema = z.enum([
  'UPDATE_WORKOUT_SET',
  'PAUSE_WORKOUT',
  'RESUME_WORKOUT',
  'COMPLETE_WORKOUT',
  'CANCEL_WORKOUT',
]);

export const offlineCommandStatusSchema = z.enum([
  'PENDING',
  'SYNCING',
  'APPLIED',
  'CONFLICT',
  'REJECTED',
]);

export const workoutSyncStatusSchema = z.enum([
  'IDLE',
  'OFFLINE',
  'PENDING',
  'SYNCING',
  'CONFLICT',
  'ERROR',
]);

export const updateSetPayloadSchema = z.object({
  sessionExerciseId: z.string().min(1),
  workoutSetId: z.string().min(1),
  status: workoutSetStatusSchema,
  actualWeightKg: z.number().nullable(),
  actualReps: z.number().int().nullable(),
  actualDurationSeconds: z.number().int().nullable(),
  actualDistanceMeters: z.number().nullable(),
  actualRir: z.number().int().nullable(),
  actualRpe: z.number().nullable(),
  reachedFailure: z.boolean(),
  notes: z.string().nullable(),
});

export const storedWorkoutSnapshotSchema = z.object({
  key: z.string().min(1),
  userId: z.string().min(1),
  workoutSessionId: z.string().min(1),
  data: z.record(z.unknown()),
  serverVersion: z.number().int().nonnegative(),
  localVersion: z.number().int().nonnegative(),
  savedAt: z.string().min(1),
  source: z.enum(['server', 'local-optimistic']),
});

export const storedWorkoutCommandSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  workoutSessionId: z.string().min(1),
  type: offlineCommandTypeSchema,
  sequence: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
  payload: z.unknown(),
  status: offlineCommandStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  lastAttemptAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const syncLeaseSchema = z.object({
  ownerTabId: z.string().min(1),
  acquiredAt: z.number(),
  expiresAt: z.number(),
});

export const storedWorkoutSyncStateSchema = z.object({
  key: z.string().min(1),
  userId: z.string().min(1),
  workoutSessionId: z.string().min(1),
  status: workoutSyncStatusSchema,
  pendingCount: z.number().int().nonnegative(),
  conflictCommandId: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  backoffUntilEpochMs: z.number().nullable(),
  lease: syncLeaseSchema.nullable(),
  updatedAt: z.string().min(1),
});
