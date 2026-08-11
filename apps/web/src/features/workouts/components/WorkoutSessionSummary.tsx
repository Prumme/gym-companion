import type { WorkoutMetrics } from '@gym-companion/shared';

import { cn } from '@/lib/utils';

import {
  formatWorkoutDistance,
  formatWorkoutElapsedSeconds,
  formatWorkoutReps,
  formatWorkoutVolume,
  getWorkoutMetricsDisplayFlags,
} from '../lib/workout-metrics-format';
import type { WorkoutProgressSummary } from '../lib/workout-progress';

type WorkoutSessionSummaryProps = {
  progress: WorkoutProgressSummary;
  metrics: WorkoutMetrics | null;
  elapsedLabel: string | null;
};

export function WorkoutSessionSummary({
  progress,
  metrics,
  elapsedLabel,
}: WorkoutSessionSummaryProps) {
  const percent =
    progress.totalSets === 0
      ? 0
      : Math.round((progress.recordedSets / progress.totalSets) * 100);

  const chips: string[] = [
    `${progress.totalExercises} exercice${progress.totalExercises === 1 ? '' : 's'}`,
    `${progress.totalSets} série${progress.totalSets === 1 ? '' : 's'}`,
  ];

  if (progress.completedSets > 0) {
    chips.push(
      `${progress.completedSets} terminée${progress.completedSets === 1 ? '' : 's'}`,
    );
  }
  if (progress.partialSets > 0) {
    chips.push(
      `${progress.partialSets} partielle${progress.partialSets === 1 ? '' : 's'}`,
    );
  }
  if (progress.failedSets > 0) {
    chips.push(
      `${progress.failedSets} échouée${progress.failedSets === 1 ? '' : 's'}`,
    );
  }
  if (progress.skippedSets > 0) {
    chips.push(
      `${progress.skippedSets} ignorée${progress.skippedSets === 1 ? '' : 's'}`,
    );
  }

  if (metrics) {
    const flags = getWorkoutMetricsDisplayFlags(metrics);
    if (flags.showReps) {
      chips.push(formatWorkoutReps(metrics.performance.totalReps));
    }
    if (flags.showVolume) {
      chips.push(formatWorkoutVolume(metrics.performance.workingExternalVolumeKg));
    }
    if (flags.showDistance) {
      chips.push(
        formatWorkoutDistance(metrics.performance.totalDistanceMeters),
      );
    }
    if (flags.showElapsed && metrics.elapsedDurationSeconds != null) {
      chips.push(
        formatWorkoutElapsedSeconds(metrics.elapsedDurationSeconds),
      );
    }
  } else if (elapsedLabel) {
    chips.push(elapsedLabel);
  }

  return (
    <section
      aria-labelledby="session-summary-heading"
      className="flex flex-col gap-3 border-b border-[var(--border)] pb-5"
    >
      <h2 id="session-summary-heading" className="sr-only">
        Synthèse de la séance
      </h2>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--foreground)]">
        {chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <p className="font-medium text-[var(--foreground)]">
            {percent >= 100 ? 'Séance complétée' : 'Progression'}
          </p>
          <p className="tabular-nums text-[var(--muted)]">{percent} %</p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression ${percent} pour cent`}
        >
          <div
            className={cn(
              'h-full rounded-full bg-[var(--primary)] transition-[width]',
            )}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {progress.recordedSets} / {progress.totalSets} séries traitées
        </p>
      </div>
    </section>
  );
}
