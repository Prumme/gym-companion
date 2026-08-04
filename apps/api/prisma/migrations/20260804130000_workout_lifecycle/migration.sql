-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN "cancellationReason" TEXT;

-- CreateTable
CREATE TABLE "workout_lifecycle_commands" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workoutSessionId" UUID NOT NULL,
    "clientCommandId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_lifecycle_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_lifecycle_commands_ownerUserId_clientCommandId_key" ON "workout_lifecycle_commands"("ownerUserId", "clientCommandId");

-- CreateIndex
CREATE INDEX "workout_lifecycle_commands_workoutSessionId_idx" ON "workout_lifecycle_commands"("workoutSessionId");

-- AddForeignKey
ALTER TABLE "workout_lifecycle_commands" ADD CONSTRAINT "workout_lifecycle_commands_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
