import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProgramsModule } from '../programs/programs.module';
import { CoachingController } from './coaching.controller';
import { CoachingService } from './coaching.service';

@Module({
  imports: [AuthModule, ProgramsModule],
  controllers: [CoachingController],
  providers: [CoachingService],
  exports: [CoachingService],
})
export class CoachingModule {}
