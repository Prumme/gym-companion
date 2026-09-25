-- Cardio natif : catégorie d'exercice, type cardio, mesure DISTANCE,
-- métriques facultatives de série et RPE global de séance.
-- Les exercices existants restent STRENGTH (défaut).

ALTER TYPE "ExerciseMeasurementType" ADD VALUE IF NOT EXISTS 'DISTANCE';

CREATE TYPE "ExerciseCategory" AS ENUM ('STRENGTH', 'CARDIO');

CREATE TYPE "CardioType" AS ENUM (
  'RUNNING',
  'WALKING',
  'TREADMILL',
  'CYCLING',
  'ROWING',
  'STAIR_CLIMBING',
  'ELLIPTICAL',
  'OTHER'
);

ALTER TABLE "exercises"
  ADD COLUMN "category" "ExerciseCategory" NOT NULL DEFAULT 'STRENGTH',
  ADD COLUMN "cardioType" "CardioType";

ALTER TABLE "workout_sessions"
  ADD COLUMN "sessionRpe" INTEGER;

ALTER TABLE "workout_sets"
  ADD COLUMN "averageHeartRate" INTEGER,
  ADD COLUMN "inclinePercent" DECIMAL(5, 2),
  ADD COLUMN "resistanceLevel" INTEGER,
  ADD COLUMN "machineLevel" INTEGER,
  ADD COLUMN "floorsClimbed" INTEGER,
  ADD COLUMN "cadenceSpm" INTEGER;
