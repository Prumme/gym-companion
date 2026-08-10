/**
 * Shared 5.6 — coordination d’équipement logique (file FIFO).
 * Limite : EquipmentType = ressource logique, pas inventaire physique.
 * bodyweight n’est pas coordonnable (pas d’exclusivité pertinente).
 */

import { z } from 'zod';

/** Codes EquipmentType exclus de la coordination V1. */
export const NON_COORDINATABLE_EQUIPMENT_CODES = new Set([
  'bodyweight',
]);

export function isCoordinatableEquipmentCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return !NON_COORDINATABLE_EQUIPMENT_CODES.has(code);
}

export const sharedWorkoutEquipmentQueueStatusSchema = z.enum([
  'WAITING',
  'USING',
  'RELEASED',
  'CANCELLED',
]);

export type SharedWorkoutEquipmentQueueStatusValue = z.infer<
  typeof sharedWorkoutEquipmentQueueStatusSchema
>;

export const sharedWorkoutEquipmentCommandActionSchema = z.enum([
  'REQUEST',
  'RELEASE',
  'CANCEL',
]);

export type SharedWorkoutEquipmentCommandAction = z.infer<
  typeof sharedWorkoutEquipmentCommandActionSchema
>;

/** Payload mutualisé request / release / cancel — pas d’equipmentId client. */
export const sharedWorkoutEquipmentCommandBodySchema = z
  .object({
    clientCommandId: z.string().uuid(),
  })
  .strict();

export type SharedWorkoutEquipmentCommandInput = z.infer<
  typeof sharedWorkoutEquipmentCommandBodySchema
>;

export function buildSharedWorkoutEquipmentCommandFingerprint(input: {
  action: SharedWorkoutEquipmentCommandAction;
  roomId: string;
}): string {
  return `${input.action}:${input.roomId}`;
}

/**
 * Position 1-based dans une file WAITING triée requestedAt ASC, id ASC.
 */
export function computeWaitingQueuePosition(
  entries: { id: string; requestedAt: Date | string }[],
  targetId: string,
): number | null {
  const sorted = entries
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.requestedAt).getTime();
      const tb = new Date(b.requestedAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
  const index = sorted.findIndex((entry) => entry.id === targetId);
  return index >= 0 ? index + 1 : null;
}
