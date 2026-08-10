import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

const STATUS_LABELS: Record<SharedWorkoutRoomStatus, string> = {
  LOBBY: 'En préparation',
  ACTIVE: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export function getSharedWorkoutRoomStatusLabel(
  status: SharedWorkoutRoomStatus,
): string {
  return STATUS_LABELS[status];
}
