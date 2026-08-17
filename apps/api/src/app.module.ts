import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { UsersModule } from './modules/users/users.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { PersonalRecordsModule } from './modules/personal-records/personal-records.module';
import { ProgressModule } from './modules/progress/progress.module';
import { CoachingModule } from './modules/coaching/coaching.module';
import { SharedWorkoutsModule } from './modules/shared-workouts/shared-workouts.module';
import { TrainingSharesModule } from './modules/training-shares/training-shares.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    ReferenceModule,
    ExercisesModule,
    ProgramsModule,
    WorkoutsModule,
    PersonalRecordsModule,
    ProgressModule,
    CoachingModule,
    SharedWorkoutsModule,
    TrainingSharesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
