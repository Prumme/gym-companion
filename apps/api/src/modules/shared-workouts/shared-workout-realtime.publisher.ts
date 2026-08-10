import { Injectable, Logger } from '@nestjs/common';
import type { SharedWorkoutRoomChangeReason } from '@gym-companion/shared';
import type { Namespace, Server } from 'socket.io';

import { SharedWorkoutPresenceService } from './shared-workout-presence.service';

export function sharedWorkoutSocketRoomChannel(roomId: string): string {
  return `shared-workout-room:${roomId}`;
}

export function sharedWorkoutUserChannel(userId: string): string {
  return `user:${userId}`;
}

/**
 * Diffuse des signaux après commit REST.
 * Ne contient aucune logique métier / Prisma.
 */
@Injectable()
export class SharedWorkoutRealtimePublisher {
  private readonly logger = new Logger(SharedWorkoutRealtimePublisher.name);
  private nsp: Namespace | Server | null = null;

  constructor(private readonly presence: SharedWorkoutPresenceService) {}

  bindNamespace(nsp: Namespace | Server): void {
    this.nsp = nsp;
  }

  emitRoomChanged(
    roomId: string,
    reason: SharedWorkoutRoomChangeReason,
  ): void {
    if (!this.nsp) {
      this.logger.debug(`Skip room:changed (${reason}) — namespace unbound`);
      return;
    }
    const channel = sharedWorkoutSocketRoomChannel(roomId);
    this.nsp.to(channel).emit('room:changed', { roomId, reason });

    if (reason === 'COMPLETED' || reason === 'CANCELLED') {
      this.closeRoomPresence(roomId);
    }
  }

  /**
   * Après leave REST : retire les sockets du channel + présence.
   */
  evictUserFromRoom(roomId: string, userId: string): void {
    if (!this.nsp) return;
    const { wasOnline, socketIds } = this.presence.removeUser(roomId, userId);
    const channel = sharedWorkoutSocketRoomChannel(roomId);

    for (const socketId of socketIds) {
      const socket = this.findSocket(socketId);
      if (socket) {
        void socket.leave(channel);
      }
    }

    if (wasOnline) {
      this.nsp.to(channel).emit('presence:left', { roomId, userId });
    }
  }

  private closeRoomPresence(roomId: string): void {
    if (!this.nsp) return;
    const channel = sharedWorkoutSocketRoomChannel(roomId);
    const socketIds = this.presence.clearRoom(roomId);
    for (const socketId of socketIds) {
      const socket = this.findSocket(socketId);
      if (socket) {
        void socket.leave(channel);
      }
    }
  }

  private findSocket(socketId: string) {
    if (!this.nsp) return undefined;
    // Namespace.sockets is a Map in Socket.IO v4+
    const sockets = this.nsp.sockets as Map<string, { leave: (r: string) => void }>;
    return sockets.get(socketId);
  }
}
