import type { WorkoutMetrics } from '@gym-companion/shared';

import {
  formatWorkoutDistance,
  formatWorkoutElapsedSeconds,
  formatWorkoutExerciseDuration,
  formatWorkoutReps,
  formatWorkoutVolume,
  getWorkoutMetricsDisplayFlags,
} from '../lib/workout-metrics-format';

type WorkoutMetricsSummaryProps = {
  metrics: WorkoutMetrics;
};

export function WorkoutMetricsSummary({ metrics }: WorkoutMetricsSummaryProps) {
  const flags = getWorkoutMetricsDisplayFlags(metrics);
  const lines: string[] = [
    `${metrics.performedExerciseCount} exercice${metrics.performedExerciseCount === 1 ? '' : 's'} réalisé${metrics.performedExerciseCount === 1 ? '' : 's'}`,
    `${metrics.sets.performed} série${metrics.sets.performed === 1 ? '' : 's'} réalisée${metrics.sets.performed === 1 ? '' : 's'}`,
  ];

  if (flags.showReps) {
    lines.push(formatWorkoutReps(metrics.performance.totalReps));
  }
  if (flags.showVolume) {
    lines.push(
      `${formatWorkoutVolume(metrics.performance.workingExternalVolumeKg)} de volume de travail`,
    );
  }
  if (flags.showExerciseDuration) {
    lines.push(
      `Durée d’exercices enregistrée : ${formatWorkoutExerciseDuration(metrics.performance.totalDurationSeconds)}`,
    );
  }
  if (flags.showDistance) {
    lines.push(
      `Distance : ${formatWorkoutDistance(metrics.performance.totalDistanceMeters)}`,
    );
  }
  if (flags.showElapsed && metrics.elapsedDurationSeconds != null) {
    lines.push(
      `Durée écoulée : ${formatWorkoutElapsedSeconds(metrics.elapsedDurationSeconds)}`,
    );
  }

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
      aria-labelledby="workout-metrics-heading"
    >
      <h2
        id="workout-metrics-heading"
        className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase"
      >
        Résumé de la séance
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[var(--foreground)]">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {flags.showVolume ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Volume de travail : somme des charges externes × répétitions
          enregistrées (échauffements exclus).
        </p>
      ) : null}
    </section>
  );
}
