import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PersonalRecordsController } from './personal-records.controller';
import { PersonalRecordsService } from './personal-records.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonalRecordsController],
  providers: [PersonalRecordsService],
  exports: [PersonalRecordsService],
})
export class PersonalRecordsModule {}
