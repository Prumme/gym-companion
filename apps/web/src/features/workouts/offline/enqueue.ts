import type { WorkoutSessionDetail } from '@gym-companion/shared';

import { applyCommandToSession } from './apply-command';
import { createClientCommandId } from './command-id';
import {
  atomicEnqueue,
  buildSyncState,
  getSnapshot,
  listOpenCommands,
  nextSequence,
} from './store';
import type {
  OfflineWorkoutCommandType,
  StoredWorkoutCommand,
  StoredWorkoutSnapshot,
} from './types';
import { snapshotStorageKey } from './types';

export async function enqueueWorkoutCommand(args: {
  userId: string;
  workoutSessionId: string;
  type: OfflineWorkoutCommandType;
  payload: unknown;
  baseSession?: WorkoutSessionDetail;
}): Promise<{ snapshot: StoredWorkoutSnapshot; command: StoredWorkoutCommand }> {
  const existing = await getSnapshot(args.userId, args.workoutSessionId);
  const base = args.baseSession ?? existing?.data;
  if (!base) {
    throw new Error(
      'Impossible d’enregistrer une commande hors ligne sans snapshot local.',
    );
  }

  const sequence = await nextSequence(args.userId, args.workoutSessionId);
  const expectedVersion = existing?.localVersion ?? base.version;
  const commandId = createClientCommandId();
  const now = new Date().toISOString();

  const command: StoredWorkoutCommand = {
    id: commandId,
    userId: args.userId,
    workoutSessionId: args.workoutSessionId,
    type: args.type,
    sequence,
    expectedVersion,
    payload: args.payload,
    status: 'PENDING',
    attemptCount: 0,
    lastAttemptAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  const nextSession = applyCommandToSession(base, command, expectedVersion + 1);
  if (!nextSession) {
    throw new Error('Cette modification n’est pas applicable à l’état local.');
  }

  const open = await listOpenCommands(args.userId, args.workoutSessionId);
  const snapshot: StoredWorkoutSnapshot = {
    key: snapshotStorageKey(args.userId, args.workoutSessionId),
    userId: args.userId,
    workoutSessionId: args.workoutSessionId,
    data: nextSession,
    serverVersion: existing?.serverVersion ?? base.version,
    localVersion: expectedVersion + 1,
    savedAt: now,
    source: 'local-optimistic',
  };

  const syncState = buildSyncState({
    userId: args.userId,
    workoutSessionId: args.workoutSessionId,
    status: typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'OFFLINE'
      : 'PENDING',
    pendingCount: open.filter((c) => c.status === 'PENDING').length + 1,
  });

  await atomicEnqueue({ command, snapshot, syncState });
  return { snapshot, command };
}
