-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goal" "TrainingGoal" NOT NULL,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_templates" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "positionInProgram" INTEGER NOT NULL,
    "estimatedDurationMinutes" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programs_ownerUserId_archivedAt_idx" ON "programs"("ownerUserId", "archivedAt");

-- CreateIndex
CREATE INDEX "programs_ownerUserId_updatedAt_id_idx" ON "programs"("ownerUserId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "workout_templates_ownerUserId_idx" ON "workout_templates"("ownerUserId");

-- CreateIndex
CREATE INDEX "workout_templates_programId_idx" ON "workout_templates"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_templates_programId_positionInProgram_key" ON "workout_templates"("programId", "positionInProgram");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
