import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { SharedWorkoutRoomSubscribeAck } from '@gym-companion/shared';
import { SHARED_WORKOUT_SOCKET_NAMESPACE } from '@gym-companion/shared';
import {
  sharedWorkoutRoomSubscribeBodySchema,
  sharedWorkoutRoomUnsubscribeBodySchema,
} from '@gym-companion/validation';
import type { Namespace, Socket } from 'socket.io';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SharedWorkoutPresenceService } from './shared-workout-presence.service';
import {
  SharedWorkoutRealtimePublisher,
  sharedWorkoutSocketRoomChannel,
  sharedWorkoutUserChannel,
} from './shared-workout-realtime.publisher';

type AuthedSocket = Socket & {
  data: {
    auth?: { userId: string };
  };
};

function resolveSocketCorsOrigin(): string[] | boolean {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw || raw.trim().length === 0) return false;
  const origins = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return origins.length > 0 ? origins : false;
}

@WebSocketGateway({
  namespace: SHARED_WORKOUT_SOCKET_NAMESPACE,
  cors: {
    origin: resolveSocketCorsOrigin(),
    credentials: true,
  },
})
export class SharedWorkoutRealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SharedWorkoutRealtimeGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly presence: SharedWorkoutPresenceService,
    private readonly publisher: SharedWorkoutRealtimePublisher,
  ) {}

  afterInit(server: Namespace): void {
    this.publisher.bindNamespace(server);
    this.logger.log(
      `Namespace ${SHARED_WORKOUT_SOCKET_NAMESPACE} ready (origins=${this.config.corsAllowedOrigins.join(',')})`,
    );
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise.',
        });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token, { secret: this.config.jwtAccessSecret });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true },
      });
      if (
        !user ||
        user.status === 'DISABLED' ||
        user.status === 'DELETION_PENDING'
      ) {
        client.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Session invalide.',
        });
        client.disconnect(true);
        return;
      }

      client.data.auth = { userId: user.id };
      void client.join(sharedWorkoutUserChannel(user.id));
      this.logger.debug(`Socket connected user=${user.id}`);
    } catch {
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Session invalide.',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    const userId = client.data.auth?.userId;
    const left = this.presence.removeSocketEverywhere(client.id);
    for (const item of left) {
      if (!item.becameOffline) continue;
      const channel = sharedWorkoutSocketRoomChannel(item.roomId);
      this.server.to(channel).emit('presence:left', {
        roomId: item.roomId,
        userId: item.userId,
      });
    }
    if (userId) {
      this.logger.debug(`Socket disconnected user=${userId}`);
    }
  }

  @SubscribeMessage('room:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<SharedWorkoutRoomSubscribeAck> {
    const userId = client.data.auth?.userId;
    if (!userId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentification requise.',
      };
    }

    const parsed = sharedWorkoutRoomSubscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Payload subscribe invalide.',
      };
    }

    const { roomId } = parsed.data;
    const allowed = await this.canSubscribe(userId, roomId);
    if (!allowed) {
      return {
        ok: false,
        code: 'ROOM_NOT_ACCESSIBLE',
        message: 'Salle inaccessible.',
      };
    }

    const channel = sharedWorkoutSocketRoomChannel(roomId);
    await client.join(channel);
    const { becameOnline } = this.presence.addSocket(
      roomId,
      userId,
      client.id,
    );

    if (becameOnline) {
      client.to(channel).emit('presence:joined', { roomId, userId });
    }

    const connectedUserIds = this.presence.getConnectedUserIds(roomId);
    client.emit('presence:snapshot', { roomId, connectedUserIds });

    return {
      ok: true,
      roomId,
      presence: { connectedUserIds },
    };
  }

  @SubscribeMessage('room:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): { ok: true } | SharedWorkoutRoomSubscribeAck {
    const userId = client.data.auth?.userId;
    if (!userId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentification requise.',
      };
    }

    const parsed = sharedWorkoutRoomUnsubscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Payload unsubscribe invalide.',
      };
    }

    const { roomId } = parsed.data;
    const channel = sharedWorkoutSocketRoomChannel(roomId);
    void client.leave(channel);
    const { becameOffline } = this.presence.removeSocket(
      roomId,
      userId,
      client.id,
    );
    if (becameOffline) {
      this.server.to(channel).emit('presence:left', { roomId, userId });
    }
    return { ok: true };
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as {
      token?: unknown;
      accessToken?: unknown;
    };
    if (typeof auth?.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }
    if (typeof auth?.accessToken === 'string' && auth.accessToken.length > 0) {
      return auth.accessToken;
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }

  private async canSubscribe(
    userId: string,
    roomId: string,
  ): Promise<boolean> {
    const room = await this.prisma.sharedWorkoutRoom.findFirst({
      where: {
        id: roomId,
        status: { in: ['LOBBY', 'ACTIVE'] },
        members: { some: { userId, leftAt: null } },
      },
      select: { id: true },
    });
    return Boolean(room);
  }
}
