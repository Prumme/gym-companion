-- Reçus d’idempotence pour les mises à jour de séries (rejeu hors ligne).
CREATE TABLE "workout_set_commands" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workoutSessionId" UUID NOT NULL,
    "workoutSetId" UUID NOT NULL,
    "clientCommandId" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "appliedVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_set_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_set_commands_ownerUserId_clientCommandId_key" ON "workout_set_commands"("ownerUserId", "clientCommandId");

CREATE INDEX "workout_set_commands_workoutSessionId_idx" ON "workout_set_commands"("workoutSessionId");

CREATE INDEX "workout_set_commands_workoutSetId_idx" ON "workout_set_commands"("workoutSetId");

ALTER TABLE "workout_set_commands" ADD CONSTRAINT "workout_set_commands_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
