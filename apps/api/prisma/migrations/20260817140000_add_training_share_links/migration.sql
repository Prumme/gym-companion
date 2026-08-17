-- CreateEnum
CREATE TYPE "TrainingShareKind" AS ENUM ('PROGRAM', 'WORKOUT_TEMPLATE');

-- CreateTable
CREATE TABLE "training_share_links" (
    "id" UUID NOT NULL,
    "kind" "TrainingShareKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "training_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_share_links_tokenHash_key" ON "training_share_links"("tokenHash");

-- CreateIndex
CREATE INDEX "training_share_links_expiresAt_idx" ON "training_share_links"("expiresAt");

-- CreateIndex
CREATE INDEX "training_share_links_createdByUserId_idx" ON "training_share_links"("createdByUserId");

-- AddForeignKey
ALTER TABLE "training_share_links" ADD CONSTRAINT "training_share_links_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
