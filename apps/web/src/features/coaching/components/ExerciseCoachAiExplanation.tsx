import type {
  AiCoachExplanationFocus,
  ExerciseCoachExplanationResponse,
  ExerciseCoachSummary,
} from '@gym-companion/shared';
import { resolveAvailableAiCoachFocuses } from '@gym-companion/validation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { generateExerciseCoachExplanation } from '../api/coaching-api';

const FOCUS_LABELS: Record<AiCoachExplanationFocus, string> = {
  GENERAL: 'Vue générale',
  LOAD: 'Ma charge',
  PROGRESS: 'Ma progression',
  PLATEAU: 'Ma stagnation',
};

type ExerciseCoachAiExplanationProps = {
  exerciseId: string;
  summary: ExerciseCoachSummary;
  aiAvailable: boolean;
};

export function ExerciseCoachAiExplanation({
  exerciseId,
  summary,
  aiAvailable,
}: ExerciseCoachAiExplanationProps) {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [focus, setFocus] = useState<AiCoachExplanationFocus>('GENERAL');
  const [result, setResult] =
    useState<ExerciseCoachExplanationResponse | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const availableFocuses = resolveAvailableAiCoachFocuses({
    hasLoadRecommendation: summary.loadRecommendation != null,
    hasProgress: summary.progress != null && summary.progress.workoutCount > 0,
    hasPlateauSignal:
      summary.plateau != null &&
      (summary.plateau.status === 'WATCH' ||
        summary.plateau.status === 'PLATEAU' ||
        summary.plateau.status === 'REVIEW'),
  });

  useEffect(() => {
    if (!availableFocuses.includes(focus)) {
      setFocus('GENERAL');
    }
  }, [availableFocuses, focus]);

  const mutation = useMutation({
    mutationFn: () =>
      generateExerciseCoachExplanation(exerciseId, { focus }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const isStale =
    result != null &&
    result.meta.coachSummaryFingerprint !== summary.coachSummaryFingerprint;

  if (!aiAvailable) {
    return (
      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <p className="text-sm text-[var(--muted)]">
          Explications IA non activées.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-4 border-t border-dashed border-[var(--border)] pt-3"
      aria-label="Explication IA du Coach"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        Explication générée par IA
      </p>

      <fieldset className="mt-3">
        <legend className="sr-only">Focus de l’explication</legend>
        <div className="flex flex-wrap gap-2">
          {availableFocuses.map((value) => (
            <button
              key={value}
              type="button"
              className={`min-h-10 rounded-[var(--radius)] border px-3 text-sm ${
                focus === value
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]'
              }`}
              aria-pressed={focus === value}
              onClick={() => setFocus(value)}
              disabled={mutation.isPending}
            >
              {FOCUS_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      {offline ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">
          Une connexion est nécessaire pour générer une explication.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={offline || mutation.isPending}
          aria-busy={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? 'Le Coach prépare une explication…'
            : result
              ? 'Actualiser l’explication'
              : 'Obtenir une explication'}
        </Button>
      </div>

      {mutation.isError ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {getApiErrorMessage(
            mutation.error,
            'L’explication IA n’est pas disponible pour le moment.',
          )}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-2">
          {isStale ? (
            <p className="text-sm text-[var(--muted)]" role="status">
              Cette explication correspond à des données précédentes.
            </p>
          ) : null}
          <h3 className="text-base font-semibold">{result.explanation.title}</h3>
          <p className="text-sm leading-relaxed">{result.explanation.summary}</p>
          {result.explanation.keyPoints.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.explanation.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
          {result.explanation.caution ? (
            <p className="text-sm text-[var(--muted)]" role="note">
              {result.explanation.caution}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
