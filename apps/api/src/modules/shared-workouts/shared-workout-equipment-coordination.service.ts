import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MySharedWorkoutEquipmentState,
  SharedWorkoutEquipmentCoordinationDto,
  SharedWorkoutEquipmentState,
} from '@gym-companion/shared';
import {
  buildSharedWorkoutEquipmentCommandFingerprint,
  computeWaitingQueuePosition,
  isCoordinatableEquipmentCode,
  sharedWorkoutEquipmentCommandBodySchema,
  type SharedWorkoutEquipmentCommandAction,
} from '@gym-companion/validation';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import { SharedWorkoutRealtimePublisher } from './shared-workout-realtime.publisher';

type Tx = Prisma.TransactionClient;

type QueueRow = {
  id: string;
  roomId: string;
  roomMemberId: string;
  equipmentTypeId: string;
  status: 'WAITING' | 'USING' | 'RELEASED' | 'CANCELLED';
  requestedAt: Date;
  acquiredAt: Date | null;
  roomMember: {
    userId: string;
    leftAt: Date | null;
    user: { profile: { displayName: string } | null };
  };
  equipmentType: { id: string; name: string; code: string };
};

const activeStatuses = ['WAITING', 'USING'] as const;

/**
 * Shared 5.6 — file FIFO d’équipement logique (`EquipmentType`).
 * Limite documentée : pas d’inventaire physique (N machines identiques).
 * Source de vérité : PostgreSQL. Socket = hint d’invalidation.
 */
