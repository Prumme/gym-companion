-- CreateEnum
CREATE TYPE "AiCoachMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "ai_coach_conversations" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "title" TEXT,
    "contextExerciseId" UUID,
    "archivedAt" TIMESTAMP(3),
    "generationStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_coach_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_coach_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "AiCoachMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "clientCommandId" TEXT,
    "payloadFingerprint" TEXT,
    "providerRequestId" TEXT,
    "generatedFromSchemaVersion" TEXT,
    "promptVersion" TEXT,
    "referencesJson" JSONB,
    "suggestedFollowUpsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_coach_tool_invocations" (
    "id" UUID NOT NULL,
    "assistantMessageId" UUID NOT NULL,
    "toolName" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "outputSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_coach_tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_coach_conversations_ownerUserId_updatedAt_idx" ON "ai_coach_conversations"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_coach_conversations_ownerUserId_archivedAt_updatedAt_idx" ON "ai_coach_conversations"("ownerUserId", "archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_coach_messages_conversationId_createdAt_idx" ON "ai_coach_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_coach_messages_conversationId_clientCommandId_key" ON "ai_coach_messages"("conversationId", "clientCommandId");

-- CreateIndex
CREATE INDEX "ai_coach_tool_invocations_assistantMessageId_createdAt_idx" ON "ai_coach_tool_invocations"("assistantMessageId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_coach_conversations" ADD CONSTRAINT "ai_coach_conversations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_conversations" ADD CONSTRAINT "ai_coach_conversations_contextExerciseId_fkey" FOREIGN KEY ("contextExerciseId") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_messages" ADD CONSTRAINT "ai_coach_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_coach_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coach_tool_invocations" ADD CONSTRAINT "ai_coach_tool_invocations_assistantMessageId_fkey" FOREIGN KEY ("assistantMessageId") REFERENCES "ai_coach_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
