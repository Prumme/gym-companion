import { describe, expect, it } from 'vitest';
import {
  sharedWorkoutRoomSubscribeBodySchema,
  sharedWorkoutRoomUnsubscribeBodySchema,
} from './shared-workout-realtime';

describe('shared-workout-realtime (Shared 5.3)', () => {
  it('valide subscribe/unsubscribe stricts', () => {
    const roomId = '11111111-1111-4111-8111-111111111111';
    expect(sharedWorkoutRoomSubscribeBodySchema.parse({ roomId })).toEqual({
      roomId,
    });
    expect(() =>
      sharedWorkoutRoomSubscribeBodySchema.parse({ roomId, extra: true }),
    ).toThrow();
    expect(() =>
      sharedWorkoutRoomSubscribeBodySchema.parse({ roomId: 'bad' }),
    ).toThrow();
    expect(sharedWorkoutRoomUnsubscribeBodySchema.parse({ roomId })).toEqual({
      roomId,
    });
  });
});
