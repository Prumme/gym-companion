import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma/prisma.service';
import { SharedWorkoutRealtimePublisher } from './shared-workout-realtime.publisher';

/**
 * Pont Shared 5.4 : après mutation lifecycle d’une WorkoutSession liée,
 * émet `MEMBER_WORKOUT_CHANGED` (après commit).
 * Évite un couplage circulaire WorkoutsService ↔ SharedWorkoutsService.
 */
@Injectable()
export class SharedWorkoutSessionLinkNotifier {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: SharedWorkoutRealtimePublisher,
  ) {}

  async notifyIfLinked(workoutSessionId: string): Promise<void> {
    const link = await this.prisma.sharedWorkoutRoomMemberSession.findUnique({
      where: { workoutSessionId },
      select: {
        roomMember: { select: { roomId: true } },
      },
    });
    if (!link) return;
    this.realtime.emitRoomChanged(
      link.roomMember.roomId,
      'MEMBER_WORKOUT_CHANGED',
    );
  }
}
