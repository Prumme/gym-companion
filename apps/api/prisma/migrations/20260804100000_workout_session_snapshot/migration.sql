-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkoutSetStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "sourceProgramId" UUID,
    "sourceWorkoutTemplateId" UUID,
    "programNameSnapshot" TEXT,
    "workoutTemplateNameSnapshot" TEXT,
    "name" TEXT NOT NULL,
    "status" "WorkoutStatus" NOT NULL,
    "localDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_session_exercises" (
    "id" UUID NOT NULL,
    "workoutSessionId" UUID NOT NULL,
    "sourceExerciseId" UUID,
    "sourceTemplateExerciseId" UUID,
    "exerciseNameSnapshot" TEXT NOT NULL,
    "measurementTypeSnapshot" "ExerciseMeasurementType" NOT NULL,
    "position" INTEGER NOT NULL,
    "primaryMuscleGroupNameSnapshot" TEXT,
    "sourceExerciseArchivedAtCreation" BOOLEAN NOT NULL DEFAULT false,
    "equipmentTypeId" UUID,
    "equipmentNameSnapshot" TEXT,
    "equipmentCodeSnapshot" TEXT,
    "notesSnapshot" TEXT,
    "restSecondsSnapshot" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_session_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "workoutSessionExerciseId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "sourceTemplateSetId" UUID,
    "position" INTEGER NOT NULL,
    "setType" "WorkoutSetType" NOT NULL,
    "status" "WorkoutSetStatus",
    "targetWeightKg" DECIMAL(8,3),
    "targetRepMin" INTEGER,
    "targetRepMax" INTEGER,
    "targetDurationSeconds" INTEGER,
    "targetDistanceMeters" DECIMAL(10,2),
    "targetIntensityPercent" DECIMAL(5,2),
    "targetRir" INTEGER,
    "targetRpe" DECIMAL(4,1),
    "targetRestSeconds" INTEGER,
    "actualWeightKg" DECIMAL(8,3),
    "actualReps" INTEGER,
    "actualDurationSeconds" INTEGER,
    "actualDistanceMeters" DECIMAL(10,2),
    "actualRir" INTEGER,
    "actualRpe" DECIMAL(4,1),
    "reachedFailure" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "clientCommandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_sessions_ownerUserId_status_idx" ON "workout_sessions"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "workout_sessions_ownerUserId_localDate_idx" ON "workout_sessions"("ownerUserId", "localDate");

-- CreateIndex
CREATE INDEX "workout_sessions_sourceProgramId_idx" ON "workout_sessions"("sourceProgramId");

-- CreateIndex
CREATE INDEX "workout_sessions_sourceWorkoutTemplateId_idx" ON "workout_sessions"("sourceWorkoutTemplateId");

-- Partial unique: at most one ACTIVE or PAUSED session per user
CREATE UNIQUE INDEX "workout_sessions_one_in_progress_per_user"
ON "workout_sessions" ("ownerUserId")
WHERE "status" IN ('ACTIVE', 'PAUSED');

-- CreateIndex
CREATE INDEX "workout_session_exercises_workoutSessionId_idx" ON "workout_session_exercises"("workoutSessionId");

-- CreateIndex
CREATE INDEX "workout_session_exercises_sourceExerciseId_idx" ON "workout_session_exercises"("sourceExerciseId");

-- CreateIndex
CREATE INDEX "workout_session_exercises_sourceTemplateExerciseId_idx" ON "workout_session_exercises"("sourceTemplateExerciseId");

-- CreateIndex
CREATE INDEX "workout_session_exercises_equipmentTypeId_idx" ON "workout_session_exercises"("equipmentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_session_exercises_workoutSessionId_position_key" ON "workout_session_exercises"("workoutSessionId", "position");

-- CreateIndex
CREATE INDEX "workout_sets_workoutSessionExerciseId_idx" ON "workout_sets"("workoutSessionExerciseId");

-- CreateIndex
CREATE INDEX "workout_sets_ownerUserId_completedAt_idx" ON "workout_sets"("ownerUserId", "completedAt");

-- CreateIndex
CREATE INDEX "workout_sets_sourceTemplateSetId_idx" ON "workout_sets"("sourceTemplateSetId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_workoutSessionExerciseId_position_key" ON "workout_sets"("workoutSessionExerciseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_ownerUserId_clientCommandId_key" ON "workout_sets"("ownerUserId", "clientCommandId");

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_sourceProgramId_fkey" FOREIGN KEY ("sourceProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_sourceWorkoutTemplateId_fkey" FOREIGN KEY ("sourceWorkoutTemplateId") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_sourceExerciseId_fkey" FOREIGN KEY ("sourceExerciseId") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_sourceTemplateExerciseId_fkey" FOREIGN KEY ("sourceTemplateExerciseId") REFERENCES "workout_template_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workoutSessionExerciseId_fkey" FOREIGN KEY ("workoutSessionExerciseId") REFERENCES "workout_session_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_sourceTemplateSetId_fkey" FOREIGN KEY ("sourceTemplateSetId") REFERENCES "workout_template_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
