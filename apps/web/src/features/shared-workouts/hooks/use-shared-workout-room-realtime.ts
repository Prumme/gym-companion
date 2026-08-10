import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

import { sharedWorkoutRoomQueryKeys } from '../api/shared-workout-query-keys';
import {
  sharedWorkoutRealtimeClient,
  type SharedWorkoutRealtimeConnectionStatus,
} from '../lib/shared-workout-realtime';

/**
 * Souscrit à la présence Socket.IO d’une room LOBBY/ACTIVE.
 * Les events room:changed invalident TanStack Query (REST authoritative).
 */
export function useSharedWorkoutRoomRealtime(
  roomId: string,
  status: SharedWorkoutRoomStatus | undefined,
) {
  const queryClient = useQueryClient();
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<SharedWorkoutRealtimeConnectionStatus>('disconnected');
  const online =
    typeof navigator === 'undefined' ? true : navigator.onLine;
  const shouldConnect =
    Boolean(roomId) &&
    online &&
    (status === 'LOBBY' || status === 'ACTIVE');

  useEffect(() => {
    if (!shouldConnect) {
      setConnectedUserIds(new Set());
      setConnectionStatus('disconnected');
      return;
    }

    sharedWorkoutRealtimeClient.setHandlers({
      onStatus: setConnectionStatus,
      onSnapshot: (event) => {
        if (event.roomId !== roomId) return;
        setConnectedUserIds(new Set(event.connectedUserIds));
      },
      onJoined: (event) => {
        if (event.roomId !== roomId) return;
        setConnectedUserIds((prev) => {
          const next = new Set(prev);
          next.add(event.userId);
          return next;
        });
      },
      onLeft: (event) => {
        if (event.roomId !== roomId) return;
        setConnectedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(event.userId);
          return next;
        });
      },
      onRoomChanged: (event) => {
        if (event.roomId !== roomId) return;
        void queryClient.invalidateQueries({
          queryKey: sharedWorkoutRoomQueryKeys.detail(roomId),
        });
        void queryClient.invalidateQueries({
          queryKey: sharedWorkoutRoomQueryKeys.lists(),
        });
        if (
          event.reason === 'COMPLETED' ||
          event.reason === 'CANCELLED'
        ) {
          sharedWorkoutRealtimeClient.unsubscribe(roomId);
          setConnectedUserIds(new Set());
          setConnectionStatus('disconnected');
        }
      },
    });

    void sharedWorkoutRealtimeClient.subscribe(roomId).catch(() => {
      setConnectionStatus('error');
    });

    return () => {
      sharedWorkoutRealtimeClient.unsubscribe(roomId);
      sharedWorkoutRealtimeClient.disconnect();
      sharedWorkoutRealtimeClient.setHandlers({});
    };
  }, [roomId, shouldConnect, queryClient]);

  return {
    connectedUserIds,
    connectionStatus,
    realtimeAvailable: shouldConnect && connectionStatus === 'connected',
  };
}
