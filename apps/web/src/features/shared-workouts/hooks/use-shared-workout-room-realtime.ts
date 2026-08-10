import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

import { sharedWorkoutRoomQueryKeys } from '../api/shared-workout-query-keys';
import {
  sharedWorkoutRealtimeClient,
  type SharedWorkoutRealtimeConnectionStatus,
} from '../lib/shared-workout-realtime';

/**
 * Souscrit à la présence Socket.IO d’une room LOBBY/ACTIVE.
 * Les events room:changed invalident TanStack Query (REST authoritative).
 * MEMBER_WORKOUT_PROGRESS_CHANGED est coalescé (~200 ms).
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
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    function invalidateRoom() {
      void queryClient.invalidateQueries({
        queryKey: sharedWorkoutRoomQueryKeys.detail(roomId),
      });
      void queryClient.invalidateQueries({
        queryKey: sharedWorkoutRoomQueryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: sharedWorkoutRoomQueryKeys.myWorkoutSession(roomId),
      });
    }

    function invalidateProgressCoalesced() {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
      progressTimer.current = setTimeout(() => {
        progressTimer.current = null;
        invalidateRoom();
      }, 200);
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
        if (event.reason === 'MEMBER_WORKOUT_PROGRESS_CHANGED') {
          invalidateProgressCoalesced();
        } else {
          invalidateRoom();
        }
        if (event.reason === 'COMPLETED' || event.reason === 'CANCELLED') {
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
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
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
