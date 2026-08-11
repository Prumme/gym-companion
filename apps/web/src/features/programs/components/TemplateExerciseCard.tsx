import type {
  ProgramDetail,
  WorkoutTemplateExerciseDetail,
  WorkoutTemplateSetTarget,
} from '@gym-companion/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { LoadRecommendationCard } from '@/features/coaching/components/LoadRecommendationCard';
import { getExercise } from '@/features/exercises/api/exercise-api';
import { getApiErrorMessage } from '@/lib/api/client';

import { programQueryKeys } from '../api/program-query-keys';
import { useProgramContentMutations } from '../hooks/use-program-mutations';
import {
  reorderExercisesInDetail,
  reorderSetsInDetail,
} from '../lib/program-cache';
import { canMoveDown, canMoveUp } from '../lib/reorder';
import {
  compatibleEquipmentOptions,
  detailToTemplateExerciseFormValues,
  duplicateSetFormValues,
  emptySetFormValues,
  setDetailToFormValues,
  setFormToPayload,
  templateExerciseFormToUpdatePayload,
  type TemplateExerciseFormValues,
  type TemplateSetFormValues,
} from '../lib/template-forms';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import { TargetSetRow } from './TargetSetRow';
import { TemplateExerciseForm } from './TemplateExerciseForm';
import { TemplateSetEditor } from './TemplateSetEditor';

