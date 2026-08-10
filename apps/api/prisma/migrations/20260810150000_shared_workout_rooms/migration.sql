-- CreateEnum
CREATE TYPE "SharedWorkoutRoomStatus" AS ENUM ('LOBBY', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SharedWorkoutRoomMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "shared_workout_rooms" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SharedWorkoutRoomStatus" NOT NULL DEFAULT 'LOBBY',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_workout_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_workout_room_members" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "SharedWorkoutRoomMemberRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_workout_room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_workout_room_lifecycle_commands" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "clientCommandId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_workout_room_lifecycle_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_workout_rooms_ownerUserId_idx" ON "shared_workout_rooms"("ownerUserId");

-- CreateIndex
CREATE INDEX "shared_workout_rooms_status_idx" ON "shared_workout_rooms"("status");

-- CreateIndex
CREATE INDEX "shared_workout_rooms_updatedAt_id_idx" ON "shared_workout_rooms"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "shared_workout_room_members_userId_idx" ON "shared_workout_room_members"("userId");

-- CreateIndex
CREATE INDEX "shared_workout_room_members_roomId_idx" ON "shared_workout_room_members"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_workout_room_members_roomId_userId_key" ON "shared_workout_room_members"("roomId", "userId");

-- CreateIndex
CREATE INDEX "shared_workout_room_lifecycle_commands_roomId_idx" ON "shared_workout_room_lifecycle_commands"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_workout_room_lifecycle_commands_ownerUserId_clientCommandId_key" ON "shared_workout_room_lifecycle_commands"("ownerUserId", "clientCommandId");

-- AddForeignKey
ALTER TABLE "shared_workout_rooms" ADD CONSTRAINT "shared_workout_rooms_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workout_room_members" ADD CONSTRAINT "shared_workout_room_members_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "shared_workout_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workout_room_members" ADD CONSTRAINT "shared_workout_room_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workout_room_lifecycle_commands" ADD CONSTRAINT "shared_workout_room_lifecycle_commands_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "shared_workout_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workout_room_lifecycle_commands" ADD CONSTRAINT "shared_workout_room_lifecycle_commands_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
