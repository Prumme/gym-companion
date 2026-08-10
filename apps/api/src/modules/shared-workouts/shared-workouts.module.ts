import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SharedWorkoutInvitationsController } from './shared-workout-invitations.controller';
import { SharedWorkoutsController } from './shared-workouts.controller';
import { SharedWorkoutsService } from './shared-workouts.service';

@Module({
  imports: [AuthModule],
  controllers: [SharedWorkoutsController, SharedWorkoutInvitationsController],
  providers: [SharedWorkoutsService],
  exports: [SharedWorkoutsService],
})
export class SharedWorkoutsModule {}
