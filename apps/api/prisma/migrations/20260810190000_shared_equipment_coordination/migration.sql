-- Shared 5.6 — coordination d’équipement logique (file FIFO)
-- Limite : une ressource logique EquipmentType, pas un inventaire physique.

CREATE TYPE "SharedWorkoutEquipmentQueueStatus" AS ENUM (
  'WAITING',
  'USING',
  'RELEASED',
  'CANCELLED'
);

CREATE TABLE "shared_workout_equipment_queue_entries" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "roomMemberId" UUID NOT NULL,
  "equipmentTypeId" UUID NOT NULL,
  "status" "SharedWorkoutEquipmentQueueStatus" NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acquiredAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "shared_workout_equipment_queue_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shared_workout_equipment_queue_entries_roomId_equipmentTypeId_status_idx"
  ON "shared_workout_equipment_queue_entries"("roomId", "equipmentTypeId", "status");

CREATE INDEX "shared_workout_equipment_queue_entries_roomMemberId_status_idx"
  ON "shared_workout_equipment_queue_entries"("roomMemberId", "status");

CREATE INDEX "shared_workout_equipment_queue_entries_roomId_status_requestedAt_id_idx"
  ON "shared_workout_equipment_queue_entries"("roomId", "status", "requestedAt", "id");

-- Au plus un USING par (room, equipment logique)
CREATE UNIQUE INDEX "shared_workout_equipment_one_using_per_room_equipment"
  ON "shared_workout_equipment_queue_entries"("roomId", "equipmentTypeId")
  WHERE "status" = 'USING';

-- Au plus une demande active (WAITING|USING) par membre/équipement/room
CREATE UNIQUE INDEX "shared_workout_equipment_one_active_per_member_equipment"
  ON "shared_workout_equipment_queue_entries"("roomId", "roomMemberId", "equipmentTypeId")
  WHERE "status" IN ('WAITING', 'USING');

ALTER TABLE "shared_workout_equipment_queue_entries"
  ADD CONSTRAINT "shared_workout_equipment_queue_entries_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "shared_workout_rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shared_workout_equipment_queue_entries"
  ADD CONSTRAINT "shared_workout_equipment_queue_entries_roomMemberId_fkey"
  FOREIGN KEY ("roomMemberId") REFERENCES "shared_workout_room_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shared_workout_equipment_queue_entries"
  ADD CONSTRAINT "shared_workout_equipment_queue_entries_equipmentTypeId_fkey"
  FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Idempotence request / release / cancel
CREATE TABLE "shared_workout_equipment_commands" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "clientCommandId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payloadFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shared_workout_equipment_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shared_workout_equipment_commands_ownerUserId_clientCommandId_key"
  ON "shared_workout_equipment_commands"("ownerUserId", "clientCommandId");

CREATE INDEX "shared_workout_equipment_commands_roomId_idx"
  ON "shared_workout_equipment_commands"("roomId");

ALTER TABLE "shared_workout_equipment_commands"
  ADD CONSTRAINT "shared_workout_equipment_commands_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "shared_workout_rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shared_workout_equipment_commands"
  ADD CONSTRAINT "shared_workout_equipment_commands_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
