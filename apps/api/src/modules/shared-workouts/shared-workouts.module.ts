import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SharedWorkoutInvitationsController } from './shared-workout-invitations.controller';
import { SharedWorkoutPresenceService } from './shared-workout-presence.service';
import { SharedWorkoutRealtimeGateway } from './shared-workout-realtime.gateway';
import { SharedWorkoutRealtimePublisher } from './shared-workout-realtime.publisher';
import { SharedWorkoutsController } from './shared-workouts.controller';
import { SharedWorkoutsService } from './shared-workouts.service';

@Module({
  imports: [AuthModule],
  controllers: [SharedWorkoutsController, SharedWorkoutInvitationsController],
  providers: [
    SharedWorkoutsService,
    SharedWorkoutPresenceService,
    SharedWorkoutRealtimePublisher,
    SharedWorkoutRealtimeGateway,
  ],
  exports: [SharedWorkoutsService, SharedWorkoutRealtimePublisher],
})
export class SharedWorkoutsModule {}
