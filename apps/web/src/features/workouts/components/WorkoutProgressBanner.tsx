import type { WorkoutProgressSummary } from '../lib/workout-progress';

type WorkoutProgressBannerProps = {
  progress: WorkoutProgressSummary;
  /** Affiche aussi le compteur d’exercices (défaut true). */
  showExercises?: boolean;
  className?: string;
};

export function WorkoutProgressBanner({
  progress,
  showExercises = true,
  className,
}: WorkoutProgressBannerProps) {
  const percent =
    progress.totalSets === 0
      ? 0
      : Math.round((progress.recordedSets / progress.totalSets) * 100);

  return (
    <div
      className={className ?? 'flex flex-col gap-1.5'}
      role="status"
      aria-label={`Progression : ${progress.recordedSets} sur ${progress.totalSets} séries, ${percent} pour cent`}
    >
      <div className="flex items-baseline justify-between gap-3 text-xs tabular-nums text-[var(--muted)]">
        <span>
          {progress.recordedSets} / {progress.totalSets} séries
        </span>
        <span>{percent} %</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showExercises ? (
        <p className="text-xs text-[var(--muted)] tabular-nums">
          Exercice {progress.treatedExercises} / {progress.totalExercises} traité
          {progress.treatedExercises === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  );
}
