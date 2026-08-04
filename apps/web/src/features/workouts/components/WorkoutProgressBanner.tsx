import type { WorkoutProgressSummary } from '../lib/workout-progress';

type WorkoutProgressBannerProps = {
  progress: WorkoutProgressSummary;
};

export function WorkoutProgressBanner({ progress }: WorkoutProgressBannerProps) {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
      role="status"
    >
      <p>
        {progress.recordedSets} série{progress.recordedSets === 1 ? '' : 's'}{' '}
        enregistrée{progress.recordedSets === 1 ? '' : 's'} sur{' '}
        {progress.totalSets}
      </p>
      <p className="text-[var(--muted)]">
        {progress.treatedExercises} exercice
        {progress.treatedExercises === 1 ? '' : 's'} traité
        {progress.treatedExercises === 1 ? '' : 's'} sur{' '}
        {progress.totalExercises}
      </p>
    </div>
  );
}
