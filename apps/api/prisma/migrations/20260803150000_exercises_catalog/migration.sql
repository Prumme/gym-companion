-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "ExerciseMeasurementType" AS ENUM (
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION'
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID,
    "source" "ExerciseSource" NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT,
    "primaryMuscleGroupId" UUID NOT NULL,
    "measurementType" "ExerciseMeasurementType" NOT NULL,
    "defaultEquipmentTypeId" UUID,
    "defaultRestSeconds" INTEGER,
    "instructions" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_secondary_muscles" (
    "exerciseId" UUID NOT NULL,
    "muscleGroupId" UUID NOT NULL,

    CONSTRAINT "exercise_secondary_muscles_pkey" PRIMARY KEY ("exerciseId","muscleGroupId")
);

-- CreateTable
CREATE TABLE "exercise_equipment_compatibilities" (
    "id" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "equipmentTypeId" UUID NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "exercise_equipment_compatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_slug_key" ON "exercises"("slug");

-- CreateIndex
CREATE INDEX "exercises_ownerUserId_idx" ON "exercises"("ownerUserId");

-- CreateIndex
CREATE INDEX "exercises_source_idx" ON "exercises"("source");

-- CreateIndex
CREATE INDEX "exercises_primaryMuscleGroupId_idx" ON "exercises"("primaryMuscleGroupId");

-- CreateIndex
CREATE INDEX "exercises_archivedAt_idx" ON "exercises"("archivedAt");

-- CreateIndex
CREATE INDEX "exercises_normalizedName_idx" ON "exercises"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_equipment_compatibilities_exerciseId_equipmentTyp_key" ON "exercise_equipment_compatibilities"("exerciseId", "equipmentTypeId");

-- CreateIndex
CREATE INDEX "exercise_equipment_compatibilities_equipmentTypeId_idx" ON "exercise_equipment_compatibilities"("equipmentTypeId");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_primaryMuscleGroupId_fkey" FOREIGN KEY ("primaryMuscleGroupId") REFERENCES "muscle_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_defaultEquipmentTypeId_fkey" FOREIGN KEY ("defaultEquipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_secondary_muscles" ADD CONSTRAINT "exercise_secondary_muscles_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_secondary_muscles" ADD CONSTRAINT "exercise_secondary_muscles_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "muscle_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_equipment_compatibilities" ADD CONSTRAINT "exercise_equipment_compatibilities_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_equipment_compatibilities" ADD CONSTRAINT "exercise_equipment_compatibilities_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
