import { Injectable } from '@nestjs/common';
import { isProcessedSetStatus } from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';
import { SharedWorkoutEquipmentCoordinationService } from './shared-workout-equipment-coordination.service';
import { SharedWorkoutRealtimePublisher } from './shared-workout-realtime.publisher';

/**
 * Pont Shared 5.4/5.5/5.6 : après mutation WorkoutSession liée à une room ACTIVE
 * et membership actif, émet un hint realtime (après commit).
 */
@Injectable()
export class SharedWorkoutSessionLinkNotifier {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: SharedWorkoutRealtimePublisher,
    private readonly equipmentCoordination: SharedWorkoutEquipmentCoordinationService,
  ) {}

  async notifyIfLinked(workoutSessionId: string): Promise<void> {
    const link = await this.findActiveRoomLink(workoutSessionId);
    if (!link) return;
    this.realtime.emitRoomChanged(
      link.roomId,
      'MEMBER_WORKOUT_CHANGED',
      link.userId,
    );
  }

  /**
   * Shared 5.5 — n’émet que si le caractère processed de la série a changé.
   */
  async notifyProgressIfProcessedChanged(
    workoutSessionId: string,
    previousStatus: string,
    nextStatus: string,
  ): Promise<void> {
    const wasProcessed = isProcessedSetStatus(previousStatus);
    const nowProcessed = isProcessedSetStatus(nextStatus);
    if (wasProcessed === nowProcessed) return;

    const link = await this.findActiveRoomLink(workoutSessionId);
    if (!link) return;
    this.realtime.emitRoomChanged(
      link.roomId,
      'MEMBER_WORKOUT_PROGRESS_CHANGED',
      link.userId,
    );
  }

  /**
   * Shared 5.5 / 5.6 — nettoie exercice courant + file équipement après lifecycle terminal.
   */
  async clearCurrentExerciseAfterTerminal(
    workoutSessionId: string,
  ): Promise<void> {
    const link = await this.prisma.sharedWorkoutRoomMemberSession.findUnique({
      where: { workoutSessionId },
      select: {
        id: true,
        currentWorkoutSessionExerciseId: true,
      },
    });
    if (!link) return;

    if (link.currentWorkoutSessionExerciseId != null) {
      await this.prisma.sharedWorkoutRoomMemberSession.update({
        where: { id: link.id },
        data: {
          currentWorkoutSessionExerciseId: null,
          currentExerciseChangedAt: new Date(),
        },
      });
    }

    await this.equipmentCoordination.cleanupWorkoutTerminal(workoutSessionId);
  }

  private async findActiveRoomLink(workoutSessionId: string): Promise<{
    roomId: string;
    userId: string;
  } | null> {
    const link = await this.prisma.sharedWorkoutRoomMemberSession.findUnique({
      where: { workoutSessionId },
      select: {
        roomMember: {
          select: {
            roomId: true,
            userId: true,
            leftAt: true,
            room: { select: { status: true } },
          },
        },
      },
    });
    if (!link) return null;
    if (link.roomMember.leftAt != null) return null;
    if (link.roomMember.room.status !== 'ACTIVE') return null;
    return {
      roomId: link.roomMember.roomId,
      userId: link.roomMember.userId,
    };
  }
}
