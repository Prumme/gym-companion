import type { MuscleGroupReference } from '@gym-companion/shared';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

type MuscleGroupSelectorProps = {
  id: string;
  label: string;
  muscleGroups: MuscleGroupReference[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  excludeIds?: string[];
  description?: string;
};

export function MuscleGroupSelector({
  id,
  label,
  muscleGroups,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  excludeIds = [],
  description,
}: MuscleGroupSelectorProps) {
  const options = muscleGroups.filter((group) => !excludeIds.includes(group.id));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
        {required ? <span className="text-[var(--danger)]"> *</span> : null}
      </label>
      {description ? (
        <p id={`${id}-desc`} className="text-xs text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      <select
        id={id}
        className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [description ? `${id}-desc` : null, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Sélectionner…</option>
        {options.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SecondaryMuscleGroupSelectorProps = {
  muscleGroups: MuscleGroupReference[];
  primaryMuscleGroupId: string;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
};

export function SecondaryMuscleGroupSelector({
  muscleGroups,
  primaryMuscleGroupId,
  value,
  onChange,
  error,
  disabled = false,
}: SecondaryMuscleGroupSelectorProps) {
  const options = muscleGroups.filter(
    (group) => group.id !== primaryMuscleGroupId,
  );
  const selected = muscleGroups.filter((group) => value.includes(group.id));

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    onChange([...value, id]);
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium">Groupes musculaires secondaires</legend>
      <p className="text-xs text-[var(--muted)]">
        Optionnel. Le groupe principal ne peut pas être sélectionné ici.
      </p>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Secondaires sélectionnés">
          {selected.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium"
                onClick={() => toggle(group.id)}
                aria-label={`Retirer ${group.name}`}
              >
                {group.name}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((group) => {
          const checked = value.includes(group.id);
          return (
            <label
              key={group.id}
              className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm"
            >
              <input
                type="checkbox"
                className="size-4"
                checked={checked}
                onChange={() => toggle(group.id)}
              />
              <span>{group.name}</span>
            </label>
          );
        })}
      </div>

      {options.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Sélectionne d’abord un groupe principal pour choisir des secondaires.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {selected.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          className="w-fit px-0"
          onClick={() => onChange([])}
        >
          Tout retirer
        </Button>
      ) : null}
    </fieldset>
  );
}
