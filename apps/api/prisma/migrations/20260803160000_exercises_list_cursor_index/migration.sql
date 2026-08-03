-- Index composite pour le tri stable et la pagination cursor (normalizedName ASC, id ASC).
-- Remplace l'index simple sur normalizedName (préfixe gauche du composite).
DROP INDEX IF EXISTS "exercises_normalizedName_idx";

CREATE INDEX "exercises_normalizedName_id_idx" ON "exercises"("normalizedName", "id");
