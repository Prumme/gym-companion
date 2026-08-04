import type {
  ExerciseDetail,
  ExerciseListItem,
  ProgramDetail,
  WorkoutTemplateDetail,
} from '@gym-companion/shared';
import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getExercise } from '@/features/exercises/api/exercise-api';
import { getApiErrorMessage } from '@/lib/api/client';

import { programQueryKeys } from '../api/program-query-keys';
import { useProgramContentMutations } from '../hooks/use-program-mutations';
import { reorderTemplatesInDetail } from '../lib/program-cache';
import { canMoveDown, canMoveUp } from '../lib/reorder';
import {
  buildAddExerciseDefaults,
  compatibleEquipmentOptions,
  templateExerciseFormToAddPayload,
  type TemplateExerciseFormValues,
} from '../lib/template-forms';
import {
  detailToWorkoutTemplateFormValues,
  EMPTY_WORKOUT_TEMPLATE_FORM_VALUES,
  workoutTemplateFormToCreatePayload,
  workoutTemplateFormToUpdatePayload,
  type WorkoutTemplateFormValues,
} from '../lib/workout-template-form';
import { ConfirmDialog } from './ConfirmDialog';
import { ExercisePicker } from './ExercisePicker';
import { ReorderControls } from './ReorderControls';
import { TemplateExerciseForm } from './TemplateExerciseForm';
import { TemplateExerciseCard } from './TemplateExerciseCard';
import { WorkoutTemplateForm } from './WorkoutTemplateForm';
import { StartWorkoutButton } from '@/features/workouts/components/StartWorkoutButton';

type WorkoutTemplateCardProps = {
  programId: string;
  template: WorkoutTemplateDetail;
  index: number;
  total: number;
  readOnly: boolean;
  defaultOpen?: boolean;
  onStatus: (message: string) => void;
};

