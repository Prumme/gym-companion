import type {
  EquipmentTypeReference,
  ExerciseMeasurementType,
  ExerciseSource,
  MuscleGroupReference,
} from '@gym-companion/shared';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ExerciseListFilters } from '../api/exercise-query-options';
import { MEASUREMENT_TYPE_OPTIONS, SOURCE_OPTIONS } from '../lib/exercise-labels';

type ExerciseFiltersProps = {
  value: ExerciseListFilters;
  onChange: (next: ExerciseListFilters) => void;
  muscleGroups: MuscleGroupReference[];
  equipmentTypes: EquipmentTypeReference[];
  referencesLoading?: boolean;
  className?: string;
  showActions?: boolean;
  onApply?: () => void;
  onReset?: () => void;
};

function FieldSelect({
  id,
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
      <span className="font-medium">{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
      >
        {children}
      </select>
    </label>
  );
}

export function ExerciseFilters({
  value,
  onChange,
  muscleGroups,
  equipmentTypes,
  referencesLoading = false,
  className,
  showActions = false,
  onApply,
  onReset,
}: ExerciseFiltersProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FieldSelect
        id="filter-muscle"
        label="Groupe musculaire"
        value={value.muscleGroupId ?? ''}
        disabled={referencesLoading}
        onChange={(next) =>
          onChange({ ...value, muscleGroupId: next || undefined })
        }
      >
        <option value="">Tous les groupes</option>
        {muscleGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </FieldSelect>

      <FieldSelect
        id="filter-equipment"
        label="Type d’équipement"
        value={value.equipmentTypeId ?? ''}
        disabled={referencesLoading}
        onChange={(next) =>
          onChange({ ...value, equipmentTypeId: next || undefined })
        }
      >
        <option value="">Tous les équipements</option>
        {equipmentTypes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </FieldSelect>

      <FieldSelect
        id="filter-measurement"
        label="Type de mesure"
        value={value.measurementType ?? ''}
        onChange={(next) =>
          onChange({
            ...value,
            measurementType: (next || undefined) as ExerciseMeasurementType | undefined,
          })
        }
      >
        <option value="">Tous les types</option>
        {MEASUREMENT_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FieldSelect>

      <FieldSelect
        id="filter-source"
        label="Source"
        value={value.source ?? ''}
        onChange={(next) =>
          onChange({
            ...value,
            source: (next || undefined) as ExerciseSource | undefined,
          })
        }
      >
        {SOURCE_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </FieldSelect>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={Boolean(value.favoriteOnly)}
          onChange={(event) =>
            onChange({
              ...value,
              favoriteOnly: event.target.checked || undefined,
            })
          }
        />
        <span>Favoris uniquement</span>
      </label>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={Boolean(value.includeArchived)}
          onChange={(event) =>
            onChange({
              ...value,
              includeArchived: event.target.checked || undefined,
            })
          }
        />
        <span>Inclure les exercices archivés</span>
      </label>

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" onClick={onApply}>
            Appliquer
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={onReset}>
            Effacer
          </Button>
        </div>
      ) : null}
    </div>
  );
}
