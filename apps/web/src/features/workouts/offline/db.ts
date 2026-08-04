import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type {
  StoredWorkoutCommand,
  StoredWorkoutSnapshot,
  StoredWorkoutSyncState,
} from './types';

const DB_NAME = 'gym-companion-offline';
const DB_VERSION = 1;

interface GymCompanionOfflineDb extends DBSchema {
  workoutSnapshots: {
    key: string;
    value: StoredWorkoutSnapshot;
    indexes: { 'by-user': string };
  };
  workoutCommands: {
    key: string;
    value: StoredWorkoutCommand;
    indexes: {
      'by-user-session': [string, string];
      'by-user-session-sequence': [string, string, number];
    };
  };
  workoutSyncState: {
    key: string;
    value: StoredWorkoutSyncState;
    indexes: { 'by-user': string };
  };
}

let dbPromise: Promise<IDBPDatabase<GymCompanionOfflineDb>> | null = null;

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<GymCompanionOfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workoutSnapshots')) {
          const snapshots = db.createObjectStore('workoutSnapshots', {
            keyPath: 'key',
          });
          snapshots.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('workoutCommands')) {
          const commands = db.createObjectStore('workoutCommands', {
            keyPath: 'id',
          });
          commands.createIndex('by-user-session', ['userId', 'workoutSessionId']);
          commands.createIndex('by-user-session-sequence', [
            'userId',
            'workoutSessionId',
            'sequence',
          ]);
        }
        if (!db.objectStoreNames.contains('workoutSyncState')) {
          const sync = db.createObjectStore('workoutSyncState', {
            keyPath: 'key',
          });
          sync.createIndex('by-user', 'userId');
        }
      },
    });
  }
  return dbPromise;
}

export async function closeOfflineDb() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export async function clearOfflineDbContents() {
  const db = await getOfflineDb();
  const tx = db.transaction(
    ['workoutSnapshots', 'workoutCommands', 'workoutSyncState'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('workoutSnapshots').clear(),
    tx.objectStore('workoutCommands').clear(),
    tx.objectStore('workoutSyncState').clear(),
    tx.done,
  ]);
}
