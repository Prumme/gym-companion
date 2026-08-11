import { Module } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { AuthModule } from '../auth/auth.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { PersonalRecordsModule } from '../personal-records/personal-records.module';
import { ProgramsModule } from '../programs/programs.module';
import { ProgressModule } from '../progress/progress.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { AiCoachChatService } from './ai/ai-coach-chat.service';
import { AiCoachExplanationService } from './ai/ai-coach-explanation.service';
import { AI_COACH_PROVIDER } from './ai/ai-coach-provider';
import { AiCoachProposalService } from './ai/ai-coach-proposal.service';
import { AiCoachToolRegistry } from './ai/ai-coach-tool-registry';
import { DisabledAiCoachProvider } from './ai/disabled-ai-coach.provider';
import { FakeAiCoachProvider } from './ai/fake-ai-coach.provider';
import { OpenAiCoachProvider } from './ai/openai-ai-coach.provider';
import { CoachSummaryService } from './coach-summary.service';
import { CoachingController } from './coaching.controller';
import { CoachingService } from './coaching.service';

@Module({
  imports: [
    AuthModule,
    ProgramsModule,
    ProgressModule,
    WorkoutsModule,
    PersonalRecordsModule,
    ExercisesModule,
  ],
  controllers: [CoachingController],
  providers: [
    CoachingService,
    CoachSummaryService,
    AiCoachExplanationService,
    AiCoachChatService,
    AiCoachToolRegistry,
    AiCoachProposalService,
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
  exports: [
    CoachingService,
    CoachSummaryService,
    AiCoachExplanationService,
    AiCoachChatService,
    AiCoachProposalService,
  ],
})
export class CoachingModule {}
