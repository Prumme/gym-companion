-- Partage d’un exercice personnel : l’exercice est recréé chez l’importeur.
ALTER TYPE "TrainingShareKind" ADD VALUE IF NOT EXISTS 'EXERCISE';
