import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SharedWorkoutsController } from './shared-workouts.controller';
import { SharedWorkoutsService } from './shared-workouts.service';

@Module({
  imports: [AuthModule],
  controllers: [SharedWorkoutsController],
  providers: [SharedWorkoutsService],
  exports: [SharedWorkoutsService],
})
export class SharedWorkoutsModule {}
