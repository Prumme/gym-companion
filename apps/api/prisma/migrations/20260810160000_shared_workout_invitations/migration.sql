-- AlterTable
ALTER TABLE "shared_workout_room_members" ADD COLUMN "leftAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "shared_workout_room_members_userId_leftAt_idx" ON "shared_workout_room_members"("userId", "leftAt");

-- CreateEnum
CREATE TYPE "SharedWorkoutRoomInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "shared_workout_room_invitations" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "inviteeUserId" UUID NOT NULL,
    "status" "SharedWorkoutRoomInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "shared_workout_room_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_workout_room_invitations_inviteeUserId_status_createdAt_idx" ON "shared_workout_room_invitations"("inviteeUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "shared_workout_room_invitations_roomId_status_createdAt_idx" ON "shared_workout_room_invitations"("roomId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "shared_workout_room_invitations_roomId_inviteeUserId_idx" ON "shared_workout_room_invitations"("roomId", "inviteeUserId");

-- CreateIndex
CREATE INDEX "shared_workout_room_invitations_createdAt_id_idx" ON "shared_workout_room_invitations"("createdAt", "id");

-- Partial unique: une seule invitation PENDING par (room, invitee)
CREATE UNIQUE INDEX "shared_workout_room_invitations_one_pending_per_invitee"
ON "shared_workout_room_invitations" ("roomId", "inviteeUserId")
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "shared_workout_room_invitations" ADD CONSTRAINT "shared_workout_room_invitations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "shared_workout_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workout_room_invitations" ADD CONSTRAINT "shared_workout_room_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workout_room_invitations" ADD CONSTRAINT "shared_workout_room_invitations_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
