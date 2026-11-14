import { describe, expect, it } from 'vitest';

import { deriveBatchSetCommandId, planWarmupInsertion } from './workout-set-positions';

describe('planWarmupInsertion', () => {
  it('insère avant la première série WORKING et décale les suivantes', () => {
    const plan = planWarmupInsertion(
      [
        { id: 'w1', position: 0, setType: 'WORKING' },
        { id: 'w2', position: 1, setType: 'WORKING' },
      ],
      3,
    );
    expect(plan.newPositions).toEqual([0, 1, 2]);
    expect(plan.existing).toEqual([
      { id: 'w1', position: 3 },
      { id: 'w2', position: 4 },
    ]);
  });

  it('garde les séries WARMUP existantes devant', () => {
    const plan = planWarmupInsertion(
      [
        { id: 'work', position: 1, setType: 'WORKING' },
        { id: 'warm', position: 0, setType: 'WARMUP' },
      ],
      2,
    );
    expect(plan.newPositions).toEqual([1, 2]);
    expect(plan.existing).toEqual([
      { id: 'warm', position: 0 },
      { id: 'work', position: 3 },
    ]);
  });

  it('ajoute à la fin sans série non-WARMUP et recompacte les trous', () => {
    const plan = planWarmupInsertion([{ id: 'warm', position: 4, setType: 'WARMUP' }], 1);
    expect(plan.newPositions).toEqual([1]);
    expect(plan.existing).toEqual([{ id: 'warm', position: 0 }]);
  });

  it('insère avant un BACKOFF placé en tête', () => {
    const plan = planWarmupInsertion([{ id: 'b', position: 0, setType: 'BACKOFF' }], 1);
    expect(plan.newPositions).toEqual([0]);
    expect(plan.existing).toEqual([{ id: 'b', position: 1 }]);
  });
});

describe('deriveBatchSetCommandId', () => {
  it('garde l’identifiant pour la première série puis suffixe', () => {
    expect(deriveBatchSetCommandId('cmd', 0)).toBe('cmd');
    expect(deriveBatchSetCommandId('cmd', 2)).toBe('cmd:2');
  });
});
