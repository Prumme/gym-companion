import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { applyCommandToSession } from '../offline/apply-command';
import { clearOfflineDbContents } from '../offline/db';
import { enqueueWorkoutCommand } from '../offline/enqueue';
import { listPendingCommands, persistServerSnapshot } from '../offline/store';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

describe('commande hors ligne UPDATE_WORKOUT_SET_TARGETS', () => {
  beforeEach(async () => {
    await clearOfflineDbContents();
  });

  it('applique seulement les clés fournies et incrémente la version', () => {
    const session = createWorkoutSessionDetail();
    const next = applyCommandToSession(
      session,
      {
        type: 'UPDATE_WORKOUT_SET_TARGETS',
        expectedVersion: 1,
        payload: { sessionExerciseId: 'wse-1', workoutSetId: 'ws-1', targetWeightKg: 65 },
      },
      2,
    );
    expect(next?.version).toBe(2);
    expect(next?.exercises[0]?.sets[0]).toMatchObject({
      targetWeightKg: 65,
      targetRepMin: 8,
      targetRepMax: 10,
      targetRestSeconds: 120,
    });
  });

  it('refuse une série déjà enregistrée ou une séance en pause', () => {
    const done = createWorkoutSessionDetail();
    done.exercises[0]!.sets = [createWorkoutSet({ status: 'COMPLETED' })];
    const command = {
      type: 'UPDATE_WORKOUT_SET_TARGETS' as const,
      expectedVersion: 1,
      payload: { sessionExerciseId: 'wse-1', workoutSetId: 'ws-1', targetRestSeconds: 90 },
    };
    expect(applyCommandToSession(done, command)).toBeNull();
    expect(
      applyCommandToSession(createWorkoutSessionDetail({ status: 'PAUSED' }), command),
    ).toBeNull();
  });

  it('se met en file avec la version attendue', async () => {
    const session = createWorkoutSessionDetail();
    await persistServerSnapshot('user-1', session);
    const { command, snapshot } = await enqueueWorkoutCommand({
      userId: 'user-1',
      workoutSessionId: session.id,
      type: 'UPDATE_WORKOUT_SET_TARGETS',
      payload: {
        sessionExerciseId: 'wse-1',
        workoutSetId: 'ws-1',
        targetRepMin: 5,
        targetRepMax: 5,
      },
    });
    expect(command.expectedVersion).toBe(1);
    expect(snapshot.data.exercises[0]?.sets[0]).toMatchObject({ targetRepMin: 5, targetRepMax: 5 });
    const pending = await listPendingCommands('user-1', session.id);
    expect(pending.map((c) => c.type)).toEqual(['UPDATE_WORKOUT_SET_TARGETS']);
  });
});
