import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ApiCursorListResponse,
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomListItem,
} from '@gym-companion/shared';
import {
  buildSharedWorkoutRoomCursorFilter,
  buildSharedWorkoutRoomLifecycleFingerprint,
  canRenameSharedWorkoutRoom,
  createSharedWorkoutRoomBodySchema,
  decodeSharedWorkoutRoomCursor,
  encodeSharedWorkoutRoomCursor,
  resolveSharedWorkoutRoomLifecycleTransition,
  resolveSharedWorkoutRoomName,
  sharedWorkoutRoomLifecycleCommandBodySchema,
  sharedWorkoutRoomListQuerySchema,
  updateSharedWorkoutRoomBodySchema,
  type SharedWorkoutRoomLifecycleAction,
  type SharedWorkoutRoomStatusValue,
} from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toSharedWorkoutRoomDetail,
  toSharedWorkoutRoomListItem,
} from './shared-workouts.mapper';

const roomInclude = {
  members: {
    include: {
      user: {
        select: {
          profile: { select: { displayName: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class SharedWorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(
    userId: string,
    body: unknown,
  ): Promise<SharedWorkoutRoomDetail> {
    const parsed = createSharedWorkoutRoomBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données de création invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const name = resolveSharedWorkoutRoomName(parsed.data.name);

    const room = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sharedWorkoutRoom.create({
        data: {
          ownerUserId: userId,
          name,
          status: 'LOBBY',
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
        include: roomInclude,
      });
      return created;
    });

    return toSharedWorkoutRoomDetail(room, userId);
  }

  async listRooms(
    userId: string,
    query: Record<string, string | undefined>,
  ): Promise<ApiCursorListResponse<SharedWorkoutRoomListItem>> {
    const parsed = sharedWorkoutRoomListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Paramètres de liste invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    let cursorFilter: ReturnType<typeof buildSharedWorkoutRoomCursorFilter> | undefined;
    if (parsed.data.cursor) {
      try {
        cursorFilter = buildSharedWorkoutRoomCursorFilter(
          decodeSharedWorkoutRoomCursor(parsed.data.cursor),
        );
      } catch {
        throw new BadRequestException({
          code: 'SHARED_WORKOUT_ROOM_INVALID_CURSOR',
          message: 'Curseur de pagination invalide.',
        });
      }
    }

    const limit = parsed.data.limit;
    const rows = await this.prisma.sharedWorkoutRoom.findMany({
      where: {
        AND: [
          {
            members: {
              some: { userId },
            },
          },
          parsed.data.status ? { status: parsed.data.status } : {},
          cursorFilter ?? {},
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: roomInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeSharedWorkoutRoomCursor({
            version: 1,
            updatedAt: last.updatedAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      data: page.map(toSharedWorkoutRoomListItem),
      pagination: { nextCursor, hasMore },
    };
  }

  async getRoom(
    userId: string,
    roomId: string,
  ): Promise<SharedWorkoutRoomDetail> {
    const room = await this.findMemberRoomOrThrow(userId, roomId);
    return toSharedWorkoutRoomDetail(room, userId);
  }

  async updateRoom(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<SharedWorkoutRoomDetail> {
    const parsed = updateSharedWorkoutRoomBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données de mise à jour invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const room = await this.findMemberRoomOrThrow(userId, roomId);
    this.assertOwner(room.ownerUserId, userId);

    if (!canRenameSharedWorkoutRoom(room.status as SharedWorkoutRoomStatusValue)) {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS',
        message: 'Impossible de renommer une salle terminée ou annulée.',
      });
    }

    const updated = await this.prisma.sharedWorkoutRoom.update({
      where: { id: roomId },
      data: { name: parsed.data.name.trim() },
      include: roomInclude,
    });

    return toSharedWorkoutRoomDetail(updated, userId);
  }

  async startRoom(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<SharedWorkoutRoomDetail> {
    return this.transitionLifecycle(userId, roomId, 'START', body);
  }

  async completeRoom(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<SharedWorkoutRoomDetail> {
    return this.transitionLifecycle(userId, roomId, 'COMPLETE', body);
  }

  async cancelRoom(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<SharedWorkoutRoomDetail> {
    return this.transitionLifecycle(userId, roomId, 'CANCEL', body);
  }

  private async transitionLifecycle(
    userId: string,
    roomId: string,
    action: SharedWorkoutRoomLifecycleAction,
    body: unknown,
  ): Promise<SharedWorkoutRoomDetail> {
    const parsed = sharedWorkoutRoomLifecycleCommandBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Commande lifecycle invalide.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const fingerprint = buildSharedWorkoutRoomLifecycleFingerprint({
      action,
      roomId,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const room = await tx.sharedWorkoutRoom.findFirst({
          where: {
            id: roomId,
            members: { some: { userId } },
          },
          include: roomInclude,
        });
        if (!room) {
          throw new NotFoundException({
            code: 'SHARED_WORKOUT_ROOM_NOT_FOUND',
            message: 'Salle introuvable.',
          });
        }
        if (room.ownerUserId !== userId) {
          throw new ForbiddenException({
            code: 'SHARED_WORKOUT_ROOM_NOT_OWNER',
            message: 'Seul le propriétaire peut modifier le cycle de vie.',
          });
        }

        const existing = await tx.sharedWorkoutRoomLifecycleCommand.findUnique({
          where: {
            ownerUserId_clientCommandId: {
              ownerUserId: userId,
              clientCommandId: parsed.data.clientCommandId,
            },
          },
        });

        if (existing) {
          if (
            existing.roomId !== roomId ||
            existing.action !== action ||
            existing.payloadFingerprint !== fingerprint
          ) {
            throw new ConflictException({
              code: 'SHARED_WORKOUT_ROOM_COMMAND_CONFLICT',
              message: 'Commande déjà utilisée avec une opération différente.',
            });
          }
          const replay = await tx.sharedWorkoutRoom.findUniqueOrThrow({
            where: { id: roomId },
            include: roomInclude,
          });
          return replay;
        }

        const transition = resolveSharedWorkoutRoomLifecycleTransition(
          room.status as SharedWorkoutRoomStatusValue,
          action,
        );

        if (!transition.ok) {
          throw new BadRequestException({
            code: transition.code,
            message: 'Transition de statut non autorisée.',
          });
        }

        if (transition.kind === 'apply') {
          const now = new Date();
          const updated = await tx.sharedWorkoutRoom.updateMany({
            where: {
              id: roomId,
              status: room.status,
            },
            data: {
              status: transition.nextStatus,
              ...(transition.setStartedAt ? { startedAt: now } : {}),
              ...(transition.setCompletedAt ? { completedAt: now } : {}),
              ...(transition.setCancelledAt ? { cancelledAt: now } : {}),
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException({
              code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS',
              message: 'La salle a changé d’état. Réessaie.',
            });
          }
        }

        await tx.sharedWorkoutRoomLifecycleCommand.create({
          data: {
            ownerUserId: userId,
            roomId,
            clientCommandId: parsed.data.clientCommandId,
            action,
            payloadFingerprint: fingerprint,
          },
        });

        return tx.sharedWorkoutRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: roomInclude,
        });
      });

      return toSharedWorkoutRoomDetail(result, userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SHARED_WORKOUT_ROOM_COMMAND_CONFLICT',
          message: 'Commande déjà en cours de traitement.',
        });
      }
      throw error;
    }
  }

  private async findMemberRoomOrThrow(userId: string, roomId: string) {
    const room = await this.prisma.sharedWorkoutRoom.findFirst({
      where: {
        id: roomId,
        members: { some: { userId } },
      },
      include: roomInclude,
    });
    if (!room) {
      throw new NotFoundException({
        code: 'SHARED_WORKOUT_ROOM_NOT_FOUND',
        message: 'Salle introuvable.',
      });
    }
    return room;
  }

  private assertOwner(ownerUserId: string, userId: string): void {
    if (ownerUserId !== userId) {
      throw new ForbiddenException({
        code: 'SHARED_WORKOUT_ROOM_NOT_OWNER',
        message: 'Seul le propriétaire peut effectuer cette action.',
      });
    }
  }
}
