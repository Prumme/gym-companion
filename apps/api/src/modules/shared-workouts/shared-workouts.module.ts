import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { SharedWorkoutEquipmentCoordinationService } from './shared-workout-equipment-coordination.service';
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
    SharedWorkoutEquipmentCoordinationService,
  ],
  exports: [
    SharedWorkoutsService,
    SharedWorkoutRealtimePublisher,
    SharedWorkoutSessionLinkNotifier,
    SharedWorkoutEquipmentCoordinationService,
  ],
})
export class SharedWorkoutsModule {}
