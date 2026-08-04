/**
 * Durée écoulée (startedAt → completedAt / cancelledAt).
 * Ce n’est pas une durée d’effort nette (les pauses ne sont pas historisées).
 */
export function computeElapsedDurationMs(session: {
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  status: string;
}): number | null {
  const endIso =
    session.status === 'CANCELLED'
      ? session.cancelledAt
      : session.completedAt;
  if (!endIso) {
    return null;
  }
  const start = Date.parse(session.startedAt);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }
  return end - start;
}

export function formatElapsedDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  if (totalMinutes > 0) {
    return `${totalMinutes} min`;
  }
  const seconds = Math.max(1, Math.floor(ms / 1000));
  return `${seconds} s`;
}
