import type { WorkoutSessionDetail } from '@gym-companion/shared';

import { getWorkoutSessionDetail } from '../api/workout-api';
import { clearRestTimerStorage } from '../lib/rest-timer-storage';
import { applyCommandsInOrder } from './apply-command';
import { createClientCommandId } from './command-id';
import {
  buildSyncState,
  deleteCommandsForSession,
  getSnapshot,
  listOpenCommands,
  putCommand,
  putSyncState,
  saveSnapshot,
} from './store';
import { snapshotStorageKey, type StoredWorkoutCommand } from './types';

export async function discardLocalChanges(args: {
  userId: string;
  workoutSessionId: string;
  serverDetail?: WorkoutSessionDetail;
}): Promise<WorkoutSessionDetail> {
  const server =
    args.serverDetail ??
    (await getWorkoutSessionDetail(args.workoutSessionId));

  await deleteCommandsForSession(args.userId, args.workoutSessionId);
  await saveSnapshot({
    key: snapshotStorageKey(args.userId, args.workoutSessionId),
    userId: args.userId,
    workoutSessionId: args.workoutSessionId,
    data: server,
    serverVersion: server.version,
    localVersion: server.version,
    savedAt: new Date().toISOString(),
    source: 'server',
  });
  await putSyncState(
    buildSyncState({
      userId: args.userId,
      workoutSessionId: args.workoutSessionId,
      status: 'IDLE',
      pendingCount: 0,
      lastSyncedAt: new Date().toISOString(),
    }),
  );

  if (server.status === 'COMPLETED' || server.status === 'CANCELLED') {
    clearRestTimerStorage(args.workoutSessionId);
  }

  return server;
}

export async function rebaseLocalChanges(args: {
  userId: string;
  workoutSessionId: string;
  serverDetail?: WorkoutSessionDetail;
}): Promise<
  | { ok: true; session: WorkoutSessionDetail; commandCount: number }
  | { ok: false; reason: string; failedCommandId: string | null }
> {
  const server =
    args.serverDetail ??
    (await getWorkoutSessionDetail(args.workoutSessionId));

  if (server.status === 'COMPLETED' || server.status === 'CANCELLED') {
    return {
      ok: false,
      reason:
        'La séance est déjà terminée ou annulée sur le serveur. Conservez la version serveur.',
      failedCommandId: null,
    };
  }

  const open = await listOpenCommands(args.userId, args.workoutSessionId);
  if (open.length === 0) {
    await discardLocalChanges({
      userId: args.userId,
      workoutSessionId: args.workoutSessionId,
      serverDetail: server,
    });
    return { ok: true, session: server, commandCount: 0 };
  }

  const replay = applyCommandsInOrder(
    server,
    open.map((command) => ({
      id: command.id,
      type: command.type,
      payload: command.payload,
      expectedVersion: command.expectedVersion,
    })),
  );

  if (!replay.ok) {
    return {
      ok: false,
      reason:
        'Une modification locale n’est plus applicable sur la version serveur.',
      failedCommandId: replay.failedCommandId,
    };
  }

  await deleteCommandsForSession(args.userId, args.workoutSessionId);

  const now = new Date().toISOString();
  const recreated: StoredWorkoutCommand[] = [];
  let expectedVersion = server.version;
  for (const [index, command] of open.entries()) {
    const next: StoredWorkoutCommand = {
      id: createClientCommandId(),
      userId: args.userId,
      workoutSessionId: args.workoutSessionId,
      type: command.type,
      sequence: index + 1,
      expectedVersion,
      payload: command.payload,
      status: 'PENDING',
      attemptCount: 0,
      lastAttemptAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    recreated.push(next);
    expectedVersion += 1;
    await putCommand(next);
  }

  await saveSnapshot({
    key: snapshotStorageKey(args.userId, args.workoutSessionId),
    userId: args.userId,
    workoutSessionId: args.workoutSessionId,
    data: replay.session,
    serverVersion: server.version,
    localVersion: expectedVersion,
    savedAt: now,
    source: 'local-optimistic',
  });
  await putSyncState(
    buildSyncState({
      userId: args.userId,
      workoutSessionId: args.workoutSessionId,
      status: 'PENDING',
      pendingCount: recreated.length,
    }),
  );

  return {
    ok: true,
    session: replay.session,
    commandCount: recreated.length,
  };
}

export async function loadConflictContext(
  userId: string,
  workoutSessionId: string,
) {
  const snapshot = await getSnapshot(userId, workoutSessionId);
  const commands = await listOpenCommands(userId, workoutSessionId);
  const conflict =
    commands.find((command) => command.status === 'CONFLICT') ??
    commands.find((command) => command.status === 'REJECTED') ??
    null;
  return { snapshot, commands, conflict };
}
