import { describe, expect, it } from 'vitest';
import {
  SHARED_WORKOUT_ROOM_DEFAULT_NAME,
  canRenameSharedWorkoutRoom,
  createSharedWorkoutRoomBodySchema,
  resolveSharedWorkoutRoomLifecycleTransition,
  resolveSharedWorkoutRoomName,
  sharedWorkoutRoomListQuerySchema,
} from './shared-workout-rooms';

describe('shared-workout-rooms (Shared 5.1)', () => {
  it('valide création et fallback de nom', () => {
    expect(createSharedWorkoutRoomBodySchema.parse({})).toEqual({});
    expect(createSharedWorkoutRoomBodySchema.parse({ name: '  Push  ' })).toEqual({
      name: 'Push',
    });
    expect(resolveSharedWorkoutRoomName(undefined)).toBe(
      SHARED_WORKOUT_ROOM_DEFAULT_NAME,
    );
    expect(resolveSharedWorkoutRoomName('  ')).toBe(
      SHARED_WORKOUT_ROOM_DEFAULT_NAME,
    );
    expect(resolveSharedWorkoutRoomName('Ma salle')).toBe('Ma salle');
  });

  it('transitions lifecycle autorisées et refusées', () => {
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('LOBBY', 'START'),
    ).toMatchObject({ ok: true, kind: 'apply', nextStatus: 'ACTIVE' });
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('ACTIVE', 'COMPLETE'),
    ).toMatchObject({ ok: true, kind: 'apply', nextStatus: 'COMPLETED' });
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('LOBBY', 'CANCEL'),
    ).toMatchObject({ ok: true, kind: 'apply', nextStatus: 'CANCELLED' });
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('ACTIVE', 'CANCEL'),
    ).toMatchObject({ ok: true, kind: 'apply', nextStatus: 'CANCELLED' });

    expect(
      resolveSharedWorkoutRoomLifecycleTransition('LOBBY', 'COMPLETE').ok,
    ).toBe(false);
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('COMPLETED', 'START').ok,
    ).toBe(false);
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('COMPLETED', 'CANCEL').ok,
    ).toBe(false);
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('CANCELLED', 'START').ok,
    ).toBe(false);
    expect(
      resolveSharedWorkoutRoomLifecycleTransition('ACTIVE', 'START'),
    ).toEqual({ ok: true, kind: 'noop' });
  });

  it('rename seulement LOBBY/ACTIVE', () => {
    expect(canRenameSharedWorkoutRoom('LOBBY')).toBe(true);
    expect(canRenameSharedWorkoutRoom('ACTIVE')).toBe(true);
    expect(canRenameSharedWorkoutRoom('COMPLETED')).toBe(false);
    expect(canRenameSharedWorkoutRoom('CANCELLED')).toBe(false);
  });

  it('filtre de liste status', () => {
    expect(
      sharedWorkoutRoomListQuerySchema.parse({ status: 'ACTIVE', limit: '10' }),
    ).toEqual({ status: 'ACTIVE', limit: 10 });
    expect(() =>
      sharedWorkoutRoomListQuerySchema.parse({ status: 'PREPARING' }),
    ).toThrow();
  });
});
