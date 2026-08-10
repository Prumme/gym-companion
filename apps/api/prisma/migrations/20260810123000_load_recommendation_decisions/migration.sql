-- CreateEnum
CREATE TYPE "LoadRecommendationDecisionType" AS ENUM ('ACCEPTED', 'ADJUSTED', 'IGNORED');

-- CreateTable
CREATE TABLE "load_recommendation_decisions" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workoutTemplateExerciseId" UUID,
    "workoutTemplateId" UUID,
    "programId" UUID,
    "exerciseId" UUID,
    "engineVersion" TEXT NOT NULL,
    "recommendationFingerprint" TEXT NOT NULL,
    "recommendationAction" TEXT NOT NULL,
    "decisionType" "LoadRecommendationDecisionType" NOT NULL,
    "currentTargetWeightKg" DECIMAL(8,3),
    "recommendedWeightKg" DECIMAL(8,3),
    "appliedWeightKg" DECIMAL(8,3),
    "incrementKg" DECIMAL(8,3),
    "incrementSource" TEXT,
    "reasons" JSONB NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "userNote" TEXT,
    "clientCommandId" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "load_recommendation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "load_recommendation_decisions_ownerUserId_createdAt_idx" ON "load_recommendation_decisions"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "load_recommendation_decisions_workoutTemplateExerciseId_crea_idx" ON "load_recommendation_decisions"("workoutTemplateExerciseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "load_recommendation_decisions_ownerUserId_clientCommandId_key" ON "load_recommendation_decisions"("ownerUserId", "clientCommandId");

-- AddForeignKey
ALTER TABLE "load_recommendation_decisions" ADD CONSTRAINT "load_recommendation_decisions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_recommendation_decisions" ADD CONSTRAINT "load_recommendation_decisions_workoutTemplateExerciseId_fkey" FOREIGN KEY ("workoutTemplateExerciseId") REFERENCES "workout_template_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_recommendation_decisions" ADD CONSTRAINT "load_recommendation_decisions_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_recommendation_decisions" ADD CONSTRAINT "load_recommendation_decisions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_recommendation_decisions" ADD CONSTRAINT "load_recommendation_decisions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
