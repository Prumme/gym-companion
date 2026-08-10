import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { SharedWorkoutInvitationsController } from './shared-workout-invitations.controller';
import { SharedWorkoutPresenceService } from './shared-workout-presence.service';
import { SharedWorkoutRealtimeGateway } from './shared-workout-realtime.gateway';
import { SharedWorkoutRealtimePublisher } from './shared-workout-realtime.publisher';
import { SharedWorkoutSessionLinkNotifier } from './shared-workout-session-link.notifier';
import { SharedWorkoutsController } from './shared-workouts.controller';
import { SharedWorkoutsService } from './shared-workouts.service';

@Module({
  imports: [AuthModule, forwardRef(() => WorkoutsModule)],
  controllers: [SharedWorkoutsController, SharedWorkoutInvitationsController],
  providers: [
    SharedWorkoutsService,
    SharedWorkoutPresenceService,
    SharedWorkoutRealtimePublisher,
    SharedWorkoutRealtimeGateway,
    SharedWorkoutSessionLinkNotifier,
  ],
  exports: [
    SharedWorkoutsService,
    SharedWorkoutRealtimePublisher,
    SharedWorkoutSessionLinkNotifier,
  ],
})
export class SharedWorkoutsModule {}
