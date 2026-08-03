-- CreateEnum
CREATE TYPE "WorkoutSetType" AS ENUM ('WARMUP', 'WORKING', 'BACKOFF', 'DROP_SET', 'AMRAP', 'FAILURE_OPTIONAL');

-- CreateTable
CREATE TABLE "workout_template_exercises" (
    "id" UUID NOT NULL,
    "workoutTemplateId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "equipmentTypeId" UUID,
    "restSecondsOverride" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_template_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_template_sets" (
    "id" UUID NOT NULL,
    "workoutTemplateExerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "setType" "WorkoutSetType" NOT NULL,
    "targetRepMin" INTEGER,
    "targetRepMax" INTEGER,
    "targetDurationSeconds" INTEGER,
    "targetDistanceMeters" DECIMAL(10,2),
    "targetWeightKg" DECIMAL(8,3),
    "targetIntensityPercent" DECIMAL(5,2),
    "targetRir" INTEGER,
    "targetRpe" DECIMAL(4,1),
    "restSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_template_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_template_exercises_exerciseId_idx" ON "workout_template_exercises"("exerciseId");

-- CreateIndex
CREATE INDEX "workout_template_exercises_equipmentTypeId_idx" ON "workout_template_exercises"("equipmentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_template_exercises_workoutTemplateId_exerciseId_key" ON "workout_template_exercises"("workoutTemplateId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_template_exercises_workoutTemplateId_position_key" ON "workout_template_exercises"("workoutTemplateId", "position");

-- CreateIndex
CREATE INDEX "workout_template_sets_workoutTemplateExerciseId_idx" ON "workout_template_sets"("workoutTemplateExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_template_sets_workoutTemplateExerciseId_position_key" ON "workout_template_sets"("workoutTemplateExerciseId", "position");

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_sets" ADD CONSTRAINT "workout_template_sets_workoutTemplateExerciseId_fkey" FOREIGN KEY ("workoutTemplateExerciseId") REFERENCES "workout_template_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
