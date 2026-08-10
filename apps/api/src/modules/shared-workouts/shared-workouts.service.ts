import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ApiCursorListResponse,
  MySharedWorkoutSessionDto,
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomInvitationDto,
  SharedWorkoutRoomListItem,
  WorkoutSessionDetail,
  WorkoutStatus,
} from '@gym-companion/shared';
import {
  attachMySharedWorkoutSessionBodySchema,
  buildSharedWorkoutRoomCursorFilter,
  buildSharedWorkoutRoomInvitationCursorFilter,
  buildSharedWorkoutRoomLifecycleFingerprint,
  canAcceptSharedWorkoutRoomInvitation,
  canInviteToSharedWorkoutRoom,
  canLeaveSharedWorkoutRoom,
  canRenameSharedWorkoutRoom,
  createMySharedWorkoutSessionBodySchema,
  createSharedWorkoutRoomBodySchema,
  createSharedWorkoutRoomInvitationBodySchema,
  decodeSharedWorkoutRoomCursor,
  decodeSharedWorkoutRoomInvitationCursor,
  encodeSharedWorkoutRoomCursor,
  encodeSharedWorkoutRoomInvitationCursor,
  resolveSharedWorkoutRoomLifecycleTransition,
  resolveSharedWorkoutRoomName,
  sharedWorkoutRoomInvitationListQuerySchema,
  sharedWorkoutRoomLifecycleCommandBodySchema,
  sharedWorkoutRoomListQuerySchema,
  updateSharedWorkoutRoomBodySchema,
  utcDateToLocalDateString,
  type SharedWorkoutRoomLifecycleAction,
  type SharedWorkoutRoomStatusValue,
} from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';
import { WorkoutsService } from '../workouts/workouts.service';
import {
  toWorkoutSessionDetail,
  type WorkoutSessionSnapshotRow,
} from '../workouts/workouts.mapper';
import { toSharedWorkoutRoomInvitationDto } from './shared-workout-invitations.mapper';
import { SharedWorkoutRealtimePublisher } from './shared-workout-realtime.publisher';
import {
  toSharedWorkoutRoomDetail,
  toSharedWorkoutRoomListItem,
} from './shared-workouts.mapper';

const activeMemberSome = (userId: string) => ({
  members: { some: { userId, leftAt: null } },
});