export function WorkoutTemplateCard({
  programId,
  template,
  index,
  total,
  readOnly,
  defaultOpen = false,
  onStatus,
}: WorkoutTemplateCardProps) {
  const mutations = useProgramContentMutations();
  const [expanded, setExpanded] = useState(defaultOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDetail | null>(
    null,
  );
  const [addDefaults, setAddDefaults] = useState<TemplateExerciseFormValues | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existingExerciseIds = useMemo(
    () => new Set(template.exercises.map((item) => item.exercise.id)),
    [template.exercises],
  );

  async function handleUpdate(values: WorkoutTemplateFormValues) {
    setError(null);
    try {
      await mutations.updateTemplate.mutateAsync({
        programId,
        workoutTemplateId: template.id,
        input: workoutTemplateFormToUpdatePayload(values),
      });
      setEditOpen(false);
      onStatus('Séance mise à jour.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de modifier cette séance.'));
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await mutations.deleteTemplate.mutateAsync({
        programId,
        workoutTemplateId: template.id,
      });
      setDeleteOpen(false);
      onStatus('Séance supprimée.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de supprimer cette séance.'));
    }
  }

  async function handleReorder(direction: 'up' | 'down') {
    setBusy(true);
    setError(null);
    const snapshot = mutations.queryClient.getQueryData<ProgramDetail>(
      programQueryKeys.detail(programId),
    );
    if (!snapshot) {
      setBusy(false);
      return;
    }
    const result = reorderTemplatesInDetail(snapshot, index, direction);
    mutations.queryClient.setQueryData(
      programQueryKeys.detail(programId),
      result.next,
    );
    try {
      await mutations.reorderTemplates.mutateAsync({
        programId,
        input: { workoutTemplateIds: result.orderedIds },
      });
      onStatus('Ordre des séances mis à jour.');
    } catch (err) {
      mutations.queryClient.setQueryData(
        programQueryKeys.detail(programId),
        snapshot,
      );
      setError(
        getApiErrorMessage(err, 'Impossible de réordonner les séances.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePick(exercise: ExerciseListItem) {
    setPickerOpen(false);
    setError(null);
    try {
      const detail = await getExercise(exercise.id);
      setSelectedExercise(detail);
      setAddDefaults(buildAddExerciseDefaults(detail));
      setConfigureOpen(true);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de charger cet exercice.'),
      );
    }
  }

  async function handleAddExercise(values: TemplateExerciseFormValues) {
    if (!selectedExercise) {
      return;
    }
    setError(null);
    try {
      await mutations.addExercise.mutateAsync({
        programId,
        workoutTemplateId: template.id,
        input: templateExerciseFormToAddPayload(selectedExercise.id, values),
      });
      setConfigureOpen(false);
      setSelectedExercise(null);
      setExpanded(true);
      onStatus('Exercice ajouté à la séance.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’ajouter cet exercice.'));
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-[var(--radius)] text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="flex items-start gap-2">
            <ChevronDown
              className={`mt-1 size-5 shrink-0 text-[var(--muted)] transition ${expanded ? '' : '-rotate-90'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--muted)]">
                Séance {index + 1}
              </p>
              <h3 className="text-base font-semibold">{template.name}</h3>
              {template.description ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {template.description}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-[var(--muted)]">
                {template.exerciseCount} exercice
                {template.exerciseCount === 1 ? '' : 's'}
                {template.estimatedDurationMinutes != null
                  ? ` · ${template.estimatedDurationMinutes} min`
                  : ''}
              </p>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {template.exerciseCount > 0 ? (
            <StartWorkoutButton
              sourceWorkoutTemplateId={template.id}
              label="Démarrer"
              disabled={readOnly}
            />
          ) : null}
          {!readOnly ? (
            <>
            <ReorderControls
              label={`la séance ${template.name}`}
              canMoveUp={canMoveUp(index)}
              canMoveDown={canMoveDown(index, total)}
              disabled={busy || mutations.reorderTemplates.isPending}
              onMoveUp={() => void handleReorder('up')}
              onMoveDown={() => void handleReorder('down')}
            />
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                className="min-h-10 px-2"
                aria-expanded={menuOpen}
                aria-label={`Actions pour ${template.name}`}
                onClick={() => setMenuOpen((value) => !value)}
              >
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 z-10 mt-1 w-44 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setEditOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setPickerOpen(true);
                      setMenuOpen(false);
                      setExpanded(true);
                    }}
                  >
                    Ajouter un exercice
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-red-50"
                    onClick={() => {
                      setDeleteOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              ) : null}
            </div>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          {template.exercises.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Aucun exercice dans cette séance.
            </p>
          ) : null}
          {template.exercises.map((exercise, exerciseIndex) => (
            <TemplateExerciseCard
              key={exercise.id}
              programId={programId}
              workoutTemplateId={template.id}
              exercise={exercise}
              index={exerciseIndex}
              total={template.exercises.length}
              readOnly={readOnly}
              busy={busy}
              onStatus={onStatus}
              onBusyChange={setBusy}
            />
          ))}
          {!readOnly ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Ajouter un exercice
            </Button>
          ) : null}
        </div>
      ) : null}

      <WorkoutTemplateForm
        open={editOpen}
        title="Modifier la séance"
        submitLabel="Enregistrer"
        initialValues={detailToWorkoutTemplateFormValues(template)}
        pending={mutations.updateTemplate.isPending}
        submitError={error}
        onSubmit={handleUpdate}
        onCancel={() => setEditOpen(false)}
      />

      <ExercisePicker
        open={pickerOpen}
        existingExerciseIds={existingExerciseIds}
        onSelect={(exercise) => void handlePick(exercise)}
        onClose={() => setPickerOpen(false)}
      />

      {selectedExercise && addDefaults ? (
        <TemplateExerciseForm
          open={configureOpen}
          title="Configurer l’exercice"
          submitLabel="Ajouter"
          exerciseName={selectedExercise.name}
          compatibleEquipment={compatibleEquipmentOptions(selectedExercise)}
          initialValues={addDefaults}
          pending={mutations.addExercise.isPending}
          submitError={error}
          onSubmit={handleAddExercise}
          onCancel={() => {
            setConfigureOpen(false);
            setSelectedExercise(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer cette séance du programme ?"
        description={
          template.exercises.length > 0
            ? 'Les exercices et séries cibles de ce modèle seront également retirés du programme.'
            : 'Cette séance sera retirée du programme.'
        }
        confirmLabel="Supprimer"
        destructive
        pending={mutations.deleteTemplate.isPending}
        error={error}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </section>
  );
}

type CreateWorkoutTemplateButtonProps = {
  programId: string;
  onCreated: (templateId: string) => void;
  onStatus: (message: string) => void;
};

export function CreateWorkoutTemplateButton({
  programId,
  onCreated,
  onStatus,
}: CreateWorkoutTemplateButtonProps) {
  const mutations = useProgramContentMutations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(values: WorkoutTemplateFormValues) {
    setError(null);
    try {
      const detail = await mutations.createTemplate.mutateAsync({
        programId,
        input: workoutTemplateFormToCreatePayload(values),
      });
      const created = detail.workoutTemplates.at(-1);
      setOpen(false);
      onStatus('Séance ajoutée.');
      if (created) {
        onCreated(created.id);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’ajouter cette séance.'));
    }
  }

  return (
    <>
      <Button
        type="button"
        className="w-full gap-2 sm:w-auto"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        Ajouter une séance
      </Button>
      <WorkoutTemplateForm
        open={open}
        title="Ajouter une séance"
        submitLabel="Créer la séance"
        initialValues={EMPTY_WORKOUT_TEMPLATE_FORM_VALUES}
        pending={mutations.createTemplate.isPending}
        submitError={error}
        onSubmit={handleCreate}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
