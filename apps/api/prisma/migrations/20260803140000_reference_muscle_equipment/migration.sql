-- CreateTable
CREATE TABLE "muscle_groups" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "muscle_groups_code_key" ON "muscle_groups"("code");

-- CreateIndex
CREATE INDEX "muscle_groups_parentId_idx" ON "muscle_groups"("parentId");

-- CreateIndex
CREATE INDEX "muscle_groups_isActive_idx" ON "muscle_groups"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_code_key" ON "equipment_types"("code");

-- CreateIndex
CREATE INDEX "equipment_types_isActive_idx" ON "equipment_types"("isActive");

-- AddForeignKey
ALTER TABLE "muscle_groups" ADD CONSTRAINT "muscle_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "muscle_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
