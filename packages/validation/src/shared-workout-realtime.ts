/**
 * Shared 5.3 — événements Socket.IO client → serveur.
 * REST reste la source de vérité métier.
 */

import { z } from 'zod';

export const sharedWorkoutRoomSubscribeBodySchema = z
  .object({
    roomId: z.string().uuid(),
  })
  .strict();

export type SharedWorkoutRoomSubscribeBody = z.infer<
  typeof sharedWorkoutRoomSubscribeBodySchema
>;

export const sharedWorkoutRoomUnsubscribeBodySchema = z
  .object({
    roomId: z.string().uuid(),
  })
  .strict();

export type SharedWorkoutRoomUnsubscribeBody = z.infer<
  typeof sharedWorkoutRoomUnsubscribeBodySchema
>;
