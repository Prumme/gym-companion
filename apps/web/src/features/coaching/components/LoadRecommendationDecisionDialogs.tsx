import type { LoadRecommendation } from '@gym-companion/shared';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';

import {
  formatLoadWeightKg,
  getLoadRecommendationActionLabel,
} from '../lib/load-recommendation-labels';

const adjustSchema = z.object({
  adjustedWeightKg: z.coerce
    .number({ invalid_type_error: 'Indique une charge valide.' })
    .positive('La charge doit être positive.')
    .max(10_000, 'Charge trop élevée.'),
  userNote: z.string().max(500).optional(),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

type LoadRecommendationDecisionDialogsProps = {
  recommendation: LoadRecommendation;
  workingSetCount: number;
  pending: boolean;
  error: string | null;
  mode: 'apply' | 'adjust' | 'ignore' | null;
  onClose: () => void;
  onAccept: (userNote: string | null) => void;
  onAdjust: (adjustedWeightKg: number, userNote: string | null) => void;
  onIgnore: (userNote: string | null) => void;
};

export function LoadRecommendationDecisionDialogs({
  recommendation,
  workingSetCount,
  pending,
  error,
  mode,
  onClose,
  onAccept,
  onAdjust,
  onIgnore,
}: LoadRecommendationDecisionDialogsProps) {
  const titleId = useId();
  const [note, setNote] = useState('');
  const form = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      adjustedWeightKg:
        recommendation.recommendation.suggestedWeightKg ??
        recommendation.currentTarget.weightKg ??
        undefined,
      userNote: '',
    },
  });

  if (!mode) {
    return null;
  }

  const current = recommendation.currentTarget.weightKg;
  const suggested = recommendation.recommendation.suggestedWeightKg;
  const noteOrNull = note.trim() ? note.trim() : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === 'apply' ? (
          <>
            <h3 id={titleId} className="text-lg font-semibold">
              {recommendation.action === 'HOLD'
                ? 'Conserver cette charge ?'
                : 'Appliquer cette recommandation ?'}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {recommendation.action === 'HOLD' && current != null
                ? `La charge restera à ${formatLoadWeightKg(current)}. Cette décision sera enregistrée dans l’historique du coaching.`
                : current != null && suggested != null
                  ? `Les ${workingSetCount} série${workingSetCount > 1 ? 's' : ''} de travail passeront de ${formatLoadWeightKg(current)} à ${formatLoadWeightKg(suggested)}.`
                  : getLoadRecommendationActionLabel(recommendation.action)}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Les séances déjà commencées ou terminées ne seront pas
              modifiées.
            </p>
            <label className="mt-3 block text-sm">
              Note facultative
              <textarea
                className="mt-1 min-h-20 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => onAccept(noteOrNull)}
              >
                {pending
                  ? 'En cours…'
                  : recommendation.action === 'HOLD' && current != null
                    ? `Conserver ${formatLoadWeightKg(current)}`
                    : suggested != null
                      ? `Appliquer ${formatLoadWeightKg(suggested)}`
                      : 'Appliquer'}
              </Button>
            </div>
          </>
        ) : null}

        {mode === 'adjust' ? (
          <form
            onSubmit={form.handleSubmit((values) => {
              onAdjust(
                values.adjustedWeightKg,
                values.userNote?.trim() ? values.userNote.trim() : null,
              );
            })}
          >
            <h3 id={titleId} className="text-lg font-semibold">
              Choisir une autre charge
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Actuelle :{' '}
              {current != null ? formatLoadWeightKg(current) : '—'}
              <br />
              Recommandée :{' '}
              {suggested != null ? formatLoadWeightKg(suggested) : '—'}
            </p>
            <label className="mt-3 block text-sm font-medium">
              Nouvelle charge (kg)
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0.001"
                className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-base"
                {...form.register('adjustedWeightKg')}
              />
            </label>
            {form.formState.errors.adjustedWeightKg ? (
              <p className="mt-1 text-sm text-[var(--danger)]">
                {form.formState.errors.adjustedWeightKg.message}
              </p>
            ) : null}
            <label className="mt-3 block text-sm">
              Note facultative
              <textarea
                className="mt-1 min-h-20 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
                {...form.register('userNote')}
                maxLength={500}
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'En cours…' : 'Enregistrer la charge'}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === 'ignore' ? (
          <>
            <h3 id={titleId} className="text-lg font-semibold">
              Ignorer cette recommandation ?
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              La décision sera conservée mais aucune cible ne sera modifiée.
            </p>
            <label className="mt-3 block text-sm">
              Note facultative
              <textarea
                className="mt-1 min-h-20 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => onIgnore(noteOrNull)}
              >
                {pending ? 'En cours…' : 'Ignorer'}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
