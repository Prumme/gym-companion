-- Existing snapshot sets (status NULL) become PENDING
UPDATE "workout_sets" SET "status" = 'PENDING' WHERE "status" IS NULL;

-- Make status required with default PENDING
ALTER TABLE "workout_sets" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"WorkoutSetStatus";
ALTER TABLE "workout_sets" ALTER COLUMN "status" SET NOT NULL;
