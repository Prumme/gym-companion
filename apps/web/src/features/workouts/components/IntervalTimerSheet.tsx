import type {
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
} from '@gym-companion/shared';
import { formatIntervalDuration, summarizeIntervalSets } from '@gym-companion/validation';
import { Pause, Play, SkipForward, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ViewportPortal } from '@/components/ui/viewport-portal';
import { getApiErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils';

import { useUpdateWorkoutSetMutation } from '../hooks/use-workout-mutations';
import { playIntervalPhaseCue, unlockIntervalAudio } from '../lib/interval-cues';
import {
  INTERVAL_PHASE_LABELS,
  buildIntervalPhases,
  currentIntervalPhase,
  formatClock,
  intervalRoundProgress,
  nextIntervalPhase,
  remainingPhaseSeconds,
  type CompletedIntervalPhase,
  type IntervalPhase,
  type IntervalPhaseKind,
} from '../lib/interval-timer';
import { useIntervalTimerStore } from '../stores/interval-timer-store';

type IntervalTimerSheetProps = {
  open: boolean;
  session: WorkoutSessionDetail;
  exercise: WorkoutSessionExerciseDetail;
  onClose: () => void;
  onVersionConflict: () => void;
};

/** Couleur d’accent par phase — toujours doublée du libellé texte. */
const PHASE_ACCENT: Record<IntervalPhaseKind, string> = {
  WARMUP: 'bg-sky-600',
  WORK: 'bg-orange-600',
  RECOVERY: 'bg-emerald-600',
  COOLDOWN: 'bg-sky-600',
};

function formatTargets(phase: Pick<IntervalPhase, 'speedKmh' | 'inclinePercent'>): string | null {
  const parts: string[] = [];
  const number = new Intl.NumberFormat('fr-FR');
  if (phase.speedKmh != null) parts.push(`${number.format(phase.speedKmh)} km/h`);
  if (phase.inclinePercent != null) parts.push(`inclinaison ${number.format(phase.inclinePercent)} %`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function errorCode(error: unknown): string | null {
  return error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null;
}

/**
 * Chrono guidé du fractionné : enchaîne effort / récupération, signale chaque
 * changement de phase, puis demande confirmation avant d’enregistrer les séries.
 */
export function IntervalTimerSheet({
  open,
  session,
  exercise,
  onClose,
  onVersionConflict,
}: IntervalTimerSheetProps) {
  const titleId = useId();
  const timer = useIntervalTimerStore((state) => state.timer);
  const store = useIntervalTimerStore.getState;
  const updateSet = useUpdateWorkoutSetMutation(session.id);
  const [now, setNow] = useState(() => Date.now());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lastPhaseIndex = useRef<number | null>(null);

  const ownTimer =
    timer &&
    timer.workoutSessionId === session.id &&
    timer.sessionExerciseId === exercise.id
      ? timer
      : null;
  const running = ownTimer != null && !ownTimer.finished;

  useEffect(() => {
    if (!open || !running) return;
    const id = window.setInterval(() => {
      store().tick();
      setNow(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [open, running, store]);

  useEffect(() => {
    if (!ownTimer) {
      lastPhaseIndex.current = null;
      return;
    }
    const previous = lastPhaseIndex.current;
    lastPhaseIndex.current = ownTimer.phaseIndex;
    if (previous == null || previous === ownTimer.phaseIndex) return;
    if (ownTimer.finished) playIntervalPhaseCue('END');
    else playIntervalPhaseCue(currentIntervalPhase(ownTimer)?.kind === 'WORK' ? 'WORK' : 'REST');
  }, [ownTimer]);

  if (!open) return null;

  const pendingPhases = buildIntervalPhases(exercise.sets);
  const summary = summarizeIntervalSets(exercise.sets);
  const otherTimerActive = timer != null && ownTimer == null && !timer.finished;

  function handleStart() {
    unlockIntervalAudio();
    setSaveError(null);
    store().start({
      workoutSessionId: session.id,
      sessionExerciseId: exercise.id,
      phases: pendingPhases,
    });
    playIntervalPhaseCue(pendingPhases[0]?.kind === 'WORK' ? 'WORK' : 'REST');
  }

  async function handleSave(completed: CompletedIntervalPhase[]) {
    setSaving(true);
    setSaveError(null);
    let version = session.version;
    const recorded: CompletedIntervalPhase[] = [];
    try {
      for (const phase of completed) {
        const response = await updateSet.mutateAsync({
          sessionExerciseId: exercise.id,
          workoutSetId: phase.setId,
          input: {
            status: 'COMPLETED',
            actualWeightKg: null,
            actualReps: null,
            actualDurationSeconds: phase.durationSeconds,
            actualDistanceMeters: null,
            actualRir: null,
            actualRpe: null,
            reachedFailure: false,
            notes: null,
            expectedVersion: version,
          },
        });
        version = response.result.workoutSessionVersion;
        recorded.push(phase);
      }
      store().clear();
      onClose();
    } catch (error) {
      store().markRecorded(recorded);
      if (errorCode(error) === 'WORKOUT_VERSION_CONFLICT') onVersionConflict();
      setSaveError(
        getApiErrorMessage(
          error,
          'Impossible d’enregistrer toutes les séries. Réessaie : celles déjà enregistrées ne seront pas dupliquées.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    store().clear();
    onClose();
  }

  const phase = ownTimer ? currentIntervalPhase(ownTimer) : null;
  const next = ownTimer ? nextIntervalPhase(ownTimer) : null;
  const paused = ownTimer?.pausedAtMs != null;
  const remaining = ownTimer ? remainingPhaseSeconds(ownTimer, now) : 0;
  const rounds = ownTimer ? intervalRoundProgress(ownTimer) : null;
  const progress = phase ? 1 - remaining / phase.durationSeconds : 0;

  return (
    <ViewportPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] text-[var(--foreground)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              Fractionné
            </h2>
            <p className="truncate text-sm text-[var(--muted)]">{exercise.exerciseName}</p>
          </div>
          {!running ? (
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Fermer
            </Button>
          ) : null}
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
          {!ownTimer ? (
            <>
              <p className="text-base font-medium">{summary ?? 'Fractionné'}</p>
              <p className="text-sm text-[var(--muted)]">
                {pendingPhases.length} phase{pendingPhases.length === 1 ? '' : 's'} à enchaîner
                {' · '}
                {formatIntervalDuration(
                  pendingPhases.reduce((sum, item) => sum + item.durationSeconds, 0),
                )}
                . Le téléphone vibre et bipe à chaque changement de phase.
              </p>
              {otherTimerActive ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  Un autre fractionné est en cours. Termine-le avant d’en lancer un nouveau.
                </p>
              ) : null}
            </>
          ) : running && phase ? (
            <section aria-live="polite" className="flex flex-1 flex-col items-center gap-4 text-center">
              <div className={cn('h-2 w-full rounded-full', PHASE_ACCENT[phase.kind])} aria-hidden="true" />
              <p className="text-3xl font-bold tracking-tight uppercase">
                {INTERVAL_PHASE_LABELS[phase.kind]}
              </p>
              {rounds && rounds.total > 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Round {Math.max(rounds.current, 1)} / {rounds.total}
                </p>
              ) : null}
              <p
                className="text-7xl font-bold tabular-nums"
                aria-label={`${remaining} secondes restantes`}
              >
                {formatClock(remaining)}
              </p>
              {formatTargets(phase) ? (
                <p className="text-2xl font-semibold">{formatTargets(phase)}</p>
              ) : null}
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]"
                role="progressbar"
                aria-label="Progression de la phase"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div
                  className="h-full bg-[var(--foreground)] transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              {paused ? (
                <p className="text-sm font-medium" role="status">
                  En pause
                </p>
              ) : null}
              <p className="text-sm text-[var(--muted)]">
                {next
                  ? `Ensuite : ${INTERVAL_PHASE_LABELS[next.kind]} ${formatIntervalDuration(next.durationSeconds)}${
                      formatTargets(next) ? ` · ${formatTargets(next)}` : ''
                    }`
                  : 'Dernière phase'}
              </p>
            </section>
          ) : (
            <section className="flex flex-col gap-3">
              <p className="text-base font-semibold">Fractionné terminé</p>
              {ownTimer.completed.length > 0 ? (
                <>
                  <p className="text-sm text-[var(--muted)]">
                    Ces séries vont être enregistrées comme faites :
                  </p>
                  <ul className="flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {ownTimer.completed.map((item) => (
                      <li key={item.setId} className="flex justify-between py-2 text-sm tabular-nums">
                        <span>{INTERVAL_PHASE_LABELS[item.kind]}</span>
                        <span>{formatClock(item.durationSeconds)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucune phase à enregistrer.</p>
              )}
              {saveError ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {saveError}
                </p>
              ) : null}
            </section>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {!ownTimer ? (
            <Button
              type="button"
              className="min-h-14 w-full text-base"
              disabled={pendingPhases.length === 0 || otherTimerActive}
              onClick={handleStart}
            >
              <Play className="size-5" aria-hidden="true" />
              Démarrer
            </Button>
          ) : running ? (
            <>
              <Button
                type="button"
                className="min-h-14 w-full text-base"
                onClick={() => (paused ? store().resume() : store().pause())}
              >
                {paused ? (
                  <Play className="size-5" aria-hidden="true" />
                ) : (
                  <Pause className="size-5" aria-hidden="true" />
                )}
                {paused ? 'Reprendre' : 'Pause'}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" className="min-h-12" onClick={() => store().skip()}>
                  <SkipForward className="size-4" aria-hidden="true" />
                  Phase suivante
                </Button>
                <Button type="button" variant="secondary" className="min-h-12" onClick={() => store().stop()}>
                  <Square className="size-4" aria-hidden="true" />
                  Arrêter
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                className="min-h-14 w-full text-base"
                disabled={saving || ownTimer.completed.length === 0}
                onClick={() => void handleSave(ownTimer.completed)}
              >
                {saving
                  ? 'Enregistrement…'
                  : `Enregistrer ${ownTimer.completed.length} série${ownTimer.completed.length === 1 ? '' : 's'}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full"
                disabled={saving}
                onClick={handleDiscard}
              >
                Ne rien enregistrer
              </Button>
            </>
          )}
        </footer>
      </div>
    </ViewportPortal>
  );
}
