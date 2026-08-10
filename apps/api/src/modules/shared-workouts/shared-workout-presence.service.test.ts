import { describe, expect, it } from 'vitest';

import { SharedWorkoutPresenceService } from './shared-workout-presence.service';

describe('SharedWorkoutPresenceService', () => {
  it('gère multi-tab : joined une fois, left à la dernière socket', () => {
    const presence = new SharedWorkoutPresenceService();
    const roomId = 'room-1';
    const userId = 'user-b';

    expect(presence.addSocket(roomId, userId, 's1').becameOnline).toBe(true);
    expect(presence.addSocket(roomId, userId, 's2').becameOnline).toBe(false);
    expect(presence.getConnectedUserIds(roomId)).toEqual([userId]);

    expect(presence.removeSocket(roomId, userId, 's1').becameOffline).toBe(
      false,
    );
    expect(presence.getConnectedUserIds(roomId)).toEqual([userId]);

    expect(presence.removeSocket(roomId, userId, 's2').becameOffline).toBe(
      true,
    );
    expect(presence.getConnectedUserIds(roomId)).toEqual([]);
  });

  it('supporte plusieurs rooms pour le même user', () => {
    const presence = new SharedWorkoutPresenceService();
    presence.addSocket('r1', 'u1', 's1');
    presence.addSocket('r2', 'u1', 's2');
    expect(presence.getConnectedUserIds('r1')).toEqual(['u1']);
    expect(presence.getConnectedUserIds('r2')).toEqual(['u1']);
    presence.removeSocketEverywhere('s1');
    expect(presence.getConnectedUserIds('r1')).toEqual([]);
    expect(presence.getConnectedUserIds('r2')).toEqual(['u1']);
  });

  it('clearRoom et removeUser', () => {
    const presence = new SharedWorkoutPresenceService();
    presence.addSocket('r1', 'a', 's1');
    presence.addSocket('r1', 'b', 's2');
    const removed = presence.removeUser('r1', 'b');
    expect(removed.wasOnline).toBe(true);
    expect(presence.getConnectedUserIds('r1')).toEqual(['a']);
    presence.clearRoom('r1');
    expect(presence.getConnectedUserIds('r1')).toEqual([]);
  });
});
