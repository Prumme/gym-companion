-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "program_activations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "startedOn" DATE NOT NULL,
    "endedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_schedule_entries" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "workoutTemplateId" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_activations_userId_endedOn_idx" ON "program_activations"("userId", "endedOn");

-- CreateIndex
CREATE INDEX "program_activations_programId_idx" ON "program_activations"("programId");

-- Partial unique: one current activation per user
CREATE UNIQUE INDEX "program_activations_one_current_per_user"
ON "program_activations" ("userId")
WHERE "endedOn" IS NULL;

-- CreateIndex
CREATE INDEX "program_schedule_entries_programId_weekday_idx" ON "program_schedule_entries"("programId", "weekday");

-- CreateIndex
CREATE INDEX "program_schedule_entries_workoutTemplateId_idx" ON "program_schedule_entries"("workoutTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "program_schedule_entries_programId_weekday_position_key" ON "program_schedule_entries"("programId", "weekday", "position");

-- AddForeignKey
ALTER TABLE "program_activations" ADD CONSTRAINT "program_activations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_activations" ADD CONSTRAINT "program_activations_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_schedule_entries" ADD CONSTRAINT "program_schedule_entries_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_schedule_entries" ADD CONSTRAINT "program_schedule_entries_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
