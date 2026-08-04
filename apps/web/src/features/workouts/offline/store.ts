import type { WorkoutSessionDetail } from '@gym-companion/shared';

import { getOfflineDb } from './db';
import {
  storedWorkoutCommandSchema,
  storedWorkoutSnapshotSchema,
  storedWorkoutSyncStateSchema,
} from './schemas';
import {
  snapshotStorageKey,
  type StoredWorkoutCommand,
  type StoredWorkoutSnapshot,
  type StoredWorkoutSyncState,
  type WorkoutSyncStatus,
} from './types';

function parseSnapshot(raw: unknown): StoredWorkoutSnapshot | null {
  const parsed = storedWorkoutSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data as StoredWorkoutSnapshot;
}

function parseCommand(raw: unknown): StoredWorkoutCommand | null {
  const parsed = storedWorkoutCommandSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return {
    ...parsed.data,
    payload: parsed.data.payload ?? {},
  };
}

function parseSyncState(raw: unknown): StoredWorkoutSyncState | null {
  const parsed = storedWorkoutSyncStateSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function saveSnapshot(
  snapshot: StoredWorkoutSnapshot,
): Promise<void> {
  const db = await getOfflineDb();
  await db.put('workoutSnapshots', snapshot);
}

export async function getSnapshot(
  userId: string,
  workoutSessionId: string,
): Promise<StoredWorkoutSnapshot | null> {
  const db = await getOfflineDb();
  const raw = await db.get(
    'workoutSnapshots',
    snapshotStorageKey(userId, workoutSessionId),
  );
  return parseSnapshot(raw);
}

export async function listSnapshotsForUser(
  userId: string,
): Promise<StoredWorkoutSnapshot[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex('workoutSnapshots', 'by-user', userId);
  return rows
    .map((row) => parseSnapshot(row))
    .filter((row): row is StoredWorkoutSnapshot => row != null);
}

export async function getLocalActiveSnapshot(
  userId: string,
): Promise<StoredWorkoutSnapshot | null> {
  const snapshots = await listSnapshotsForUser(userId);
  const active = snapshots
    .filter(
      (snapshot) =>
        snapshot.data.status === 'ACTIVE' || snapshot.data.status === 'PAUSED',
    )
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return active[0] ?? null;
}

export async function persistServerSnapshot(
  userId: string,
  detail: WorkoutSessionDetail,
): Promise<StoredWorkoutSnapshot | null> {
  try {
    const existing = await getSnapshot(userId, detail.id);
    const pending = await listOpenCommands(userId, detail.id);
    if (pending.length > 0 && existing) {
      // Ne pas écraser un état optimiste local tant que des commandes restent.
      return existing;
    }
    const snapshot: StoredWorkoutSnapshot = {
      key: snapshotStorageKey(userId, detail.id),
      userId,
      workoutSessionId: detail.id,
      data: detail,
      serverVersion: detail.version,
      localVersion: detail.version,
      savedAt: new Date().toISOString(),
      source: 'server',
    };
    await saveSnapshot(snapshot);
    const previousLease = existing
      ? (await getSyncState(userId, detail.id))?.lease ?? null
      : null;
    await putSyncState({
      key: snapshot.key,
      userId,
      workoutSessionId: detail.id,
      status: 'IDLE',
      pendingCount: 0,
      conflictCommandId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastSyncedAt: new Date().toISOString(),
      backoffUntilEpochMs: null,
      lease: previousLease,
      updatedAt: new Date().toISOString(),
    });
    return snapshot;
  } catch {
    return null;
  }
}

export async function listOpenCommands(
  userId: string,
  workoutSessionId: string,
): Promise<StoredWorkoutCommand[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex('workoutCommands', 'by-user-session', [
    userId,
    workoutSessionId,
  ]);
  return rows
    .map((row) => parseCommand(row))
    .filter((row): row is StoredWorkoutCommand => row != null)
    .filter((row) =>
      ['PENDING', 'SYNCING', 'CONFLICT', 'REJECTED'].includes(row.status),
    )
    .sort((a, b) => a.sequence - b.sequence);
}

export async function listPendingCommands(
  userId: string,
  workoutSessionId: string,
): Promise<StoredWorkoutCommand[]> {
  const open = await listOpenCommands(userId, workoutSessionId);
  return open.filter((command) => command.status === 'PENDING');
}

export async function nextSequence(
  userId: string,
  workoutSessionId: string,
): Promise<number> {
  const open = await listOpenCommands(userId, workoutSessionId);
  const db = await getOfflineDb();
  const all = await db.getAllFromIndex('workoutCommands', 'by-user-session', [
    userId,
    workoutSessionId,
  ]);
  const maxSeq = Math.max(
    0,
    ...open.map((c) => c.sequence),
    ...all.map((c) => (typeof c.sequence === 'number' ? c.sequence : 0)),
  );
  return maxSeq + 1;
}

export async function putCommand(command: StoredWorkoutCommand): Promise<void> {
  const db = await getOfflineDb();
  await db.put('workoutCommands', command);
}

export async function deleteCommand(commandId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('workoutCommands', commandId);
}

export async function deleteCommandsForSession(
  userId: string,
  workoutSessionId: string,
): Promise<void> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex('workoutCommands', 'by-user-session', [
    userId,
    workoutSessionId,
  ]);
  const tx = db.transaction('workoutCommands', 'readwrite');
  await Promise.all([
    ...rows.map((row) => tx.store.delete(row.id)),
    tx.done,
  ]);
}

