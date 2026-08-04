-- Index composite pour la liste historique (filtres statut + tri localDate).
CREATE INDEX "workout_sessions_ownerUserId_status_localDate_idx" ON "workout_sessions"("ownerUserId", "status", "localDate");
