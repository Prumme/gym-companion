import { describe, expect, it } from 'vitest';

import {
  SHARED_WORKOUT_JOIN_CODE_ALPHABET,
  canJoinSharedWorkoutRoomByCode,
  formatSharedWorkoutJoinCode,
  joinSharedWorkoutBodySchema,
  normalizeSharedWorkoutJoinCode,
} from './shared-workout-join-code';

describe('shared-workout-join-code', () => {
  it('normalise lowercase, tirets et espaces', () => {
    expect(normalizeSharedWorkoutJoinCode('k7m4px')).toBe('K7M4PX');
    expect(normalizeSharedWorkoutJoinCode('K7M-4PX')).toBe('K7M4PX');
    expect(normalizeSharedWorkoutJoinCode(' k7m-4px ')).toBe('K7M4PX');
  });

  it('refuse longueur / caractères invalides', () => {
    expect(() => normalizeSharedWorkoutJoinCode('ABC')).toThrow();
    expect(() => normalizeSharedWorkoutJoinCode('ABCDEFG')).toThrow();
    expect(() => normalizeSharedWorkoutJoinCode('AB0-123')).toThrow();
    expect(() => normalizeSharedWorkoutJoinCode('ABC_123')).toThrow();
    expect(() => normalizeSharedWorkoutJoinCode('IJKLMN')).toThrow();
  });

  it('formate XXX-XXX', () => {
    expect(formatSharedWorkoutJoinCode('K7M4PX')).toBe('K7M-4PX');
  });

  it('alphabet n’inclut pas les caractères ambigus', () => {
    expect(SHARED_WORKOUT_JOIN_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it('parse le body join', () => {
    expect(joinSharedWorkoutBodySchema.parse({ code: 'k7m-4px' })).toEqual({
      code: 'K7M4PX',
    });
  });

  it('autorise join uniquement LOBBY/ACTIVE', () => {
    expect(canJoinSharedWorkoutRoomByCode('LOBBY')).toBe(true);
    expect(canJoinSharedWorkoutRoomByCode('ACTIVE')).toBe(true);
    expect(canJoinSharedWorkoutRoomByCode('COMPLETED')).toBe(false);
    expect(canJoinSharedWorkoutRoomByCode('CANCELLED')).toBe(false);
  });
});
