import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProgramsModule } from '../programs/programs.module';
import { ProgressModule } from '../progress/progress.module';
import { CoachSummaryService } from './coach-summary.service';
import { CoachingController } from './coaching.controller';
import { CoachingService } from './coaching.service';

@Module({
  imports: [AuthModule, ProgramsModule, ProgressModule],
  controllers: [CoachingController],
  providers: [CoachingService, CoachSummaryService],
  exports: [CoachingService, CoachSummaryService],
})
export class CoachingModule {}