const roomInclude = {
  members: {
    where: { leftAt: null },
    include: {
      user: {
        select: {
          profile: { select: { displayName: true } },
        },
      },
      memberSession: {
        include: {
          workoutSession: {
            select: {
              id: true,
              name: true,
              status: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      },
    },
  },
} as const;

const invitationInclude = {
  room: { select: { id: true, name: true, status: true } },
  invitedBy: {
    select: { profile: { select: { displayName: true } } },
  },
  invitee: {
    select: { profile: { select: { displayName: true } } },
  },
} as const;

@Injectable()
export class SharedWorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: SharedWorkoutRealtimePublisher,
    @Inject(forwardRef(() => WorkoutsService))
    private readonly workoutsService: WorkoutsService,
  ) {}

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
      return tx.sharedWorkoutRoom.create({
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
          activeMemberSome(userId),
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
    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    return toSharedWorkoutRoomDetail(room, userId);
  }

  /**
   * Shared 5.4 — état attach/create pour le current user.
   */
  async getMyWorkoutSession(
    userId: string,
    roomId: string,
  ): Promise<MySharedWorkoutSessionDto> {
    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ForbiddenException({
        code: 'SHARED_WORKOUT_ROOM_MEMBER_NOT_ACTIVE',
        message: 'Tu n’es pas membre actif de cette salle.',
      });
    }

    const linked = member.memberSession?.workoutSession ?? null;
    if (linked) {
      return {
        linked: true,
        workoutSession: {
          id: linked.id,
          status: linked.status as WorkoutStatus,
          workoutName: linked.name,
          startedAt: linked.startedAt.toISOString(),
        },
        activeWorkoutElsewhere: null,
      };
    }

    const active = await this.prisma.workoutSession.findFirst({
      where: {
        ownerUserId: userId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        sharedRoomMemberSession: { select: { id: true } },
      },
    });

    if (!active) {
      return {
        linked: false,
        workoutSession: null,
        activeWorkoutElsewhere: null,
      };
    }

    return {
      linked: false,
      workoutSession: null,
      activeWorkoutElsewhere: {
        id: active.id,
        status: active.status as 'ACTIVE' | 'PAUSED',
        workoutName: active.name,
        linkedToOtherRoom: active.sharedRoomMemberSession != null,
      },
    };
  }

  /**
   * Shared 5.4 — rattache une séance ACTIVE/PAUSED existante.
   */
  async attachMyWorkoutSession(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<MySharedWorkoutSessionDto> {
    const parsed = attachMySharedWorkoutSessionBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données de rattachement invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    if (room.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_NOT_ACTIVE',
        message:
          'Les séances individuelles ne peuvent être rattachées que lorsque la salle est active.',
      });
    }

    const member = await this.prisma.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      include: {
        memberSession: {
          include: {
            workoutSession: {
              select: {
                id: true,
                name: true,
                status: true,
                startedAt: true,
              },
            },
          },
        },
      },
    });
    if (!member) {
      throw new ForbiddenException({
        code: 'SHARED_WORKOUT_ROOM_MEMBER_NOT_ACTIVE',
        message: 'Tu n’es pas membre actif de cette salle.',
      });
    }

    const targetSessionId = parsed.data.workoutSessionId;

    // Idempotence : déjà lié à la même séance.
    if (member.memberSession) {
      if (member.memberSession.workoutSessionId === targetSessionId) {
        const ws = member.memberSession.workoutSession;
        return {
          linked: true,
          workoutSession: {
            id: ws.id,
            status: ws.status as WorkoutStatus,
            workoutName: ws.name,
            startedAt: ws.startedAt.toISOString(),
          },
          activeWorkoutElsewhere: null,
        };
      }
      throw new ConflictException({
        code: 'SHARED_WORKOUT_MEMBER_SESSION_ALREADY_EXISTS',
        message: 'Une séance est déjà rattachée à cette salle pour toi.',
      });
    }

    // Ownership neutre : séance absente ou étrangère → 404.
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: targetSessionId, ownerUserId: userId },
      select: {
        id: true,
        name: true,
        status: true,
        startedAt: true,
        sharedRoomMemberSession: { select: { id: true, roomMemberId: true } },
      },
    });
    if (!session) {
      throw new NotFoundException({
        code: 'WORKOUT_NOT_FOUND',
        message: 'Séance introuvable.',
      });
    }

    if (session.status !== 'ACTIVE' && session.status !== 'PAUSED') {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_SESSION_NOT_ATTACHABLE',
        message:
          'Seules les séances en cours ou en pause peuvent être rattachées.',
      });
    }

    if (session.sharedRoomMemberSession) {
      throw new ConflictException({
        code: 'SHARED_WORKOUT_SESSION_ALREADY_LINKED',
        message: 'Cette séance est déjà rattachée à une salle.',
      });
    }

    try {
      await this.prisma.sharedWorkoutRoomMemberSession.create({
        data: {
          roomMemberId: member.id,
          workoutSessionId: session.id,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        // Course : recharger l’état déterministe.
        return this.getMyWorkoutSession(userId, roomId);
      }
      throw error;
    }

    this.realtime.emitRoomChanged(roomId, 'MEMBER_WORKOUT_CHANGED');
    return this.getMyWorkoutSession(userId, roomId);
  }

  /**
   * Shared 5.4 — crée une WorkoutSession + association (atomique).
   */
  async createMyWorkoutSession(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<{
    mySession: MySharedWorkoutSessionDto;
    workoutSession: WorkoutSessionDetail;
  }> {
    const parsed = createMySharedWorkoutSessionBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données de création invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    if (room.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_NOT_ACTIVE',
        message:
          'Les séances individuelles ne peuvent être démarrées que lorsque la salle est active.',
      });
    }

    const member = await this.prisma.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      include: { memberSession: true },
    });
    if (!member) {
      throw new ForbiddenException({
        code: 'SHARED_WORKOUT_ROOM_MEMBER_NOT_ACTIVE',
        message: 'Tu n’es pas membre actif de cette salle.',
      });
    }

    if (member.memberSession) {
      throw new ConflictException({
        code: 'SHARED_WORKOUT_MEMBER_SESSION_ALREADY_EXISTS',
        message: 'Une séance est déjà rattachée à cette salle pour toi.',
      });
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const timezone =
      parsed.data.timezone?.trim() || profile?.timezone || 'Europe/Paris';
    const localDate =
      parsed.data.localDate ?? utcDateToLocalDateString(new Date());

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const session = await this.workoutsService.createFromTemplateInTransaction(
          tx,
          userId,
          {
            sourceWorkoutTemplateId: parsed.data.workoutTemplateId,
            localDate,
            timezone,
          },
        );

        await tx.sharedWorkoutRoomMemberSession.create({
          data: {
            roomMemberId: member.id,
            workoutSessionId: session.id,
          },
        });

        return session;
      });

      this.realtime.emitRoomChanged(roomId, 'MEMBER_WORKOUT_CHANGED');

      const workoutSession = toWorkoutSessionDetail(
        created as WorkoutSessionSnapshotRow,
      );
      const mySession = await this.getMyWorkoutSession(userId, roomId);
      return { mySession, workoutSession };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        // Conflit unicité séance active ou association — état cohérent via GET.
        const mySession = await this.getMyWorkoutSession(userId, roomId);
        if (mySession.linked && mySession.workoutSession) {
          const detail = await this.workoutsService.getById(
            userId,
            mySession.workoutSession.id,
          );
          return { mySession, workoutSession: detail };
        }
        throw new ConflictException({
          code: 'WORKOUT_ACTIVE_ALREADY_EXISTS',
          message: 'Une séance est déjà en cours.',
        });
      }
      throw error;
    }
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

    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
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

    this.realtime.emitRoomChanged(roomId, 'RENAMED');
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

  async inviteMember(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<SharedWorkoutRoomInvitationDto> {
    const parsed = createSharedWorkoutRoomInvitationBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données d’invitation invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    this.assertOwner(room.ownerUserId, userId);

    if (!canInviteToSharedWorkoutRoom(room.status as SharedWorkoutRoomStatusValue)) {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_INVITATION_CANNOT_CREATE',
        message: 'Impossible d’inviter dans une salle terminée ou annulée.',
      });
    }

    const invitee = await this.prisma.user.findUnique({
      where: { email: parsed.data.inviteeEmail },
      select: { id: true, status: true },
    });

    // Anti-énumération : même code pour inexistant / inactif.
    if (!invitee || invitee.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_INVITATION_CANNOT_CREATE',
        message: 'Impossible d’envoyer cette invitation.',
      });
    }

    if (invitee.id === userId) {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_INVITATION_CANNOT_CREATE',
        message: 'Tu ne peux pas t’inviter toi-même.',
      });
    }

    const activeMembership = await this.prisma.sharedWorkoutRoomMember.findFirst(
      {
        where: {
          roomId,
          userId: invitee.id,
          leftAt: null,
        },
      },
    );
    if (activeMembership) {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_ALREADY_MEMBER',
        message: 'Cet utilisateur est déjà membre de la salle.',
      });
    }

    try {
      const invitation = await this.prisma.sharedWorkoutRoomInvitation.create({
        data: {
          roomId,
          invitedByUserId: userId,
          inviteeUserId: invitee.id,
          status: 'PENDING',
        },
        include: invitationInclude,
      });
      return toSharedWorkoutRoomInvitationDto(invitation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SHARED_WORKOUT_INVITATION_ALREADY_PENDING',
          message: 'Une invitation est déjà en attente pour cet utilisateur.',
        });
      }
      throw error;
    }
  }

  async listRoomInvitations(
    userId: string,
    roomId: string,
    query: Record<string, string | undefined>,
  ): Promise<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>> {
    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    this.assertOwner(room.ownerUserId, userId);
    return this.listInvitations({ roomId }, query);
  }

  async listReceivedInvitations(
    userId: string,
    query: Record<string, string | undefined>,
  ): Promise<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>> {
    return this.listInvitations({ inviteeUserId: userId }, query);
  }

  async acceptInvitation(
    userId: string,
    invitationId: string,
  ): Promise<SharedWorkoutRoomInvitationDto> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.sharedWorkoutRoomInvitation.findFirst({
          where: { id: invitationId, inviteeUserId: userId },
          include: invitationInclude,
        });
        if (!invitation) {
          throw new NotFoundException({
            code: 'SHARED_WORKOUT_INVITATION_NOT_FOUND',
            message: 'Invitation introuvable.',
          });
        }

        if (invitation.status === 'ACCEPTED') {
          return { invitation, membershipApplied: false as const };
        }
        if (invitation.status !== 'PENDING') {
          throw new ConflictException({
            code: 'SHARED_WORKOUT_INVITATION_INVALID_STATUS',
            message: 'Cette invitation ne peut plus être acceptée.',
          });
        }

        const room = await tx.sharedWorkoutRoom.findUniqueOrThrow({
          where: { id: invitation.roomId },
          select: { status: true },
        });

        if (
          !canAcceptSharedWorkoutRoomInvitation(
            room.status as SharedWorkoutRoomStatusValue,
          )
        ) {
          throw new BadRequestException({
            code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS',
            message: 'La salle n’accepte plus de nouveaux membres.',
          });
        }

        const now = new Date();
        const claimed = await tx.sharedWorkoutRoomInvitation.updateMany({
          where: { id: invitationId, status: 'PENDING', inviteeUserId: userId },
          data: { status: 'ACCEPTED', respondedAt: now },
        });
        if (claimed.count !== 1) {
          throw new ConflictException({
            code: 'SHARED_WORKOUT_INVITATION_INVALID_STATUS',
            message: 'Cette invitation a déjà été traitée.',
          });
        }

        const existingMember = await tx.sharedWorkoutRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId: invitation.roomId,
              userId,
            },
          },
        });

        if (existingMember) {
          if (existingMember.leftAt != null) {
            await tx.sharedWorkoutRoomMember.update({
              where: { id: existingMember.id },
              data: { role: 'MEMBER', leftAt: null },
            });
          }
        } else {
          await tx.sharedWorkoutRoomMember.create({
            data: {
              roomId: invitation.roomId,
              userId,
              role: 'MEMBER',
            },
          });
        }

        const refreshed = await tx.sharedWorkoutRoomInvitation.findUniqueOrThrow(
          {
            where: { id: invitationId },
            include: invitationInclude,
          },
        );
        return { invitation: refreshed, membershipApplied: true as const };
      });

      if (result.membershipApplied) {
        this.realtime.emitRoomChanged(
          result.invitation.roomId,
          'MEMBER_JOINED',
        );
      }
      return toSharedWorkoutRoomInvitationDto(result.invitation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SHARED_WORKOUT_ROOM_ALREADY_MEMBER',
          message: 'Membership concurrent détecté.',
        });
      }
      throw error;
    }
  }

  async declineInvitation(
    userId: string,
    invitationId: string,
  ): Promise<SharedWorkoutRoomInvitationDto> {
    const invitation = await this.prisma.sharedWorkoutRoomInvitation.findFirst({
      where: { id: invitationId, inviteeUserId: userId },
      include: invitationInclude,
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'SHARED_WORKOUT_INVITATION_NOT_FOUND',
        message: 'Invitation introuvable.',
      });
    }

    if (invitation.status === 'DECLINED') {
      return toSharedWorkoutRoomInvitationDto(invitation);
    }
    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        code: 'SHARED_WORKOUT_INVITATION_INVALID_STATUS',
        message: 'Cette invitation ne peut plus être refusée.',
      });
    }

    const now = new Date();
    const updated = await this.prisma.sharedWorkoutRoomInvitation.updateMany({
      where: { id: invitationId, status: 'PENDING', inviteeUserId: userId },
      data: { status: 'DECLINED', respondedAt: now },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'SHARED_WORKOUT_INVITATION_INVALID_STATUS',
        message: 'Cette invitation a déjà été traitée.',
      });
    }

    const refreshed = await this.prisma.sharedWorkoutRoomInvitation.findUniqueOrThrow(
      {
        where: { id: invitationId },
        include: invitationInclude,
      },
    );
    return toSharedWorkoutRoomInvitationDto(refreshed);
  }

  async cancelInvitation(
    userId: string,
    roomId: string,
    invitationId: string,
  ): Promise<SharedWorkoutRoomInvitationDto> {
    const room = await this.findActiveMemberRoomOrThrow(userId, roomId);
    this.assertOwner(room.ownerUserId, userId);

    const invitation = await this.prisma.sharedWorkoutRoomInvitation.findFirst({
      where: { id: invitationId, roomId },
      include: invitationInclude,
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'SHARED_WORKOUT_INVITATION_NOT_FOUND',
        message: 'Invitation introuvable.',
      });
    }

    if (invitation.status === 'CANCELLED') {
      return toSharedWorkoutRoomInvitationDto(invitation);
    }
    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        code: 'SHARED_WORKOUT_INVITATION_INVALID_STATUS',
        message: 'Seule une invitation en attente peut être annulée.',
      });
    }

    const now = new Date();
    const updated = await this.prisma.sharedWorkoutRoomInvitation.updateMany({
      where: { id: invitationId, roomId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: now },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'SHARED_WORKOUT_INVITATION_INVALID_STATUS',
        message: 'Cette invitation a déjà été traitée.',
      });
    }

    const refreshed = await this.prisma.sharedWorkoutRoomInvitation.findUniqueOrThrow(
      {
        where: { id: invitationId },
        include: invitationInclude,
      },
    );
    return toSharedWorkoutRoomInvitationDto(refreshed);
  }

  async leaveRoom(
    userId: string,
    roomId: string,
  ): Promise<{ left: true }> {
    const room = await this.prisma.sharedWorkoutRoom.findFirst({
      where: {
        id: roomId,
        members: { some: { userId } },
      },
      include: {
        members: {
          where: { userId },
        },
      },
    });
    if (!room) {
      throw new NotFoundException({
        code: 'SHARED_WORKOUT_ROOM_NOT_FOUND',
        message: 'Salle introuvable.',
      });
    }

    const membership = room.members[0];
    if (!membership) {
      throw new NotFoundException({
        code: 'SHARED_WORKOUT_ROOM_NOT_FOUND',
        message: 'Salle introuvable.',
      });
    }

    if (membership.role === 'OWNER' || room.ownerUserId === userId) {
      throw new ForbiddenException({
        code: 'SHARED_WORKOUT_ROOM_OWNER_CANNOT_LEAVE',
        message: 'Le propriétaire ne peut pas quitter sa salle.',
      });
    }

    if (membership.leftAt != null) {
      return { left: true };
    }

    if (!canLeaveSharedWorkoutRoom(room.status as SharedWorkoutRoomStatusValue)) {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS',
        message: 'Impossible de quitter une salle terminée ou annulée.',
      });
    }

    const updated = await this.prisma.sharedWorkoutRoomMember.updateMany({
      where: {
        roomId,
        userId,
        role: 'MEMBER',
        leftAt: null,
      },
      data: { leftAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_MEMBER_NOT_ACTIVE',
        message: 'Tu n’es plus membre actif de cette salle.',
      });
    }

    this.realtime.emitRoomChanged(roomId, 'MEMBER_LEFT');
    this.realtime.evictUserFromRoom(roomId, userId);
    return { left: true };
  }

  private async listInvitations(
    scope: { roomId?: string; inviteeUserId?: string },
    query: Record<string, string | undefined>,
  ): Promise<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>> {
    const parsed = sharedWorkoutRoomInvitationListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Paramètres de liste invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    let cursorFilter:
      | ReturnType<typeof buildSharedWorkoutRoomInvitationCursorFilter>
      | undefined;
    if (parsed.data.cursor) {
      try {
        cursorFilter = buildSharedWorkoutRoomInvitationCursorFilter(
          decodeSharedWorkoutRoomInvitationCursor(parsed.data.cursor),
        );
      } catch {
        throw new BadRequestException({
          code: 'SHARED_WORKOUT_INVITATION_INVALID_CURSOR',
          message: 'Curseur de pagination invalide.',
        });
      }
    }

    const limit = parsed.data.limit;
    const rows = await this.prisma.sharedWorkoutRoomInvitation.findMany({
      where: {
        AND: [
          scope.roomId ? { roomId: scope.roomId } : {},
          scope.inviteeUserId ? { inviteeUserId: scope.inviteeUserId } : {},
          parsed.data.status ? { status: parsed.data.status } : {},
          cursorFilter ?? {},
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: invitationInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeSharedWorkoutRoomInvitationCursor({
            version: 1,
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      data: page.map(toSharedWorkoutRoomInvitationDto),
      pagination: { nextCursor, hasMore },
    };
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
            ...activeMemberSome(userId),
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
          return { room: replay, applied: false as const };
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

        let appliedStatus: SharedWorkoutRoomStatusValue | null = null;
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
          appliedStatus = transition.nextStatus;

          if (
            transition.nextStatus === 'COMPLETED' ||
            transition.nextStatus === 'CANCELLED'
          ) {
            await tx.sharedWorkoutRoomInvitation.updateMany({
              where: { roomId, status: 'PENDING' },
              data: { status: 'CANCELLED', cancelledAt: now },
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

        const refreshed = await tx.sharedWorkoutRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: roomInclude,
        });
        return { room: refreshed, applied: appliedStatus };
      });

      if (result.applied === 'ACTIVE') {
        this.realtime.emitRoomChanged(roomId, 'STARTED');
      } else if (result.applied === 'COMPLETED') {
        this.realtime.emitRoomChanged(roomId, 'COMPLETED');
      } else if (result.applied === 'CANCELLED') {
        this.realtime.emitRoomChanged(roomId, 'CANCELLED');
      }

      return toSharedWorkoutRoomDetail(result.room, userId);
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

  private async findActiveMemberRoomOrThrow(userId: string, roomId: string) {
    const room = await this.prisma.sharedWorkoutRoom.findFirst({
      where: {
        id: roomId,
        ...activeMemberSome(userId),
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
