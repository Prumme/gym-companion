-- CreateEnum
CREATE TYPE "AiCoachProposalKind" AS ENUM ('WORKOUT', 'PROGRAM');

-- CreateEnum
CREATE TYPE "AiCoachProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'INVALID');

-- CreateTable
CREATE TABLE "ai_coach_proposals" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "kind" "AiCoachProposalKind" NOT NULL,
    "status" "AiCoachProposalStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" JSONB NOT NULL,
    "previewJson" JSONB,
    "acceptedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdProgramId" UUID,
    "createdWorkoutTemplateId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_coach_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_coach_proposals_messageId_key" ON "ai_coach_proposals"("messageId");

-- CreateIndex
CREATE INDEX "ai_coach_proposals_ownerUserId_status_createdAt_idx" ON "ai_coach_proposals"("ownerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_coach_proposals_conversationId_idx" ON "ai_coach_proposals"("conversationId");

-- AddForeignKey
ALTER TABLE "ai_coach_proposals" ADD CONSTRAINT "ai_coach_proposals_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_proposals" ADD CONSTRAINT "ai_coach_proposals_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_coach_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_proposals" ADD CONSTRAINT "ai_coach_proposals_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_coach_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_proposals" ADD CONSTRAINT "ai_coach_proposals_createdProgramId_fkey" FOREIGN KEY ("createdProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_proposals" ADD CONSTRAINT "ai_coach_proposals_createdWorkoutTemplateId_fkey" FOREIGN KEY ("createdWorkoutTemplateId") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
