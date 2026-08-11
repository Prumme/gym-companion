import type {
  EquipmentTypeReference,
  MuscleGroupReference,
} from '@gym-companion/shared';
import { X } from 'lucide-react';

import type { ExerciseListFilters } from '../api/exercise-query-options';
import {
  getMeasurementTypeLabel,
  getSourceLabel,
} from '../lib/exercise-labels';

type Chip = {
  key: string;
  label: string;
  clear: Partial<ExerciseListFilters>;
};

type ExerciseActiveFilterChipsProps = {
  filters: ExerciseListFilters;
  muscleGroups: MuscleGroupReference[];
  equipmentTypes: EquipmentTypeReference[];
  onClear: (patch: Partial<ExerciseListFilters>) => void;
  onClearAll: () => void;
};

function buildChips(
  filters: ExerciseListFilters,
  muscleGroups: MuscleGroupReference[],
  equipmentTypes: EquipmentTypeReference[],
): Chip[] {
  const chips: Chip[] = [];

  if (filters.muscleGroupId) {
    const name =
      muscleGroups.find((g) => g.id === filters.muscleGroupId)?.name ??
      'Muscle';
    chips.push({
      key: 'muscle',
      label: name,
      clear: { muscleGroupId: undefined },
    });
  }
  if (filters.equipmentTypeId) {
    const name =
      equipmentTypes.find((e) => e.id === filters.equipmentTypeId)?.name ??
      'Équipement';
    chips.push({
      key: 'equipment',
      label: name,
      clear: { equipmentTypeId: undefined },
    });
  }
  if (filters.measurementType) {
    chips.push({
      key: 'measurement',
      label: getMeasurementTypeLabel(filters.measurementType),
      clear: { measurementType: undefined },
    });
  }
  if (filters.source) {
    chips.push({
      key: 'source',
      label: getSourceLabel(filters.source),
      clear: { source: undefined },
    });
  }
  if (filters.favoriteOnly) {
    chips.push({
      key: 'favorite',
      label: 'Favoris',
      clear: { favoriteOnly: undefined },
    });
  }
  if (filters.includeArchived) {
    chips.push({
      key: 'archived',
      label: 'Archivés',
      clear: { includeArchived: undefined },
    });
  }

  return chips;
}

export function ExerciseActiveFilterChips({
  filters,
  muscleGroups,
  equipmentTypes,
  onClear,
  onClearAll,
}: ExerciseActiveFilterChipsProps) {
  const chips = buildChips(filters, muscleGroups, equipmentTypes);
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtres actifs">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--foreground)]"
          onClick={() => onClear(chip.clear)}
          aria-label={`Retirer le filtre ${chip.label}`}
        >
          {chip.label}
          <X className="size-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        className="min-h-8 px-1 text-xs font-medium text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        onClick={onClearAll}
      >
        Effacer
      </button>
    </div>
  );
}
