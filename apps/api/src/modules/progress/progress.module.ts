import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PersonalRecordsModule } from '../personal-records/personal-records.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [AuthModule, PersonalRecordsModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
