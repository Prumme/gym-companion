import type { ExerciseDetail } from '@gym-companion/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { UpdateExercisePreferenceInput } from '@gym-companion/validation';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  useResetExercisePreferenceMutation,
  useUpdateExercisePreferenceMutation,
} from '../hooks/use-exercise-preference-mutations';
import {
  hasCustomExercisePreference,
  preferenceToUpdateInput,
} from '../lib/exercise-preference';
import { ExerciseFavoriteButton } from './ExerciseFavoriteButton';
import { ExercisePreferenceForm } from './ExercisePreferenceForm';

type ExercisePreferenceSectionProps = {
  exercise: ExerciseDetail;
};

export function ExercisePreferenceSection({ exercise }: ExercisePreferenceSectionProps) {
  const preference = exercise.userPreference;
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const updateMutation = useUpdateExercisePreferenceMutation();
  const resetMutation = useResetExercisePreferenceMutation();

  const preferenceBusy =
    (updateMutation.isPending &&
      updateMutation.variables?.exerciseId === exercise.id) ||
    (resetMutation.isPending && resetMutation.variables === exercise.id);

  const custom = hasCustomExercisePreference(preference);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }
    const node = dialogRef.current;
    const focusable = node?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setEditorOpen(false);
        setSubmitError(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editorOpen]);

  async function handleToggleFavorite() {
    setStatusMessage(null);
    setSubmitError(null);
    const nextFavorite = !preference.isFavorite;
    try {
      await updateMutation.mutateAsync({
        exerciseId: exercise.id,
        input: preferenceToUpdateInput(preference, { isFavorite: nextFavorite }),
        optimisticPreference: { ...preference, isFavorite: nextFavorite },
      });
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Impossible de modifier ce favori. Réessaie.'),
      );
    }
  }

  async function handleSave(payload: UpdateExercisePreferenceInput) {
    setSubmitError(null);
    setStatusMessage(null);
    try {
      const optimisticPreference = {
        isFavorite: payload.isFavorite,
        isExcludedFromSuggestions: payload.isExcludedFromSuggestions,
        preferredEquipmentType:
          payload.preferredEquipmentTypeId === null
            ? null
            : (exercise.compatibleEquipmentTypes.find(
                (item) => item.equipmentType.id === payload.preferredEquipmentTypeId,
              )?.equipmentType ??
              preference.preferredEquipmentType),
        restSecondsOverride: payload.restSecondsOverride,
      };
      await updateMutation.mutateAsync({
        exerciseId: exercise.id,
        input: payload,
        optimisticPreference,
      });
      setEditorOpen(false);
      setStatusMessage('Préférences enregistrées.');
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible d’enregistrer les préférences. Réessaie.',
        ),
      );
    }
  }

  async function handleReset() {
    setSubmitError(null);
    setStatusMessage(null);
    try {
      await resetMutation.mutateAsync(exercise.id);
      setConfirmReset(false);
      setEditorOpen(false);
      setStatusMessage('Préférences réinitialisées.');
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible de réinitialiser les préférences. Réessaie.',
        ),
      );
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Mes préférences
        </h2>
        <ExerciseFavoriteButton
          preference={preference}
          pending={preferenceBusy}
          onToggle={() => {
            void handleToggleFavorite();
          }}
        />
      </div>

      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Favori</dt>
          <dd className="font-medium">{preference.isFavorite ? 'Oui' : 'Non'}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Suggestions automatiques</dt>
          <dd className="font-medium">
            {preference.isExcludedFromSuggestions ? 'Exclu' : 'Autorisé'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Équipement préféré</dt>
          <dd className="font-medium">
            {preference.preferredEquipmentType?.name ?? 'Aucun'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Repos personnel</dt>
          <dd className="font-medium">
            {preference.restSecondsOverride != null
              ? `${preference.restSecondsOverride} secondes`
              : 'Valeur par défaut'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={preferenceBusy}
          onClick={() => {
            setSubmitError(null);
            setEditorOpen(true);
          }}
        >
          Modifier mes préférences
        </Button>
        {custom ? (
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            disabled={preferenceBusy}
            onClick={() => setConfirmReset(true)}
          >
            Réinitialiser mes préférences
          </Button>
        ) : null}
      </div>

      {statusMessage ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {statusMessage}
        </p>
      ) : null}
      {submitError && !editorOpen ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {submitError}
        </p>
      ) : null}

      {editorOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:bg-black/30"
          role="presentation"
          onClick={() => {
            if (!preferenceBusy) {
              setEditorOpen(false);
              setSubmitError(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-[var(--card)] p-4 pb-8 shadow-xl md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius)] md:pb-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={titleId} className="mb-4 text-lg font-semibold">
              Modifier mes préférences
            </h3>
            <ExercisePreferenceForm
              preference={preference}
              compatibleEquipment={exercise.compatibleEquipmentTypes}
              pending={preferenceBusy}
              submitError={submitError}
              onCancel={() => {
                setEditorOpen(false);
                setSubmitError(null);
              }}
              onSubmit={handleSave}
            />
          </div>
        </div>
      ) : null}

      {confirmReset ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
          role="presentation"
          onClick={() => {
            if (!preferenceBusy) {
              setConfirmReset(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-labelledby="reset-pref-title"
            aria-describedby="reset-pref-desc"
            className="w-full max-w-md rounded-[var(--radius)] bg-[var(--card)] p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="reset-pref-title" className="text-lg font-semibold">
              Réinitialiser tes préférences pour cet exercice ?
            </h3>
            <p id="reset-pref-desc" className="mt-2 text-sm text-[var(--muted)]">
              Le favori sera retiré, l’équipement préféré et le repos personnel seront
              supprimés. L’exercice ne sera pas supprimé.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                disabled={preferenceBusy}
                onClick={() => {
                  void handleReset();
                }}
              >
                {preferenceBusy ? 'Réinitialisation…' : 'Réinitialiser'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={preferenceBusy}
                onClick={() => setConfirmReset(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
