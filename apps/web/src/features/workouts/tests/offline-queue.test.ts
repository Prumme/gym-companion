import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { applyCommandToSession, applyCommandsInOrder } from '../offline/apply-command';
import { clearOfflineDbContents } from '../offline/db';
import { enqueueWorkoutCommand } from '../offline/enqueue';
import {
  clearAllForUser,
  getSnapshot,
  listPendingCommands,
  persistServerSnapshot,
} from '../offline/store';
import { getBackoffDelayMs } from '../offline/sync-engine';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

describe('offline apply-command', () => {
  it('applique une série et incrémente la version', () => {
    const session = createWorkoutSessionDetail();
    const next = applyCommandToSession(
      session,
      {
        type: 'UPDATE_WORKOUT_SET',
        expectedVersion: 1,
        payload: {
          sessionExerciseId: 'wse-1',
          workoutSetId: 'ws-1',
          status: 'COMPLETED',
          actualWeightKg: 60,
          actualReps: 10,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          actualRir: 1,
          actualRpe: null,
          reachedFailure: false,
          notes: null,
        },
      },
      2,
    );
    expect(next?.version).toBe(2);
    expect(next?.exercises[0]?.sets[0]?.status).toBe('COMPLETED');
    expect(next?.exercises[0]?.sets[0]?.actualReps).toBe(10);
  });

  it('enchaîne pause puis reprise', () => {
    const session = createWorkoutSessionDetail();
    const result = applyCommandsInOrder(session, [
      {
        id: '1',
        type: 'PAUSE_WORKOUT',
        payload: {},
        expectedVersion: 1,
      },
      {
        id: '2',
        type: 'RESUME_WORKOUT',
        payload: {},
        expectedVersion: 2,
      },
    ]);
    expect(result.ok).toBe(true);
    expect(result.session.status).toBe('ACTIVE');
    expect(result.session.version).toBe(3);
  });

  it('refuse une série pendant la pause', () => {
    const paused = createWorkoutSessionDetail({
      status: 'PAUSED',
      permissions: {
        canPause: false,
        canResume: true,
        canComplete: true,
        canCancel: true,
        canRecordSets: false,
      },
    });
    const next = applyCommandToSession(paused, {
      type: 'UPDATE_WORKOUT_SET',
      expectedVersion: 1,
      payload: {
        sessionExerciseId: 'wse-1',
        workoutSetId: 'ws-1',
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 8,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
      },
    });
    expect(next).toBeNull();
  });
});

describe('offline store + enqueue', () => {
  beforeEach(async () => {
    await clearOfflineDbContents();
  });

  it('persiste un snapshot serveur puis une commande chaînée', async () => {
    const session = createWorkoutSessionDetail();
    await persistServerSnapshot('user-1', session);
    const first = await enqueueWorkoutCommand({
      userId: 'user-1',
      workoutSessionId: session.id,
      type: 'UPDATE_WORKOUT_SET',
      payload: {
        sessionExerciseId: 'wse-1',
        workoutSetId: 'ws-1',
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: 2,
        actualRpe: null,
        reachedFailure: false,
        notes: null,
      },
    });
    expect(first.command.expectedVersion).toBe(1);
    expect(first.snapshot.localVersion).toBe(2);
    expect(first.snapshot.serverVersion).toBe(1);

    const second = await enqueueWorkoutCommand({
      userId: 'user-1',
      workoutSessionId: session.id,
      type: 'PAUSE_WORKOUT',
      payload: {},
    });
    expect(second.command.expectedVersion).toBe(2);
    expect(second.command.sequence).toBe(2);

    const pending = await listPendingCommands('user-1', session.id);
    expect(pending.map((c) => c.expectedVersion)).toEqual([1, 2]);

    const dumped = JSON.stringify(await getSnapshot('user-1', session.id));
    expect(dumped).not.toMatch(/token|password|Bearer/i);
  });

  it('isole les utilisateurs', async () => {
    const session = createWorkoutSessionDetail();
    await persistServerSnapshot('user-a', session);
    await enqueueWorkoutCommand({
      userId: 'user-a',
      workoutSessionId: session.id,
      type: 'PAUSE_WORKOUT',
      payload: {},
    });
    expect(await listPendingCommands('user-b', session.id)).toHaveLength(0);
    await clearAllForUser('user-a');
    expect(await getSnapshot('user-a', session.id)).toBeNull();
  });
});

describe('sync backoff', () => {
  it('borne le backoff', () => {
    expect(getBackoffDelayMs(1)).toBe(2000);
    expect(getBackoffDelayMs(2)).toBe(5000);
    expect(getBackoffDelayMs(99)).toBe(60_000);
  });
});

describe('fixtures set helper', () => {
  it('crée une série pending', () => {
    expect(createWorkoutSet().status).toBe('PENDING');
  });
});
