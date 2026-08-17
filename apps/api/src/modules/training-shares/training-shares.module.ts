import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TrainingSharesController } from './training-shares.controller';
import { TrainingSharesService } from './training-shares.service';

@Module({
  imports: [AuthModule],
  controllers: [TrainingSharesController],
  providers: [TrainingSharesService],
  exports: [TrainingSharesService],
})
export class TrainingSharesModule {}
