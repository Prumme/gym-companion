import type { WorkoutSessionDetail } from '@gym-companion/shared';

import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { computeWorkoutProgress } from '../lib/workout-progress';

function formatStartedAtTime(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type ActiveWorkoutResumeCardProps = {
  session: WorkoutSessionDetail;
};

export function ActiveWorkoutResumeCard({
  session,
}: ActiveWorkoutResumeCardProps) {
  const progress = computeWorkoutProgress(session);
  const startedLabel = formatStartedAtTime(session.startedAt, session.timezone);
  const inProgress =
    session.status === 'ACTIVE' || session.status === 'PAUSED';

  if (!inProgress) {
    return null;
  }

  return (
    <Card>
      <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        {session.status === 'PAUSED' ? 'Séance en pause' : 'Séance en cours'}
      </p>
      <h2 className="mt-1 text-lg font-semibold">{session.name}</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Démarrée à {startedLabel}
      </p>
      <p className="mt-1 text-sm tabular-nums text-[var(--muted-foreground)]">
        {progress.recordedSets} / {progress.totalSets} séries
      </p>
      <ButtonLink to="/workouts/active" className="mt-3 inline-flex">
        Reprendre la séance
      </ButtonLink>
    </Card>
  );
}
