-- Shared 5.4 — rattachement WorkoutSession individuelle ↔ membership room.
-- Présence / performances : hors scope. Aucune cascade vers les séries.

CREATE TABLE "shared_workout_room_member_sessions" (
    "id" UUID NOT NULL,
    "roomMemberId" UUID NOT NULL,
    "workoutSessionId" UUID NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_workout_room_member_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shared_workout_room_member_sessions_roomMemberId_key"
  ON "shared_workout_room_member_sessions"("roomMemberId");

CREATE UNIQUE INDEX "shared_workout_room_member_sessions_workoutSessionId_key"
  ON "shared_workout_room_member_sessions"("workoutSessionId");

ALTER TABLE "shared_workout_room_member_sessions"
  ADD CONSTRAINT "shared_workout_room_member_sessions_roomMemberId_fkey"
  FOREIGN KEY ("roomMemberId") REFERENCES "shared_workout_room_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shared_workout_room_member_sessions"
  ADD CONSTRAINT "shared_workout_room_member_sessions_workoutSessionId_fkey"
  FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
