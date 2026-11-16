/**
 * Enums d’exercice et de série partagés par plusieurs schémas (catalogue, partage, import).
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

export const workoutSetTypeSchema = z.enum([
  'WARMUP',
  'WORKING',
  'BACKOFF',
  'DROP_SET',
  'AMRAP',
  'FAILURE_OPTIONAL',
  'INTERVAL_WORK',
  'INTERVAL_RECOVERY',
]);

/** Séries de fractionné cardio (effort / récupération). */
export const INTERVAL_SET_TYPES = ['INTERVAL_WORK', 'INTERVAL_RECOVERY'] as const;

export function isIntervalSetType(setType: string): boolean {
  return (INTERVAL_SET_TYPES as readonly string[]).includes(setType);
}
