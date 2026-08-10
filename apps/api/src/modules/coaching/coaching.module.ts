import { Module } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { AuthModule } from '../auth/auth.module';
import { ProgramsModule } from '../programs/programs.module';
import { ProgressModule } from '../progress/progress.module';
import { AiCoachExplanationService } from './ai/ai-coach-explanation.service';
import { AI_COACH_PROVIDER } from './ai/ai-coach-provider';
import { DisabledAiCoachProvider } from './ai/disabled-ai-coach.provider';
import { FakeAiCoachProvider } from './ai/fake-ai-coach.provider';
import { OpenAiCoachProvider } from './ai/openai-ai-coach.provider';
import { CoachSummaryService } from './coach-summary.service';
import { CoachingController } from './coaching.controller';
import { CoachingService } from './coaching.service';

@Module({
  imports: [AuthModule, ProgramsModule, ProgressModule],
  controllers: [CoachingController],
  providers: [
    CoachingService,
    CoachSummaryService,
    AiCoachExplanationService,
    {
      provide: AI_COACH_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        if (
          config.aiCoachProvider === 'fake' &&
          (config.nodeEnv === 'test' || config.nodeEnv === 'development')
        ) {
          return new FakeAiCoachProvider();
        }
        if (config.aiCoachProvider === 'openai' && config.aiCoachApiKey) {
          return new OpenAiCoachProvider(config.aiCoachApiKey);
        }
        return new DisabledAiCoachProvider();
      },
    },
  ],
  exports: [CoachingService, CoachSummaryService, AiCoachExplanationService],
})
export class CoachingModule {}