export async function getSyncState(
  userId: string,
  workoutSessionId: string,
): Promise<StoredWorkoutSyncState | null> {
  const db = await getOfflineDb();
  const raw = await db.get(
    'workoutSyncState',
    snapshotStorageKey(userId, workoutSessionId),
  );
  return parseSyncState(raw);
}

export async function putSyncState(
  state: StoredWorkoutSyncState,
): Promise<void> {
  const db = await getOfflineDb();
  await db.put('workoutSyncState', state);
}

export async function atomicEnqueue(args: {
  command: StoredWorkoutCommand;
  snapshot: StoredWorkoutSnapshot;
  syncState: StoredWorkoutSyncState;
}): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(
    ['workoutCommands', 'workoutSnapshots', 'workoutSyncState'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('workoutCommands').put(args.command),
    tx.objectStore('workoutSnapshots').put(args.snapshot),
    tx.objectStore('workoutSyncState').put(args.syncState),
    tx.done,
  ]);
}

export async function hasPendingCommandsForUser(
  userId: string,
): Promise<boolean> {
  const all = await (await getOfflineDb()).getAll('workoutCommands');
  return all.some(
    (row) =>
      row.userId === userId &&
      ['PENDING', 'SYNCING', 'CONFLICT', 'REJECTED'].includes(row.status),
  );
}

export async function hasPendingTerminalCommand(
  userId: string,
): Promise<boolean> {
  const all = await (await getOfflineDb()).getAll('workoutCommands');
  return all.some(
    (row) =>
      row.userId === userId &&
      (row.type === 'COMPLETE_WORKOUT' || row.type === 'CANCEL_WORKOUT') &&
      ['PENDING', 'SYNCING', 'CONFLICT', 'REJECTED'].includes(row.status),
  );
}

export async function countPendingForUser(userId: string): Promise<number> {
  const all = await (await getOfflineDb()).getAll('workoutCommands');
  return all.filter(
    (row) =>
      row.userId === userId &&
      ['PENDING', 'SYNCING', 'CONFLICT', 'REJECTED'].includes(row.status),
  ).length;
}

export async function clearAllForUser(userId: string): Promise<string[]> {
  const db = await getOfflineDb();
  const snapshots = await db.getAllFromIndex('workoutSnapshots', 'by-user', userId);
  const sessionIds = snapshots.map((s) => s.workoutSessionId);
  const commands = await db.getAll('workoutCommands');
  const syncStates = await db.getAllFromIndex(
    'workoutSyncState',
    'by-user',
    userId,
  );

  const tx = db.transaction(
    ['workoutSnapshots', 'workoutCommands', 'workoutSyncState'],
    'readwrite',
  );
  await Promise.all([
    ...snapshots.map((s) => tx.objectStore('workoutSnapshots').delete(s.key)),
    ...commands
      .filter((c) => c.userId === userId)
      .map((c) => tx.objectStore('workoutCommands').delete(c.id)),
    ...syncStates.map((s) => tx.objectStore('workoutSyncState').delete(s.key)),
    tx.done,
  ]);
  return sessionIds;
}

export function buildSyncState(args: {
  userId: string;
  workoutSessionId: string;
  status: WorkoutSyncStatus;
  pendingCount: number;
  conflictCommandId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  backoffUntilEpochMs?: number | null;
  lease?: StoredWorkoutSyncState['lease'];
  lastSyncedAt?: string | null;
}): StoredWorkoutSyncState {
  return {
    key: snapshotStorageKey(args.userId, args.workoutSessionId),
    userId: args.userId,
    workoutSessionId: args.workoutSessionId,
    status: args.status,
    pendingCount: args.pendingCount,
    conflictCommandId: args.conflictCommandId ?? null,
    lastErrorCode: args.lastErrorCode ?? null,
    lastErrorMessage: args.lastErrorMessage ?? null,
    lastSyncedAt: args.lastSyncedAt ?? null,
    backoffUntilEpochMs: args.backoffUntilEpochMs ?? null,
    lease: args.lease ?? null,
    updatedAt: new Date().toISOString(),
  };
}
