import type {
  ProgramDetail,
  WorkoutTemplateExerciseDetail,
  WorkoutTemplateSetTarget,
} from '@gym-companion/shared';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { getExercise } from '@/features/exercises/api/exercise-api';
import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';
import { getApiErrorMessage } from '@/lib/api/client';

import { programQueryKeys } from '../api/program-query-keys';
import { useProgramContentMutations } from '../hooks/use-program-mutations';
import {
  reorderExercisesInDetail,
  reorderSetsInDetail,
} from '../lib/program-cache';
import { getWorkoutSetTypeLabel } from '../lib/program-labels';
import { canMoveDown, canMoveUp } from '../lib/reorder';
import {
  compatibleEquipmentOptions,
  detailToTemplateExerciseFormValues,
  duplicateSetFormValues,
  emptySetFormValues,
  formatSetSummary,
  setDetailToFormValues,
  setFormToPayload,
  templateExerciseFormToUpdatePayload,
  type TemplateExerciseFormValues,
  type TemplateSetFormValues,
} from '../lib/template-forms';
import { ConfirmDialog } from './ConfirmDialog';
import { ReorderControls } from './ReorderControls';
import { TemplateExerciseForm } from './TemplateExerciseForm';
import { TemplateSetEditor } from './TemplateSetEditor';
import { LoadRecommendationCard } from '@/features/coaching/components/LoadRecommendationCard';

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
  const [menuOpen, setMenuOpen] = useState(false);
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
  const restLabel =
    exercise.restSecondsOverride != null
      ? `${exercise.restSecondsOverride} s`
      : 'Valeur par défaut';

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
    setMenuOpen(false);
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
    setMenuOpen(false);
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

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--muted)]">
            Exercice {index + 1}
          </p>
          <h4 className="font-semibold">{exercise.exercise.name}</h4>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {exercise.exercise.primaryMuscleGroup.name} ·{' '}
            {getMeasurementTypeLabel(exercise.exercise.measurementType)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {exercise.equipmentType?.name ?? 'Sans équipement'} · Repos {restLabel}
          </p>
          {exercise.notes ? (
            <p className="mt-1 text-sm">{exercise.notes}</p>
          ) : null}
          {isArchivedSource ? (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Exercice source archivé
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--muted)]">
            {exercise.sets.length} série{exercise.sets.length === 1 ? '' : 's'}
          </p>
          <LoadRecommendationCard
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
          <div className="flex flex-col items-end gap-2">
            <ReorderControls
              label={`l’exercice ${exercise.exercise.name}`}
              canMoveUp={canMoveUp(index)}
              canMoveDown={canMoveDown(index, total)}
              disabled={busy || mutations.reorderExercises.isPending}
              onMoveUp={() => void handleExerciseReorder('up')}
              onMoveDown={() => void handleExerciseReorder('down')}
            />
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                className="min-h-10 px-2"
                aria-expanded={menuOpen}
                aria-label={`Actions pour ${exercise.exercise.name}`}
                onClick={() => setMenuOpen((value) => !value)}
              >
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => void openEdit()}
                  >
                    Modifier la configuration
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => openCreateSet(false)}
                  >
                    Ajouter une série
                  </button>
                  {exercise.sets.length > 0 ? (
                    <button
                      type="button"
                      className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => openCreateSet(true)}
                    >
                      Dupliquer la dernière série
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-red-50"
                    onClick={() => {
                      setRemoveOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Retirer
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {exercise.sets.map((set, setIndex) => (
          <li
            key={set.id}
            className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {setIndex + 1}. {getWorkoutSetTypeLabel(set.setType)}
                </p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {formatSetSummary(set) || 'Sans cible renseignée'}
                </p>
              </div>
              {!readOnly ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <ReorderControls
                    label={`la série ${setIndex + 1}`}
                    canMoveUp={canMoveUp(setIndex)}
                    canMoveDown={canMoveDown(setIndex, exercise.sets.length)}
                    disabled={busy || mutations.reorderSets.isPending}
                    onMoveUp={() => void handleSetReorder(setIndex, 'up')}
                    onMoveDown={() => void handleSetReorder(setIndex, 'down')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 px-2 text-xs"
                    onClick={() => {
                      setEditingSet(set);
                      setSetFormValues(setDetailToFormValues(set));
                      setSetEditorOpen(true);
                    }}
                  >
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 px-2"
                    aria-label={`Supprimer la série ${setIndex + 1}`}
                    onClick={() => setDeleteSetId(set.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!readOnly ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full gap-2"
          onClick={() => openCreateSet(false)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Ajouter une série
        </Button>
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
        submitLabel={editingSet ? 'Enregistrer' : 'Ajouter'}
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
    </article>
  );
}
