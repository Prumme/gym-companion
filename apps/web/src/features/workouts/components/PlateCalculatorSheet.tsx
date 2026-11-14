import { X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ViewportPortal } from '@/components/ui/viewport-portal';
import { cn } from '@/lib/utils';

import { usePlateSettings } from '../hooks/use-plate-settings';
import {
  calculatePlates,
  formatPlateKg,
  formatPlatesPerSide,
  parseKgInput,
} from '../lib/plate-calculator';
import {
  MAX_BAR_WEIGHT_KG,
  MIN_BAR_WEIGHT_KG,
  PLATE_CATALOG_KG,
} from '../lib/plate-settings-storage';
import { computeWarmupRamp } from '../lib/warmup-ramp';

type PlateCalculatorSheetProps = {
  open: boolean;
  exerciseName: string;
  initialTargetKg: number | null;
  weightUnit?: 'KG' | 'LB';
  onClose: () => void;
};

const fieldClass =
  'min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-base tabular-nums';

function toInputValue(kg: number | null): string {
  return kg == null ? '' : String(kg).replace('.', ',');
}

export function PlateCalculatorSheet({
  open,
  exerciseName,
  initialTargetKg,
  weightUnit = 'KG',
  onClose,
}: PlateCalculatorSheetProps) {
  const titleId = useId();
  const targetId = useId();
  const barId = useId();
  const settingsPanelId = useId();
  const { settings, setBarKg, togglePlate, reset } = usePlateSettings();
  const [targetInput, setTargetInput] = useState(() => toInputValue(initialTargetKg));
  const [barInput, setBarInput] = useState(() => toInputValue(settings.barKg));
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetInput(toInputValue(initialTargetKg));
    setSettingsOpen(false);
  }, [open, initialTargetKg]);

  useEffect(() => {
    setBarInput(toInputValue(settings.barKg));
  }, [settings.barKg]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const targetKg = parseKgInput(targetInput);
  const plates = useMemo(
    () =>
      targetKg == null
        ? null
        : calculatePlates({ targetKg, barKg: settings.barKg, plates: settings.platesKg }),
    [targetKg, settings],
  );
  const warmup = useMemo(
    () =>
      computeWarmupRamp({
        workingKg: targetKg,
        barKg: settings.barKg,
        platesKg: settings.platesKg,
      }),
    [targetKg, settings],
  );

  if (!open) {
    return null;
  }

  const barInvalid = (() => {
    const kg = parseKgInput(barInput);
    return kg == null || kg < MIN_BAR_WEIGHT_KG || kg > MAX_BAR_WEIGHT_KG;
  })();

  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1rem] border border-[var(--border)] bg-[var(--card)] shadow-lg sm:rounded-[var(--radius)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-3">
            <div className="min-w-0">
              <h3 id={titleId} className="text-lg font-semibold">
                Disques et échauffement
              </h3>
              <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{exerciseName}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="size-11 min-h-11 px-0"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
              {weightUnit === 'LB' ? (
                <p className="text-sm text-[var(--muted)]">
                  Le calculateur fonctionne en kg pour l’instant, comme les charges enregistrées.
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm" htmlFor={targetId}>
                <span className="font-medium">Charge cible (kg)</span>
                <input
                  id={targetId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={fieldClass}
                  value={targetInput}
                  onChange={(event) => setTargetInput(event.target.value)}
                />
              </label>

              <section
                aria-live="polite"
                aria-label="Disques par côté"
                className="flex flex-col gap-1"
              >
                {plates == null ? (
                  <p className="text-sm text-[var(--muted)]">Saisis une charge cible.</p>
                ) : plates.status === 'BELOW_BAR' ? (
                  <p className="text-sm">
                    La cible est inférieure au poids de la barre ({formatPlateKg(settings.barKg)}).
                  </p>
                ) : plates.status === 'INVALID' ? (
                  <p className="text-sm text-[var(--danger)]">Charge invalide.</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Par côté
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatPlatesPerSide(plates.perSide)}
                    </p>
                    <p className="text-sm tabular-nums">
                      Charge chargée : {formatPlateKg(plates.achievableKg)} (barre{' '}
                      {formatPlateKg(settings.barKg)})
                    </p>
                    {plates.status === 'APPROXIMATE' ? (
                      <p className="text-sm text-[var(--muted)]">
                        Cible non atteignable exactement avec tes disques : écart de{' '}
                        {formatPlateKg(plates.differenceKg)}.
                      </p>
                    ) : null}
                  </>
                )}
                <p className="text-xs text-[var(--muted)]">
                  Valeur calculée à partir de tes réglages de barre et de disques.
                </p>
              </section>

              <section
                aria-labelledby={`${titleId}-warmup`}
                className="flex flex-col gap-2 border-t border-[var(--border)] pt-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 id={`${titleId}-warmup`} className="text-sm font-semibold">
                    Échauffement suggéré
                  </h4>
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    Suggestion calculée
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Barre × 10, puis 40 % × 5, 60 % × 3 et 80 % × 1 de la charge cible, arrondis à tes
                  disques. Rien n’est ajouté à la séance.
                </p>
                {warmup.status === 'OK' && warmup.steps.length > 0 ? (
                  <ol className="flex flex-col divide-y divide-[var(--border)]">
                    {warmup.steps.map((step) => (
                      <li
                        key={`${step.percent ?? 'bar'}-${step.loadKg}`}
                        className="flex items-baseline justify-between gap-3 py-2 text-sm"
                      >
                        <span className="text-[var(--muted)]">
                          {step.percent == null ? 'Barre' : `${step.percent} %`}
                        </span>
                        <span className="text-right tabular-nums">
                          <span className="font-medium">
                            {formatPlateKg(step.loadKg)} × {step.reps}
                          </span>
                          {step.perSide.length > 0 ? (
                            <span className="block text-xs text-[var(--muted)]">
                              Par côté : {formatPlatesPerSide(step.perSide)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Saisis une charge cible supérieure à la barre pour voir une rampe.
                  </p>
                )}
              </section>

              <div className="border-t border-[var(--border)] pt-3">
                <button
                  type="button"
                  className="min-h-11 text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
                  aria-expanded={settingsOpen}
                  aria-controls={settingsPanelId}
                  onClick={() => setSettingsOpen((value) => !value)}
                >
                  {settingsOpen ? 'Masquer les réglages' : 'Réglages barre et disques'}
                </button>
                {settingsOpen ? (
                  <div id={settingsPanelId} className="mt-2 flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-sm" htmlFor={barId}>
                      <span className="font-medium">Poids de la barre (kg)</span>
                      <input
                        id={barId}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className={fieldClass}
                        value={barInput}
                        aria-invalid={barInvalid}
                        aria-describedby={barInvalid ? `${barId}-error` : undefined}
                        onChange={(event) => {
                          setBarInput(event.target.value);
                          const kg = parseKgInput(event.target.value);
                          if (kg != null && kg >= MIN_BAR_WEIGHT_KG && kg <= MAX_BAR_WEIGHT_KG) {
                            setBarKg(kg);
                          }
                        }}
                      />
                      {barInvalid ? (
                        <span id={`${barId}-error`} className="text-[var(--danger)]" role="alert">
                          Entre {MIN_BAR_WEIGHT_KG} et {MAX_BAR_WEIGHT_KG} kg.
                        </span>
                      ) : null}
                    </label>
                    <fieldset className="flex flex-col gap-2">
                      <legend className="text-sm font-medium">Disques disponibles (paires)</legend>
                      <div className="flex flex-wrap gap-2">
                        {PLATE_CATALOG_KG.map((plateKg) => {
                          const active = settings.platesKg.includes(plateKg);
                          return (
                            <button
                              key={plateKg}
                              type="button"
                              aria-pressed={active}
                              className={cn(
                                'min-h-11 min-w-14 rounded-[var(--radius-control)] border px-3 text-sm tabular-nums',
                                active
                                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                                  : 'border-[var(--border)] text-[var(--muted)] line-through',
                              )}
                              onClick={() => togglePlate(plateKg)}
                            >
                              {formatPlateKg(plateKg)}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <p className="text-xs text-[var(--muted)]">
                      Réglages enregistrés sur cet appareil.
                    </p>
                    <button
                      type="button"
                      className="min-h-11 self-start text-sm text-[var(--muted)] underline-offset-4 hover:underline"
                      onClick={reset}
                    >
                      Rétablir les valeurs par défaut
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ViewportPortal>
  );
}
