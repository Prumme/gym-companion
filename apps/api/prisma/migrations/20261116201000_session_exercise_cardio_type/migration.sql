-- Type de cardio figé sur la ligne de séance (affichage des métriques adaptées).
ALTER TABLE "workout_session_exercises"
  ADD COLUMN "cardioTypeSnapshot" "CardioType";

-- Rattrapage des séances existantes depuis l’exercice source encore lié.
UPDATE "workout_session_exercises" AS wse
SET "cardioTypeSnapshot" = e."cardioType"
FROM "exercises" AS e
WHERE wse."sourceExerciseId" = e."id"
  AND e."category" = 'CARDIO'
  AND e."cardioType" IS NOT NULL
  AND wse."cardioTypeSnapshot" IS NULL;
