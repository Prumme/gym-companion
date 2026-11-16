/**
 * Enums d’exercice partagés par plusieurs schémas (catalogue, partage, import).
 * Module séparé pour éviter les imports circulaires avec `index.ts`.
 */

import { z } from 'zod';

export const exerciseSourceSchema = z.enum(['SYSTEM', 'USER']);

export const exerciseMeasurementTypeSchema = z.enum([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

export const exerciseCategorySchema = z.enum(['STRENGTH', 'CARDIO']);

export const cardioTypeSchema = z.enum([
  'RUNNING',
  'WALKING',
  'TREADMILL',
  'CYCLING',
  'ROWING',
  'STAIR_CLIMBING',
  'ELLIPTICAL',
  'OTHER',
]);
