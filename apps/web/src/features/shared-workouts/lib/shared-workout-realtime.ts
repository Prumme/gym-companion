import {
  SHARED_WORKOUT_SOCKET_NAMESPACE,
  type SharedWorkoutPresenceJoinedEvent,
  type SharedWorkoutPresenceLeftEvent,
  type SharedWorkoutPresenceSnapshotEvent,
  type SharedWorkoutRoomChangedEvent,
  type SharedWorkoutRoomSubscribeAck,
} from '@gym-companion/shared';
import { io, type Socket } from 'socket.io-client';

import { getAccessToken, getApiBaseUrl } from '@/lib/api/client';

export type SharedWorkoutRealtimeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

type PresenceHandlers = {
  onSnapshot?: (event: SharedWorkoutPresenceSnapshotEvent) => void;
  onJoined?: (event: SharedWorkoutPresenceJoinedEvent) => void;
  onLeft?: (event: SharedWorkoutPresenceLeftEvent) => void;
  onRoomChanged?: (event: SharedWorkoutRoomChangedEvent) => void;
  onStatus?: (status: SharedWorkoutRealtimeConnectionStatus) => void;
};

/**
 * Abstraction Socket.IO Shared 5.3.
 * Auth : access token mémoire (pas de refresh token).
 * Après refresh REST, reconnectWithFreshToken().
 */
class SharedWorkoutRealtimeClient {
  private socket: Socket | null = null;
  private subscribedRoomId: string | null = null;
  private handlers: PresenceHandlers = {};

  setHandlers(handlers: PresenceHandlers) {
    this.handlers = handlers;
  }

  getConnectionStatus(): SharedWorkoutRealtimeConnectionStatus {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }

  connect(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.handlers.onStatus?.('disconnected');
      return;
    }
    const token = getAccessToken();
    if (!token) {
      this.handlers.onStatus?.('error');
      return;
    }
    if (this.socket?.connected) return;

    this.handlers.onStatus?.('connecting');
    if (!this.socket) {
      this.socket = io(`${getApiBaseUrl()}${SHARED_WORKOUT_SOCKET_NAMESPACE}`, {
        autoConnect: false,
        withCredentials: true,
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      this.bindSocketEvents(this.socket);
    } else {
      this.socket.auth = { token };
    }
    this.socket.connect();
  }

  disconnect(): void {
    this.subscribedRoomId = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.handlers.onStatus?.('disconnected');
  }

  /** Après refresh access token — reconnecte et resouscrit si besoin. */
  reconnectWithFreshToken(): void {
    const roomId = this.subscribedRoomId;
    this.disconnect();
    this.connect();
    if (roomId) {
      void this.subscribe(roomId);
    }
  }

  async subscribe(roomId: string): Promise<SharedWorkoutRoomSubscribeAck> {
    this.connect();
    const socket = this.socket;
    if (!socket) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Socket indisponible.',
      };
    }

    await this.waitUntilConnected(socket);
    this.subscribedRoomId = roomId;

    return new Promise((resolve) => {
      socket.emit(
        'room:subscribe',
        { roomId },
        (ack: SharedWorkoutRoomSubscribeAck) => {
          if (ack?.ok) {
            this.handlers.onSnapshot?.({
              roomId: ack.roomId,
              connectedUserIds: ack.presence.connectedUserIds,
            });
          }
          resolve(ack);
        },
      );
    });
  }

  unsubscribe(roomId: string): void {
    if (!this.socket?.connected) {
      this.subscribedRoomId = null;
      return;
    }
    this.socket.emit('room:unsubscribe', { roomId });
    if (this.subscribedRoomId === roomId) {
      this.subscribedRoomId = null;
    }
  }

  private bindSocketEvents(socket: Socket) {
    socket.on('connect', () => {
      this.handlers.onStatus?.('connected');
      const roomId = this.subscribedRoomId;
      if (roomId) {
        void this.subscribe(roomId);
      }
    });
    socket.on('disconnect', () => {
      this.handlers.onStatus?.('disconnected');
    });
    socket.on('connect_error', () => {
      this.handlers.onStatus?.('error');
    });
    socket.on('presence:snapshot', (event: SharedWorkoutPresenceSnapshotEvent) => {
      this.handlers.onSnapshot?.(event);
    });
    socket.on('presence:joined', (event: SharedWorkoutPresenceJoinedEvent) => {
      this.handlers.onJoined?.(event);
    });
    socket.on('presence:left', (event: SharedWorkoutPresenceLeftEvent) => {
      this.handlers.onLeft?.(event);
    });
    socket.on('room:changed', (event: SharedWorkoutRoomChangedEvent) => {
      this.handlers.onRoomChanged?.(event);
    });
  }

  private waitUntilConnected(socket: Socket): Promise<void> {
    if (socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Connexion temps réel impossible.'));
      };
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };
      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
    });
  }
}

export const sharedWorkoutRealtimeClient = new SharedWorkoutRealtimeClient();
