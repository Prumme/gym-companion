import { zodResolver } from '@hookform/resolvers/zod';
import {
  INTERVAL_PRESETS,
  buildIntervalTemplateSets,
  formatIntervalDuration,
  summarizeIntervalSets,
  type IntervalPlan,
} from '@gym-companion/validation';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  applyIntervalPreset,
  defaultIntervalBuilderValues,
  intervalBuilderFormSchema,
  intervalBuilderValuesToPlan,
  type IntervalBuilderFormValues,
} from '../lib/interval-builder-form';

type IntervalBuilderSheetProps = {
  open: boolean;
  exerciseName: string;
  /** Nombre de séries actuelles, remplacées par le fractionné. */
  existingSetCount: number;
  pending?: boolean;
  submitError?: string | null;
  onSubmit: (plan: IntervalPlan) => Promise<void> | void;
  onCancel: () => void;
};

const fieldClass =
  'min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-base tabular-nums outline-none focus:border-[var(--primary)]';

type NumberFieldProps = {
  id: string;
  label: string;
  error?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal';
  registration: ReturnType<ReturnType<typeof useForm<IntervalBuilderFormValues>>['register']>;
};

function NumberField({
  id,
  label,
  error,
  placeholder,
  inputMode = 'numeric',
  registration,
}: NumberFieldProps) {
  const errorId = `${id}-error`;
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span className="font-medium">{label}</span>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        className={fieldClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...registration}
      />
      {error ? (
        <span id={errorId} className="text-[var(--danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function totalDurationLabel(plan: IntervalPlan): string {
  const total = buildIntervalTemplateSets(plan).reduce(
    (sum, set) => sum + set.targetDurationSeconds,
    0,
  );
  return formatIntervalDuration(total);
}

/** Bottom sheet « Créer un fractionné » : génère les séries effort / récup. */
export function IntervalBuilderSheet({
  open,
  exerciseName,
  existingSetCount,
  pending = false,
  submitError = null,
  onSubmit,
  onCancel,
}: IntervalBuilderSheetProps) {
  const titleId = useId();
  const form = useForm<IntervalBuilderFormValues>({
    resolver: zodResolver(intervalBuilderFormSchema),
    defaultValues: defaultIntervalBuilderValues(),
    mode: 'onSubmit',
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(defaultIntervalBuilderValues());
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pending, onCancel]);

  const values = watch();
  if (!open) return null;

  const preview = intervalBuilderValuesToPlan(values);
  const activePreset = INTERVAL_PRESETS.find(
    (preset) =>
      values.workSeconds === String(preset.workSeconds) &&
      values.recoverySeconds === String(preset.recoverySeconds),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1rem] border border-[var(--border)] bg-[var(--card)] shadow-lg sm:rounded-[var(--radius)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--border)] px-4 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
          <h3 id={titleId} className="text-lg font-semibold">
            Créer un fractionné
          </h3>
          <p className="text-sm text-[var(--muted)]">{exerciseName}</p>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={handleSubmit(async (submitted) => {
            const result = intervalBuilderValuesToPlan(submitted);
            if (result.ok) await onSubmit(result.plan);
          })}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Préréglage</legend>
              <div className="flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map((preset) => {
                  const selected = activePreset?.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        'min-h-11 rounded-full border px-4 text-sm font-medium tabular-nums',
                        selected
                          ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                          : 'border-[var(--border)] text-[var(--foreground)]',
                      )}
                      onClick={() => reset(applyIntervalPreset(getValues(), preset))}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <NumberField
              id="interval-rounds"
              label="Répétitions"
              error={errors.rounds?.message}
              registration={register('rounds')}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="interval-work-seconds"
                label="Effort (s)"
                error={errors.workSeconds?.message}
                registration={register('workSeconds')}
              />
              <NumberField
                id="interval-work-speed"
                label="Vitesse effort (km/h)"
                inputMode="decimal"
                placeholder="Facultatif"
                error={errors.workSpeedKmh?.message}
                registration={register('workSpeedKmh')}
              />
              <NumberField
                id="interval-recovery-seconds"
                label="Récup (s)"
                error={errors.recoverySeconds?.message}
                registration={register('recoverySeconds')}
              />
              <NumberField
                id="interval-recovery-speed"
                label="Vitesse récup (km/h)"
                inputMode="decimal"
                placeholder="Facultatif"
                error={errors.recoverySpeedKmh?.message}
                registration={register('recoverySpeedKmh')}
              />
            </div>

            <NumberField
              id="interval-work-incline"
              label="Inclinaison effort (%)"
              inputMode="decimal"
              placeholder="Facultatif"
              error={errors.workInclinePercent?.message}
              registration={register('workInclinePercent')}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="interval-warmup"
                label="Échauffement (min)"
                inputMode="decimal"
                placeholder="Aucun"
                error={errors.warmupMinutes?.message}
                registration={register('warmupMinutes')}
              />
              <NumberField
                id="interval-cooldown"
                label="Retour au calme (min)"
                inputMode="decimal"
                placeholder="Aucun"
                error={errors.cooldownMinutes?.message}
                registration={register('cooldownMinutes')}
              />
            </div>

            <div
              className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-3 text-sm"
              aria-live="polite"
            >
              {preview.ok ? (
                <>
                  <p className="font-medium">
                    {summarizeIntervalSets(buildIntervalTemplateSets(preview.plan))}
                  </p>
                  <p className="text-[var(--muted)]">
                    Durée totale : {totalDurationLabel(preview.plan)}
                  </p>
                </>
              ) : (
                <p className="text-[var(--muted)]">Complète les champs pour voir le résumé.</p>
              )}
              {existingSetCount > 0 ? (
                <p className="mt-2 text-[var(--muted)]">
                  Remplace les {existingSetCount} série
                  {existingSetCount === 1 ? '' : 's'} actuelle
                  {existingSetCount === 1 ? '' : 's'} de cet exercice.
                </p>
              ) : null}
            </div>

            {submitError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Créer le fractionné'}
            </Button>
            <button
              type="button"
              className="mt-2 min-h-11 w-full text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              disabled={pending}
              onClick={onCancel}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
