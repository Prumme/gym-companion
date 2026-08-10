-- Shared 5.5 — exercice courant de coordination (éphémère métier, persisté pour refetch).

ALTER TABLE "shared_workout_room_member_sessions"
  ADD COLUMN "currentWorkoutSessionExerciseId" UUID,
  ADD COLUMN "currentExerciseChangedAt" TIMESTAMP(3);

ALTER TABLE "shared_workout_room_member_sessions"
  ADD CONSTRAINT "shared_workout_room_member_sessions_currentWorkoutSessionExerciseId_fkey"
  FOREIGN KEY ("currentWorkoutSessionExerciseId")
  REFERENCES "workout_session_exercises"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "shared_workout_room_member_sessions_currentExercise_idx"
  ON "shared_workout_room_member_sessions"("currentWorkoutSessionExerciseId");
