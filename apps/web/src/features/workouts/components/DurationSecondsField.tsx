import { parseDurationParts, splitDuration } from '@gym-companion/validation';

const fieldClass =
  'min-h-12 w-16 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-2 text-center text-base tabular-nums';

type DurationSecondsFieldProps = {
  id: string;
  value: number | null;
  onChange: (seconds: number | null) => void;
  disabled?: boolean;
};

export function DurationSecondsField({
  id,
  value,
  onChange,
  disabled = false,
}: DurationSecondsFieldProps) {
  const parts = splitDuration(value);

  function update(next: { hours: number; minutes: number; seconds: number }) {
    const total = parseDurationParts(next.hours, next.minutes, next.seconds);
    onChange(total === 0 ? null : total);
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium" id={`${id}-label`}>
        Durée
      </legend>
      <input
        className="sr-only"
        type="number"
        aria-label="Durée (secondes)"
        readOnly
        value={value ?? ''}
      />
      <div className="flex items-end gap-2" role="group" aria-labelledby={`${id}-label`}>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Heures
          <input
            id={id}
            aria-label="Heures"
            className={fieldClass}
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            value={parts.hours}
            onChange={(event) =>
              update({
                hours: Number(event.target.value) || 0,
                minutes: parts.minutes,
                seconds: parts.seconds,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Minutes
          <input
            className={fieldClass}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            aria-label="Minutes"
            value={parts.minutes}
            onChange={(event) =>
              update({
                hours: parts.hours,
                minutes: Math.min(59, Number(event.target.value) || 0),
                seconds: parts.seconds,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Secondes
          <input
            className={fieldClass}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            aria-label="Secondes"
            value={parts.seconds}
            onChange={(event) =>
              update({
                hours: parts.hours,
                minutes: parts.minutes,
                seconds: Math.min(59, Number(event.target.value) || 0),
              })
            }
          />
        </label>
      </div>
    </fieldset>
  );
}
