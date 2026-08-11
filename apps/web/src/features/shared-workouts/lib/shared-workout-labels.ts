import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

import { getWorkoutStatusLabel } from '@/features/workouts/lib/workout-labels';

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

export function memberWorkoutLabel(
  status: string,
  workoutName: string | null,
): string {
  if (status === 'NOT_STARTED') return 'Pas démarrée';
  const name = workoutName ?? 'Séance';
  return `${name} — ${getWorkoutStatusLabel(status)}`;
}

export function formatSharedSetProgress(
  processed: number,
  total: number,
): string {
  return `${processed} / ${total} séries`;
}

export function formatSharedExerciseProgress(
  processed: number,
  total: number,
): string {
  return `${processed} / ${total} exercices`;
}
