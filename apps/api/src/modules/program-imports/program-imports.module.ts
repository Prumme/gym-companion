import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProgramsModule } from '../programs/programs.module';
import { ProgramImportsController } from './program-imports.controller';
import { ProgramImportsService } from './program-imports.service';

@Module({
  imports: [AuthModule, ProgramsModule],
  controllers: [ProgramImportsController],
  providers: [ProgramImportsService],
})
export class ProgramImportsModule {}
