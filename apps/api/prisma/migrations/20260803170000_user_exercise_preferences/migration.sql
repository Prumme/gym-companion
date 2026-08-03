-- CreateTable
CREATE TABLE "user_exercise_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isExcludedFromSuggestions" BOOLEAN NOT NULL DEFAULT false,
    "preferredEquipmentTypeId" UUID,
    "restSecondsOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_exercise_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_exercise_preferences_userId_isFavorite_idx" ON "user_exercise_preferences"("userId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "user_exercise_preferences_userId_exerciseId_key" ON "user_exercise_preferences"("userId", "exerciseId");

-- AddForeignKey
ALTER TABLE "user_exercise_preferences" ADD CONSTRAINT "user_exercise_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exercise_preferences" ADD CONSTRAINT "user_exercise_preferences_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exercise_preferences" ADD CONSTRAINT "user_exercise_preferences_preferredEquipmentTypeId_fkey" FOREIGN KEY ("preferredEquipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