@Injectable()
export class SharedWorkoutEquipmentCoordinationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: SharedWorkoutRealtimePublisher,
  ) {}

  async getCoordination(
    userId: string,
    roomId: string,
  ): Promise<SharedWorkoutEquipmentCoordinationDto> {
    await this.requireActiveMember(userId, roomId);
    return this.buildCoordinationDto(roomId);
  }

  async getMyEquipment(
    userId: string,
    roomId: string,
  ): Promise<MySharedWorkoutEquipmentState> {
    const ctx = await this.resolveMemberEquipmentContext(userId, roomId);
    if (!ctx.ok) {
      return {
        available: false,
        equipment: null,
        state: 'NONE',
        queuePosition: null,
        occupiedBy: null,
      };
    }

    const { equipment, activeEntry, usingEntry, waitingEntries } = ctx;

    if (activeEntry?.status === 'USING') {
      return {
        available: true,
        equipment,
        state: 'USING',
        queuePosition: null,
        occupiedBy: null,
      };
    }

    if (activeEntry?.status === 'WAITING') {
      return {
        available: true,
        equipment,
        state: 'WAITING',
        queuePosition: computeWaitingQueuePosition(
          waitingEntries,
          activeEntry.id,
        ),
        occupiedBy: usingEntry
          ? {
              userId: usingEntry.roomMember.userId,
              displayName:
                usingEntry.roomMember.user.profile?.displayName ?? null,
            }
          : null,
      };
    }

    // Occupied by someone else, not yet queued — frontend uses occupiedBy.
    if (usingEntry) {
      return {
        available: true,
        equipment,
        state: 'AVAILABLE',
        queuePosition: null,
        occupiedBy: {
          userId: usingEntry.roomMember.userId,
          displayName: usingEntry.roomMember.user.profile?.displayName ?? null,
        },
      };
    }

    return {
      available: true,
      equipment,
      state: 'AVAILABLE',
      queuePosition: null,
      occupiedBy: null,
    };
  }

  async request(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<MySharedWorkoutEquipmentState> {
    const { clientCommandId } = this.parseCommandBody(body);
    const fingerprint = buildSharedWorkoutEquipmentCommandFingerprint({
      action: 'REQUEST',
      roomId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const replay = await this.replayOrRegisterCommand(
        tx,
        userId,
        roomId,
        clientCommandId,
        'REQUEST',
        fingerprint,
      );
      if (replay) {
        return { changed: false as const };
      }

      const ctx = await this.resolveMemberEquipmentContext(userId, roomId, tx);
      if (!ctx.ok) {
        throw new BadRequestException({
          code: 'SHARED_EQUIPMENT_NOT_COORDINATABLE',
          message:
            'Aucun équipement coordonnable pour ton exercice courant.',
        });
      }

      if (ctx.activeEntry?.status === 'USING' || ctx.activeEntry?.status === 'WAITING') {
        return { changed: false as const };
      }

      const now = new Date();
      if (!ctx.usingEntry) {
        try {
          await tx.sharedWorkoutEquipmentQueueEntry.create({
            data: {
              id: randomUUID(),
              roomId,
              roomMemberId: ctx.roomMemberId,
              equipmentTypeId: ctx.equipment.id,
              status: 'USING',
              requestedAt: now,
              acquiredAt: now,
            },
          });
          return { changed: true as const };
        } catch (error) {
          if (!this.isUniqueViolation(error)) throw error;
          // Concurrent acquire — fall through to WAITING.
        }
      }

      await tx.sharedWorkoutEquipmentQueueEntry.create({
        data: {
          id: randomUUID(),
          roomId,
          roomMemberId: ctx.roomMemberId,
          equipmentTypeId: ctx.equipment.id,
          status: 'WAITING',
          requestedAt: now,
        },
      });
      return { changed: true as const };
    });

    if (result.changed) {
      this.realtime.emitRoomChanged(roomId, 'EQUIPMENT_COORDINATION_CHANGED');
    }
    return this.getMyEquipment(userId, roomId);
  }

  async release(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<MySharedWorkoutEquipmentState> {
    const { clientCommandId } = this.parseCommandBody(body);
    const fingerprint = buildSharedWorkoutEquipmentCommandFingerprint({
      action: 'RELEASE',
      roomId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const replay = await this.replayOrRegisterCommand(
        tx,
        userId,
        roomId,
        clientCommandId,
        'RELEASE',
        fingerprint,
      );
      if (replay) {
        return { changed: false as const };
      }

      const membership = await this.requireActiveMember(userId, roomId, tx);
      const using = await tx.sharedWorkoutEquipmentQueueEntry.findFirst({
        where: {
          roomId,
          roomMemberId: membership.id,
          status: 'USING',
        },
      });
      if (!using) {
        throw new BadRequestException({
          code: 'SHARED_EQUIPMENT_NOT_USING',
          message: 'Tu n’utilises pas d’équipement partagé.',
        });
      }

      const now = new Date();
      await tx.sharedWorkoutEquipmentQueueEntry.update({
        where: { id: using.id },
        data: { status: 'RELEASED', releasedAt: now },
      });

      await this.promoteNextWaiting(tx, roomId, using.equipmentTypeId, now);
      return { changed: true as const };
    });

    if (result.changed) {
      this.realtime.emitRoomChanged(roomId, 'EQUIPMENT_COORDINATION_CHANGED');
    }
    return this.getMyEquipment(userId, roomId);
  }

  async cancelWaiting(
    userId: string,
    roomId: string,
    body: unknown,
  ): Promise<MySharedWorkoutEquipmentState> {
    const { clientCommandId } = this.parseCommandBody(body);
    const fingerprint = buildSharedWorkoutEquipmentCommandFingerprint({
      action: 'CANCEL',
      roomId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const replay = await this.replayOrRegisterCommand(
        tx,
        userId,
        roomId,
        clientCommandId,
        'CANCEL',
        fingerprint,
      );
      if (replay) {
        return { changed: false as const };
      }

      const membership = await this.requireActiveMember(userId, roomId, tx);
      const waiting = await tx.sharedWorkoutEquipmentQueueEntry.findFirst({
        where: {
          roomId,
          roomMemberId: membership.id,
          status: 'WAITING',
        },
      });
      if (!waiting) {
        throw new BadRequestException({
          code: 'SHARED_EQUIPMENT_NOT_WAITING',
          message:
            'Tu n’es pas en file d’attente. Utilise « libérer » si tu occupes l’équipement.',
        });
      }

      await tx.sharedWorkoutEquipmentQueueEntry.update({
        where: { id: waiting.id },
        data: { status: 'CANCELLED', releasedAt: new Date() },
      });
      return { changed: true as const };
    });

    if (result.changed) {
      this.realtime.emitRoomChanged(roomId, 'EQUIPMENT_COORDINATION_CHANGED');
    }
    return this.getMyEquipment(userId, roomId);
  }

  /**
   * Avant changement d’exercice courant :
   * - USING + équipement différent → refus
   * - USING + même équipement → OK
   * Après succès : annuler WAITING sur l’ancien équipement si pertinent.
   */
  async assertCanChangeCurrentExercise(
    userId: string,
    roomId: string,
    nextExerciseId: string | null,
    db: Tx | PrismaService = this.prisma,
  ): Promise<void> {
    const membership = await db.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      include: {
        memberSession: {
          include: {
            currentWorkoutExercise: {
              select: {
                equipmentTypeId: true,
                equipmentType: { select: { code: true } },
              },
            },
          },
        },
      },
    });
    if (!membership?.memberSession) return;

    const using = await db.sharedWorkoutEquipmentQueueEntry.findFirst({
      where: {
        roomId,
        roomMemberId: membership.id,
        status: 'USING',
      },
    });
    if (!using) return;

    if (nextExerciseId == null) {
      throw new BadRequestException({
        code: 'SHARED_EQUIPMENT_STILL_USING',
        message:
          'Tu utilises encore cet équipement. Libère-le avant de changer d’exercice.',
      });
    }

    const next = await db.workoutSessionExercise.findFirst({
      where: {
        id: nextExerciseId,
        workoutSessionId: membership.memberSession.workoutSessionId,
      },
      select: {
        equipmentTypeId: true,
        equipmentType: { select: { code: true } },
      },
    });
    if (!next) return;

    const nextCoordinatable =
      next.equipmentTypeId != null &&
      isCoordinatableEquipmentCode(next.equipmentType?.code);
    if (!nextCoordinatable || next.equipmentTypeId !== using.equipmentTypeId) {
      throw new BadRequestException({
        code: 'SHARED_EQUIPMENT_STILL_USING',
        message:
          'Tu utilises encore cet équipement. Libère-le avant de changer d’exercice.',
      });
    }
  }

  /**
   * Après changement d’exercice validé : annule les WAITING dont l’équipement
   * ne correspond plus (ou tout WAITING si nouvel équipement différent / null).
   */
  async afterCurrentExerciseChanged(
    userId: string,
    roomId: string,
    nextExerciseId: string | null,
  ): Promise<void> {
    const membership = await this.prisma.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      select: { id: true },
    });
    if (!membership) return;

    let nextEquipmentId: string | null = null;
    if (nextExerciseId) {
      const next = await this.prisma.workoutSessionExercise.findFirst({
        where: { id: nextExerciseId },
        select: {
          equipmentTypeId: true,
          equipmentType: { select: { code: true } },
        },
      });
      if (
        next?.equipmentTypeId &&
        isCoordinatableEquipmentCode(next.equipmentType?.code)
      ) {
        nextEquipmentId = next.equipmentTypeId;
      }
    }

    const waiting = await this.prisma.sharedWorkoutEquipmentQueueEntry.findMany(
      {
        where: {
          roomId,
          roomMemberId: membership.id,
          status: 'WAITING',
        },
      },
    );

    const toCancel = waiting.filter(
      (entry) =>
        nextEquipmentId == null || entry.equipmentTypeId !== nextEquipmentId,
    );
    if (toCancel.length === 0) return;

    await this.prisma.sharedWorkoutEquipmentQueueEntry.updateMany({
      where: { id: { in: toCancel.map((entry) => entry.id) } },
      data: { status: 'CANCELLED', releasedAt: new Date() },
    });
    this.realtime.emitRoomChanged(roomId, 'EQUIPMENT_COORDINATION_CHANGED');
  }

  /** Leave MEMBER : WAITING→CANCELLED, USING→RELEASED+promote. */
  async cleanupMemberLeave(
    roomId: string,
    roomMemberId: string,
    tx: Tx,
  ): Promise<boolean> {
    const now = new Date();
    let changed = false;

    const waiting = await tx.sharedWorkoutEquipmentQueueEntry.updateMany({
      where: { roomId, roomMemberId, status: 'WAITING' },
      data: { status: 'CANCELLED', releasedAt: now },
    });
    if (waiting.count > 0) changed = true;

    const usingEntries = await tx.sharedWorkoutEquipmentQueueEntry.findMany({
      where: { roomId, roomMemberId, status: 'USING' },
    });
    for (const entry of usingEntries) {
      await tx.sharedWorkoutEquipmentQueueEntry.update({
        where: { id: entry.id },
        data: { status: 'RELEASED', releasedAt: now },
      });
      await this.promoteNextWaiting(tx, roomId, entry.equipmentTypeId, now);
      changed = true;
    }
    return changed;
  }

  /** Workout COMPLETED/CANCELLED : même sémantique que leave pour ce membre. */
  async cleanupWorkoutTerminal(
    workoutSessionId: string,
  ): Promise<void> {
    const link = await this.prisma.sharedWorkoutRoomMemberSession.findUnique({
      where: { workoutSessionId },
      select: {
        roomMemberId: true,
        roomMember: {
          select: { roomId: true, leftAt: true, userId: true },
        },
      },
    });
    if (!link || link.roomMember.leftAt != null) return;

    const roomId = link.roomMember.roomId;
    const room = await this.prisma.sharedWorkoutRoom.findUnique({
      where: { id: roomId },
      select: { status: true },
    });
    if (!room || room.status !== 'ACTIVE') return;

    const changed = await this.prisma.$transaction(async (tx) =>
      this.cleanupMemberLeave(roomId, link.roomMemberId, tx),
    );
    if (changed) {
      this.realtime.emitRoomChanged(roomId, 'EQUIPMENT_COORDINATION_CHANGED');
    }
  }

  /** Room COMPLETED/CANCELLED : tous actifs → RELEASED/CANCELLED, pas de promo. */
  async cleanupRoomTerminal(roomId: string, tx: Tx): Promise<void> {
    const now = new Date();
    await tx.sharedWorkoutEquipmentQueueEntry.updateMany({
      where: { roomId, status: 'WAITING' },
      data: { status: 'CANCELLED', releasedAt: now },
    });
    await tx.sharedWorkoutEquipmentQueueEntry.updateMany({
      where: { roomId, status: 'USING' },
      data: { status: 'RELEASED', releasedAt: now },
    });
  }

  private async promoteNextWaiting(
    tx: Tx,
    roomId: string,
    equipmentTypeId: string,
    now: Date,
  ): Promise<void> {
    const next = await tx.sharedWorkoutEquipmentQueueEntry.findFirst({
      where: {
        roomId,
        equipmentTypeId,
        status: 'WAITING',
        roomMember: { leftAt: null },
      },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
    });
    if (!next) return;

    try {
      await tx.sharedWorkoutEquipmentQueueEntry.update({
        where: { id: next.id },
        data: { status: 'USING', acquiredAt: now },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      // Un autre USING a gagné la course — laisser en WAITING.
    }
  }

  private async buildCoordinationDto(
    roomId: string,
  ): Promise<SharedWorkoutEquipmentCoordinationDto> {
    const [activeEntries, currentExercises] = await Promise.all([
      this.prisma.sharedWorkoutEquipmentQueueEntry.findMany({
        where: {
          roomId,
          status: { in: [...activeStatuses] },
          roomMember: { leftAt: null },
        },
        include: {
          roomMember: {
            select: {
              userId: true,
              leftAt: true,
              user: { select: { profile: { select: { displayName: true } } } },
            },
          },
          equipmentType: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.sharedWorkoutRoomMemberSession.findMany({
        where: {
          roomMember: { roomId, leftAt: null },
          currentWorkoutSessionExerciseId: { not: null },
        },
        select: {
          currentWorkoutExercise: {
            select: {
              equipmentTypeId: true,
              equipmentType: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    const byEquipment = new Map<
      string,
      {
        equipment: { id: string; name: string; code: string };
        using: QueueRow | null;
        waiting: QueueRow[];
      }
    >();

    function ensure(equipment: { id: string; name: string; code: string }) {
      let bucket = byEquipment.get(equipment.id);
      if (!bucket) {
        bucket = { equipment, using: null, waiting: [] };
        byEquipment.set(equipment.id, bucket);
      }
      return bucket;
    }

    for (const session of currentExercises) {
      const eq = session.currentWorkoutExercise?.equipmentType;
      if (!eq || !isCoordinatableEquipmentCode(eq.code)) continue;
      ensure(eq);
    }

    for (const entry of activeEntries as QueueRow[]) {
      if (!isCoordinatableEquipmentCode(entry.equipmentType.code)) continue;
      const bucket = ensure(entry.equipmentType);
      if (entry.status === 'USING') {
        bucket.using = entry;
      } else if (entry.status === 'WAITING') {
        bucket.waiting.push(entry);
      }
    }

    const equipment: SharedWorkoutEquipmentState[] = [...byEquipment.values()]
      .filter((bucket) => bucket.using != null || bucket.waiting.length > 0)
      .map((bucket) => {
        const waitingSorted = bucket.waiting
          .slice()
          .sort((a, b) => {
            const ta = a.requestedAt.getTime();
            const tb = b.requestedAt.getTime();
            if (ta !== tb) return ta - tb;
            return a.id.localeCompare(b.id);
          });
        return {
          equipment: bucket.equipment,
          using: bucket.using
            ? {
                userId: bucket.using.roomMember.userId,
                displayName:
                  bucket.using.roomMember.user.profile?.displayName ?? null,
                since: (bucket.using.acquiredAt ?? bucket.using.requestedAt).toISOString(),
              }
            : null,
          waiting: waitingSorted.map((entry, index) => ({
            position: index + 1,
            userId: entry.roomMember.userId,
            displayName:
              entry.roomMember.user.profile?.displayName ?? null,
            requestedAt: entry.requestedAt.toISOString(),
          })),
        };
      })
      .sort((a, b) => a.equipment.name.localeCompare(b.equipment.name, 'fr'));

    return { equipment };
  }

  private async resolveMemberEquipmentContext(
    userId: string,
    roomId: string,
    db: Tx | PrismaService = this.prisma,
  ): Promise<
    | { ok: false }
    | {
        ok: true;
        roomMemberId: string;
        equipment: { id: string; name: string; code: string };
        activeEntry: QueueRow | null;
        usingEntry: QueueRow | null;
        waitingEntries: QueueRow[];
      }
  > {
    const membership = await db.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      include: {
        room: { select: { status: true } },
        memberSession: {
          include: {
            currentWorkoutExercise: {
              select: {
                equipmentTypeId: true,
                equipmentNameSnapshot: true,
                equipmentType: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });
    if (!membership || membership.room.status !== 'ACTIVE') {
      return { ok: false };
    }
    if (!membership.memberSession?.currentWorkoutExercise) {
      return { ok: false };
    }

    const exercise = membership.memberSession.currentWorkoutExercise;
    const equipmentType = exercise.equipmentType;
    if (
      !exercise.equipmentTypeId ||
      !equipmentType ||
      !isCoordinatableEquipmentCode(equipmentType.code)
    ) {
      return { ok: false };
    }

    const equipment = {
      id: equipmentType.id,
      name: exercise.equipmentNameSnapshot ?? equipmentType.name,
      code: equipmentType.code,
    };

    const entries = (await db.sharedWorkoutEquipmentQueueEntry.findMany({
      where: {
        roomId,
        equipmentTypeId: equipment.id,
        status: { in: [...activeStatuses] },
        roomMember: { leftAt: null },
      },
      include: {
        roomMember: {
          select: {
            userId: true,
            leftAt: true,
            user: { select: { profile: { select: { displayName: true } } } },
          },
        },
        equipmentType: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
    })) as QueueRow[];

    const activeEntry =
      entries.find((entry) => entry.roomMemberId === membership.id) ?? null;
    const usingEntry =
      entries.find((entry) => entry.status === 'USING') ?? null;
    const waitingEntries = entries.filter((entry) => entry.status === 'WAITING');

    return {
      ok: true,
      roomMemberId: membership.id,
      equipment,
      activeEntry,
      usingEntry,
      waitingEntries,
    };
  }

  private async requireActiveMember(
    userId: string,
    roomId: string,
    db: Tx | PrismaService = this.prisma,
  ) {
    const membership = await db.sharedWorkoutRoomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      include: { room: { select: { status: true } } },
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'SHARED_WORKOUT_ROOM_NOT_FOUND',
        message: 'Salle introuvable.',
      });
    }
    if (membership.room.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'SHARED_WORKOUT_ROOM_NOT_ACTIVE',
        message:
          'La coordination d’équipement n’est disponible que lorsque la salle est active.',
      });
    }
    return membership;
  }

  private parseCommandBody(body: unknown): { clientCommandId: string } {
    const parsed = sharedWorkoutEquipmentCommandBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Commande équipement invalide.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }
    return parsed.data;
  }

  private async replayOrRegisterCommand(
    tx: Tx,
    userId: string,
    roomId: string,
    clientCommandId: string,
    action: SharedWorkoutEquipmentCommandAction,
    fingerprint: string,
  ): Promise<boolean> {
    const existing = await tx.sharedWorkoutEquipmentCommand.findUnique({
      where: {
        ownerUserId_clientCommandId: {
          ownerUserId: userId,
          clientCommandId,
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
          code: 'SHARED_EQUIPMENT_COMMAND_CONFLICT',
          message: 'Commande déjà utilisée avec une opération différente.',
        });
      }
      return true;
    }

    await tx.sharedWorkoutEquipmentCommand.create({
      data: {
        id: randomUUID(),
        ownerUserId: userId,
        roomId,
        clientCommandId,
        action,
        payloadFingerprint: fingerprint,
      },
    });
    return false;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
