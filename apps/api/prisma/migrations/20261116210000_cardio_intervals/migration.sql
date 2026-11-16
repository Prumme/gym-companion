-- Fractionné cardio : séries effort / récupération et cibles de vitesse / inclinaison.
ALTER TYPE "WorkoutSetType" ADD VALUE IF NOT EXISTS 'INTERVAL_WORK';
ALTER TYPE "WorkoutSetType" ADD VALUE IF NOT EXISTS 'INTERVAL_RECOVERY';

ALTER TABLE "workout_template_sets"
  ADD COLUMN "targetSpeedKmh" DECIMAL(5, 2),
  ADD COLUMN "targetInclinePercent" DECIMAL(5, 2);

ALTER TABLE "workout_sets"
  ADD COLUMN "targetSpeedKmh" DECIMAL(5, 2),
  ADD COLUMN "targetInclinePercent" DECIMAL(5, 2);
