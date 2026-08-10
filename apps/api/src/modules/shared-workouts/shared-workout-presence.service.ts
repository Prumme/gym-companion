import { Injectable } from '@nestjs/common';

/**
 * Présence Socket.IO éphémère (Shared 5.3).
 * Aucune persistence PostgreSQL.
 * Structure : roomId → userId → Set<socketId>
 */
@Injectable()
export class SharedWorkoutPresenceService {
  private readonly rooms = new Map<string, Map<string, Set<string>>>();
  /** socketId → set of roomIds (cleanup disconnect). */
  private readonly socketRooms = new Map<string, Set<string>>();

  addSocket(roomId: string, userId: string, socketId: string): {
    becameOnline: boolean;
  } {
    let users = this.rooms.get(roomId);
    if (!users) {
      users = new Map();
      this.rooms.set(roomId, users);
    }
    let sockets = users.get(userId);
    const becameOnline = !sockets || sockets.size === 0;
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }
    sockets.add(socketId);

    let rooms = this.socketRooms.get(socketId);
    if (!rooms) {
      rooms = new Set();
      this.socketRooms.set(socketId, rooms);
    }
    rooms.add(roomId);

    return { becameOnline };
  }

  removeSocket(roomId: string, userId: string, socketId: string): {
    becameOffline: boolean;
  } {
    const users = this.rooms.get(roomId);
    if (!users) return { becameOffline: false };
    const sockets = users.get(userId);
    if (!sockets) return { becameOffline: false };
    sockets.delete(socketId);
    const becameOffline = sockets.size === 0;
    if (becameOffline) {
      users.delete(userId);
    }
    if (users.size === 0) {
      this.rooms.delete(roomId);
    }

    const rooms = this.socketRooms.get(socketId);
    rooms?.delete(roomId);
    if (rooms && rooms.size === 0) {
      this.socketRooms.delete(socketId);
    }

    return { becameOffline };
  }

  /** Retire un socket de toutes les rooms (disconnect). */
  removeSocketEverywhere(socketId: string): Array<{
    roomId: string;
    userId: string;
    becameOffline: boolean;
  }> {
    const rooms = this.socketRooms.get(socketId);
    if (!rooms) return [];
    const results: Array<{
      roomId: string;
      userId: string;
      becameOffline: boolean;
    }> = [];

    for (const roomId of [...rooms]) {
      const users = this.rooms.get(roomId);
      if (!users) continue;
      for (const [userId, sockets] of users) {
        if (!sockets.has(socketId)) continue;
        const { becameOffline } = this.removeSocket(roomId, userId, socketId);
        results.push({ roomId, userId, becameOffline });
        break;
      }
    }

    this.socketRooms.delete(socketId);
    return results;
  }

  /** Tous les socketIds d’un user dans une room. */
  getSocketIds(roomId: string, userId: string): string[] {
    const sockets = this.rooms.get(roomId)?.get(userId);
    return sockets ? [...sockets] : [];
  }

  getConnectedUserIds(roomId: string): string[] {
    const users = this.rooms.get(roomId);
    if (!users) return [];
    return [...users.keys()];
  }

  /** Retire toute présence d’un user dans une room (leave REST). */
  removeUser(roomId: string, userId: string): {
    wasOnline: boolean;
    socketIds: string[];
  } {
    const socketIds = this.getSocketIds(roomId, userId);
    const wasOnline = socketIds.length > 0;
    for (const socketId of socketIds) {
      this.removeSocket(roomId, userId, socketId);
    }
    return { wasOnline, socketIds };
  }

  clearRoom(roomId: string): string[] {
    const users = this.rooms.get(roomId);
    if (!users) return [];
    const socketIds: string[] = [];
    for (const [userId, sockets] of users) {
      for (const socketId of sockets) {
        socketIds.push(socketId);
        const rooms = this.socketRooms.get(socketId);
        rooms?.delete(roomId);
        if (rooms && rooms.size === 0) {
          this.socketRooms.delete(socketId);
        }
      }
      void userId;
    }
    this.rooms.delete(roomId);
    return socketIds;
  }
}
