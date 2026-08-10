import { describe, expect, it, vi, beforeEach } from 'vitest';

const setHandlers = vi.fn();
const subscribe = vi.fn(async () => ({
  ok: true,
  roomId: 'room-1',
  presence: { connectedUserIds: ['user-a'] },
}));
const unsubscribe = vi.fn();
const disconnect = vi.fn();

vi.mock('../lib/shared-workout-realtime', () => ({
  sharedWorkoutRealtimeClient: {
    setHandlers,
    subscribe,
    unsubscribe,
    disconnect,
  },
}));

describe('shared-workout realtime client mock', () => {
  beforeEach(() => {
    setHandlers.mockClear();
    subscribe.mockClear();
    unsubscribe.mockClear();
    disconnect.mockClear();
  });

  it('expose un contrat subscribe ok avec snapshot', async () => {
    const ack = await subscribe();
    expect(ack.ok).toBe(true);
    expect(ack.presence.connectedUserIds).toContain('user-a');
  });
});
