import { useId } from 'react';

import {
  displaySharedWorkoutJoinCode,
  sanitizePartialSharedWorkoutJoinCode,
} from '../lib/shared-workout-join-code-input';

type SharedWorkoutJoinCodeInputProps = {
  value: string;
  onChange: (normalized: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function SharedWorkoutJoinCodeInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: SharedWorkoutJoinCodeInputProps) {
  const inputId = useId();

  return (
    <input
      id={inputId}
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={displaySharedWorkoutJoinCode(value)}
      onChange={(event) => {
        onChange(sanitizePartialSharedWorkoutJoinCode(event.target.value));
      }}
      className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-center font-mono text-lg tracking-[0.2em] uppercase outline-none focus:border-[var(--foreground)] disabled:opacity-60"
      aria-label="Code d’accès"
    />
  );
}
