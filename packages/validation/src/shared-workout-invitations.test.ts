import { describe, expect, it } from 'vitest';
import {
  canAcceptSharedWorkoutRoomInvitation,
  canInviteToSharedWorkoutRoom,
  canLeaveSharedWorkoutRoom,
  createSharedWorkoutRoomInvitationBodySchema,
  sharedWorkoutRoomInvitationListQuerySchema,
} from './shared-workout-invitations';

describe('shared-workout-invitations (Shared 5.2)', () => {
  it('normalise inviteeEmail comme auth', () => {
    expect(
      createSharedWorkoutRoomInvitationBodySchema.parse({
        inviteeEmail: '  Alice@Example.COM ',
      }),
    ).toEqual({ inviteeEmail: 'alice@example.com' });
    expect(() =>
      createSharedWorkoutRoomInvitationBodySchema.parse({ inviteeUserId: 'x' }),
    ).toThrow();
  });

  it('room éligible invite / accept / leave', () => {
    expect(canInviteToSharedWorkoutRoom('LOBBY')).toBe(true);
    expect(canInviteToSharedWorkoutRoom('ACTIVE')).toBe(true);
    expect(canInviteToSharedWorkoutRoom('COMPLETED')).toBe(false);
    expect(canAcceptSharedWorkoutRoomInvitation('ACTIVE')).toBe(true);
    expect(canAcceptSharedWorkoutRoomInvitation('CANCELLED')).toBe(false);
    expect(canLeaveSharedWorkoutRoom('LOBBY')).toBe(true);
    expect(canLeaveSharedWorkoutRoom('COMPLETED')).toBe(false);
  });

  it('filtre liste invitations', () => {
    expect(
      sharedWorkoutRoomInvitationListQuerySchema.parse({
        status: 'PENDING',
        limit: '5',
      }),
    ).toEqual({ status: 'PENDING', limit: 5 });
    expect(() =>
      sharedWorkoutRoomInvitationListQuerySchema.parse({ status: 'EXPIRED' }),
    ).toThrow();
  });
});