type TemplateExerciseCardProps = {
  programId: string;
  workoutTemplateId: string;
  exercise: WorkoutTemplateExerciseDetail;
  index: number;
  total: number;
  readOnly: boolean;
  busy?: boolean;
  onStatus: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

function formatExerciseMeta(exercise: WorkoutTemplateExerciseDetail): string {
  const parts: string[] = [exercise.exercise.primaryMuscleGroup.name];
  if (exercise.equipmentType?.name) {
    parts.push(exercise.equipmentType.name);
  }
  const rest =
    exercise.restSecondsOverride != null
      ? `repos ${exercise.restSecondsOverride} s`
      : null;
  if (rest) parts.push(rest);
  return parts.join(' · ');
}

export function TemplateExerciseCard({
  programId,
  workoutTemplateId,
  exercise,
  index,
  total,
  readOnly,
  busy = false,
  onStatus,
  onBusyChange,
}: TemplateExerciseCardProps) {
  const mutations = useProgramContentMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [setEditorOpen, setSetEditorOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<WorkoutTemplateSetTarget | null>(
    null,
  );
  const [setFormValues, setSetFormValues] = useState<TemplateSetFormValues>(
    emptySetFormValues(exercise.exercise.measurementType),
  );
  const [exerciseFormValues, setExerciseFormValues] = useState(
    detailToTemplateExerciseFormValues(exercise),
  );
  const [compatibleEquipment, setCompatibleEquipment] = useState<
    Array<{ id: string; name: string }>
  >(
    exercise.equipmentType
      ? [{ id: exercise.equipmentType.id, name: exercise.equipmentType.name }]
      : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);

  const isArchivedSource = exercise.exercise.archivedAt != null;
  const reorderPending = busy || mutations.reorderExercises.isPending;

  async function openEdit() {
    setError(null);
    setExerciseFormValues(detailToTemplateExerciseFormValues(exercise));
    try {
      const detail = await getExercise(exercise.exercise.id);
      setCompatibleEquipment(compatibleEquipmentOptions(detail));
    } catch {
      setCompatibleEquipment(
        exercise.equipmentType
          ? [{ id: exercise.equipmentType.id, name: exercise.equipmentType.name }]
          : [],
      );
    }
    setEditOpen(true);
  }

  async function handleUpdate(values: TemplateExerciseFormValues) {
    setError(null);
    try {
      await mutations.updateExercise.mutateAsync({
        programId,
        workoutTemplateId,
        templateExerciseId: exercise.id,
        input: templateExerciseFormToUpdatePayload(values),
      });
      setEditOpen(false);
      onStatus('Exercice mis à jour.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de modifier cet exercice.'),
      );
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await mutations.removeExercise.mutateAsync({
        programId,
        workoutTemplateId,
        templateExerciseId: exercise.id,
      });
      setRemoveOpen(false);
      onStatus('Exercice retiré de la séance.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de retirer cet exercice.'));
    }
  }

  async function handleExerciseReorder(direction: 'up' | 'down') {
    onBusyChange?.(true);
    setError(null);
    const snapshot = mutations.queryClient.getQueryData<ProgramDetail>(
      programQueryKeys.detail(programId),
    );
    if (!snapshot) {
      onBusyChange?.(false);
      return;
    }

    const result = reorderExercisesInDetail(
      snapshot,
      workoutTemplateId,
      index,
      direction,
    );
    if (!result) {
      onBusyChange?.(false);
      return;
    }

    mutations.queryClient.setQueryData(
      programQueryKeys.detail(programId),
      result.next,
    );

    try {
      await mutations.reorderExercises.mutateAsync({
        programId,
        workoutTemplateId,
        input: { workoutTemplateExerciseIds: result.orderedIds },
      });
      onStatus('Ordre des exercices mis à jour.');
    } catch (err) {
      mutations.queryClient.setQueryData(
        programQueryKeys.detail(programId),
        snapshot,
      );
      setError(
        getApiErrorMessage(err, 'Impossible de réordonner les exercices.'),
      );
    } finally {
      onBusyChange?.(false);
    }
  }

  function openCreateSet(duplicateLast = false) {
    setEditingSet(null);
    if (duplicateLast && exercise.sets.length > 0) {
      setSetFormValues(duplicateSetFormValues(exercise.sets.at(-1)!));
    } else {
      setSetFormValues(emptySetFormValues(exercise.exercise.measurementType));
    }
    setSetEditorOpen(true);
  }

  async function handleSaveSet(values: TemplateSetFormValues) {
    setError(null);
    try {
      const payload = setFormToPayload(values);
      if (editingSet) {
        await mutations.updateSet.mutateAsync({
          programId,
          workoutTemplateId,
          templateExerciseId: exercise.id,
          setId: editingSet.id,
          input: payload,
        });
        onStatus('Série mise à jour.');
      } else {
        await mutations.createSet.mutateAsync({
          programId,
          workoutTemplateId,
          templateExerciseId: exercise.id,
          input: payload,
        });
        onStatus('Série ajoutée.');
      }
      setSetEditorOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’enregistrer cette série.'));
    }
  }

  async function handleDeleteSet() {
    if (!deleteSetId) {
      return;
    }
    setError(null);
    try {
      await mutations.deleteSet.mutateAsync({
        programId,
        workoutTemplateId,
        templateExerciseId: exercise.id,
        setId: deleteSetId,
      });
      setDeleteSetId(null);
      onStatus('Série supprimée.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de supprimer cette série.'));
    }
  }

  async function handleSetReorder(setIndex: number, direction: 'up' | 'down') {
    onBusyChange?.(true);
    setError(null);
    const snapshot = mutations.queryClient.getQueryData<ProgramDetail>(
      programQueryKeys.detail(programId),
    );
    if (!snapshot) {
      onBusyChange?.(false);
      return;
    }
    const result = reorderSetsInDetail(
      snapshot,
      workoutTemplateId,
      exercise.id,
      setIndex,
      direction,
    );
    if (!result) {
      onBusyChange?.(false);
      return;
    }
    mutations.queryClient.setQueryData(
      programQueryKeys.detail(programId),
      result.next,
    );
    try {
      await mutations.reorderSets.mutateAsync({
        programId,
        workoutTemplateId,
        templateExerciseId: exercise.id,
        input: { setIds: result.orderedIds },
      });
      onStatus('Ordre des séries mis à jour.');
    } catch (err) {
      mutations.queryClient.setQueryData(
        programQueryKeys.detail(programId),
        snapshot,
      );
      setError(getApiErrorMessage(err, 'Impossible de réordonner les séries.'));
    } finally {
      onBusyChange?.(false);
    }
  }

  function openEditSet(set: WorkoutTemplateSetTarget) {
    setEditingSet(set);
    setSetFormValues(setDetailToFormValues(set));
    setSetEditorOpen(true);
  }

  return (
    <section className="border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="flex items-start gap-2">
        <span className="w-5 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-[var(--muted)]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight uppercase sm:normal-case">
            {exercise.exercise.name}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {formatExerciseMeta(exercise)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {exercise.sets.length} série
            {exercise.sets.length === 1 ? '' : 's'}
          </p>
          {exercise.notes ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{exercise.notes}</p>
          ) : null}
          {isArchivedSource ? (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Exercice source archivé
            </p>
          ) : null}
          <LoadRecommendationCard
            variant="compact"
            programId={programId}
            workoutTemplateExerciseId={exercise.id}
            exerciseId={exercise.exercise.id}
            measurementType={exercise.exercise.measurementType}
            workingSetCount={
              exercise.sets.filter((set) => set.setType === 'WORKING').length
            }
          />
        </div>
        {!readOnly ? (
          <ContextMenu
            label={`Actions pour ${exercise.exercise.name}`}
            items={[
              {
                label: 'Déplacer vers le haut',
                disabled: !canMoveUp(index) || reorderPending,
                onSelect: () => void handleExerciseReorder('up'),
              },
              {
                label: 'Déplacer vers le bas',
                disabled: !canMoveDown(index, total) || reorderPending,
                onSelect: () => void handleExerciseReorder('down'),
              },
              {
                label: 'Modifier',
                onSelect: () => void openEdit(),
              },
              {
                label: 'Ajouter une série',
                onSelect: () => openCreateSet(false),
              },
              ...(exercise.sets.length > 0
                ? [
                    {
                      label: 'Dupliquer la dernière série',
                      onSelect: () => openCreateSet(true),
                    },
                  ]
                : []),
              {
                label: 'Supprimer',
                destructive: true,
                onSelect: () => setRemoveOpen(true),
              },
            ]}
          />
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-2">
        {exercise.sets.map((set, setIndex) => (
          <TargetSetRow
            key={set.id}
            set={set}
            index={setIndex}
            readOnly={readOnly}
            onActivate={readOnly ? undefined : () => openEditSet(set)}
            menuItems={
              readOnly
                ? []
                : [
                    {
                      label: 'Modifier',
                      onSelect: () => openEditSet(set),
                    },
                    {
                      label: 'Déplacer vers le haut',
                      disabled:
                        !canMoveUp(setIndex) ||
                        busy ||
                        mutations.reorderSets.isPending,
                      onSelect: () => void handleSetReorder(setIndex, 'up'),
                    },
                    {
                      label: 'Déplacer vers le bas',
                      disabled:
                        !canMoveDown(setIndex, exercise.sets.length) ||
                        busy ||
                        mutations.reorderSets.isPending,
                      onSelect: () => void handleSetReorder(setIndex, 'down'),
                    },
                    {
                      label: 'Supprimer',
                      destructive: true,
                      onSelect: () => setDeleteSetId(set.id),
                    },
                  ]
            }
          />
        ))}
      </ul>

      {!readOnly ? (
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={() => openCreateSet(false)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Ajouter une série
        </button>
      ) : null}

      <TemplateExerciseForm
        open={editOpen}
        title="Configurer l’exercice"
        submitLabel="Enregistrer"
        exerciseName={exercise.exercise.name}
        compatibleEquipment={compatibleEquipment}
        initialValues={exerciseFormValues}
        pending={mutations.updateExercise.isPending}
        submitError={error}
        onSubmit={handleUpdate}
        onCancel={() => setEditOpen(false)}
      />

      <TemplateSetEditor
        open={setEditorOpen}
        title={editingSet ? 'Modifier la série' : 'Ajouter une série'}
        submitLabel={editingSet ? 'Enregistrer' : 'Ajouter la série'}
        measurementType={exercise.exercise.measurementType}
        initialValues={setFormValues}
        pending={
          mutations.createSet.isPending || mutations.updateSet.isPending
        }
        submitError={error}
        onSubmit={handleSaveSet}
        onCancel={() => setSetEditorOpen(false)}
      />

      <ConfirmDialog
        open={removeOpen}
        title="Retirer cet exercice de la séance ?"
        description="Ses séries cibles seront retirées de ce modèle. L’exercice restera disponible dans le catalogue."
        confirmLabel="Retirer"
        destructive
        pending={mutations.removeExercise.isPending}
        error={error}
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveOpen(false)}
      />

      <ConfirmDialog
        open={deleteSetId != null}
        title="Supprimer cette série ?"
        description="La série cible sera retirée de cet exercice."
        confirmLabel="Supprimer"
        destructive
        pending={mutations.deleteSet.isPending}
        error={error}
        onConfirm={() => void handleDeleteSet()}
        onCancel={() => setDeleteSetId(null)}
      />
    </section>
  );
}
