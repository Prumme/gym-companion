import { describe, expect, it } from 'vitest';

import {
  buildSharedWorkoutEquipmentCommandFingerprint,
  computeWaitingQueuePosition,
  isCoordinatableEquipmentCode,
  sharedWorkoutEquipmentCommandBodySchema,
} from './shared-workout-equipment';

describe('isCoordinatableEquipmentCode', () => {
  it('exclut bodyweight', () => {
    expect(isCoordinatableEquipmentCode('bodyweight')).toBe(false);
  });

  it('autorise cable / machine / barbell', () => {
    expect(isCoordinatableEquipmentCode('cable')).toBe(true);
    expect(isCoordinatableEquipmentCode('machine')).toBe(true);
    expect(isCoordinatableEquipmentCode('barbell')).toBe(true);
    expect(isCoordinatableEquipmentCode('dumbbell')).toBe(true);
  });

  it('refuse null/empty', () => {
    expect(isCoordinatableEquipmentCode(null)).toBe(false);
    expect(isCoordinatableEquipmentCode('')).toBe(false);
  });
});

describe('sharedWorkoutEquipmentCommandBodySchema', () => {
  it('refuse equipmentTypeId injecté', () => {
    const parsed = sharedWorkoutEquipmentCommandBodySchema.safeParse({
      clientCommandId: '11111111-1111-1111-1111-111111111111',
      equipmentTypeId: '22222222-2222-2222-2222-222222222222',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepte clientCommandId seul', () => {
    const parsed = sharedWorkoutEquipmentCommandBodySchema.safeParse({
      clientCommandId: '11111111-1111-1111-1111-111111111111',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('computeWaitingQueuePosition', () => {
  it('ordonne requestedAt puis id', () => {
    const entries = [
      { id: 'b', requestedAt: '2026-08-10T10:00:02.000Z' },
      { id: 'a', requestedAt: '2026-08-10T10:00:01.000Z' },
      { id: 'c', requestedAt: '2026-08-10T10:00:01.000Z' },
    ];
    expect(computeWaitingQueuePosition(entries, 'a')).toBe(1);
    expect(computeWaitingQueuePosition(entries, 'c')).toBe(2);
    expect(computeWaitingQueuePosition(entries, 'b')).toBe(3);
  });
});

describe('fingerprint', () => {
  it('stable par action+room', () => {
    expect(
      buildSharedWorkoutEquipmentCommandFingerprint({
        action: 'REQUEST',
        roomId: 'r1',
      }),
    ).toBe('REQUEST:r1');
  });
});
