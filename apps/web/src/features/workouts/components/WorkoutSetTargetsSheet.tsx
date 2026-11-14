import type { ExerciseMeasurementType, WorkoutSessionSetDetail } from '@gym-companion/shared';
import {
  getEditableSessionSetTargets,
  type WorkoutSessionSetTargetsPatch,
} from '@gym-companion/validation';
import { X } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { ViewportPortal } from '@/components/ui/viewport-portal';

import {
  buildSetTargetsPatch,
  toSetTargetsFormValues,
  type SetTargetsFormValues,
} from '../lib/set-targets-form';
import { getWorkoutSetTypeLabelSafe } from '../lib/workout-labels';

type WorkoutSetTargetsSheetProps = {
  set: WorkoutSessionSetDetail;
  measurementType: ExerciseMeasurementType;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (patch: WorkoutSessionSetTargetsPatch) => void;
};

const fieldClass =
  'min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-base tabular-nums';

/** Bottom sheet « Modifier la cible » d’une série PENDING (séance uniquement, pas le programme). */
export function WorkoutSetTargetsSheet({
  set,
  measurementType,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: WorkoutSetTargetsSheetProps) {
  const titleId = useId();
  const hintId = useId();
  const errorId = useId();
  const weightId = useId();
  const repMinId = useId();
  const repMaxId = useId();
  const restId = useId();
  const editable = getEditableSessionSetTargets(measurementType);
  const [values, setValues] = useState<SetTargetsFormValues>(() => toSetTargetsFormValues(set));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, pending]);

  const shownError = localError ?? errorMessage;
  const update = (key: keyof SetTargetsFormValues) => (event: { target: { value: string } }) => {
    setLocalError(null);
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = buildSetTargetsPatch(set, measurementType, values);
    if (!result.ok) {
      setLocalError(result.message);
      return;
    }
    onSubmit(result.patch);
  }

  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
        role="presentation"
        onClick={() => {
          if (!pending) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={hintId}
          className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1rem] border border-[var(--border)] bg-[var(--card)] shadow-lg sm:rounded-[var(--radius)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-3">
            <div className="min-w-0">
              <h3 id={titleId} className="text-lg font-semibold">
                Modifier la cible
              </h3>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Série {set.position + 1} · {getWorkoutSetTypeLabelSafe(set.setType)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="size-11 min-h-11 px-0"
              onClick={onClose}
              disabled={pending}
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onSubmit={handleSubmit}
            noValidate
          >
            <p id={hintId} className="text-sm text-[var(--muted)]">
              Change uniquement cette séance : le programme reste tel quel.
            </p>

            {editable.weight ? (
              <label className="flex flex-col gap-1 text-sm" htmlFor={weightId}>
                <span className="font-medium">Charge cible (kg)</span>
                <input
                  id={weightId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={fieldClass}
                  value={values.weightKg}
                  onChange={update('weightKg')}
                  aria-describedby={shownError ? errorId : undefined}
                />
              </label>
            ) : null}

            {editable.reps ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm" htmlFor={repMinId}>
                  <span className="font-medium">Reps min</span>
                  <input
                    id={repMinId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={fieldClass}
                    value={values.repMin}
                    onChange={update('repMin')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm" htmlFor={repMaxId}>
                  <span className="font-medium">Reps max</span>
                  <input
                    id={repMaxId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={fieldClass}
                    value={values.repMax}
                    onChange={update('repMax')}
                  />
                </label>
              </div>
            ) : null}

            <label className="flex flex-col gap-1 text-sm" htmlFor={restId}>
              <span className="font-medium">Repos après la série (s)</span>
              <input
                id={restId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={fieldClass}
                value={values.restSeconds}
                onChange={update('restSeconds')}
              />
            </label>

            {shownError ? (
              <p id={errorId} className="text-sm text-[var(--danger)]" role="alert">
                {shownError}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer la cible'}
            </Button>
          </form>
        </div>
      </div>
    </ViewportPortal>
  );
}
