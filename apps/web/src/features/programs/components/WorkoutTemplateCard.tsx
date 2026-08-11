import type {
  ExerciseDetail,
  ExerciseListItem,
  ProgramDetail,
  WorkoutTemplateDetail,
} from '@gym-companion/shared';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getExercise } from '@/features/exercises/api/exercise-api';
import { getApiErrorMessage } from '@/lib/api/client';
import { StartWorkoutButton } from '@/features/workouts/components/StartWorkoutButton';

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
import { ContextMenu } from './ContextMenu';
import { ExercisePicker } from './ExercisePicker';
import { TemplateExerciseForm } from './TemplateExerciseForm';
import { TemplateExerciseCard } from './TemplateExerciseCard';
import { WorkoutTemplateForm } from './WorkoutTemplateForm';

type WorkoutTemplateCardProps = {
  programId: string;
  template: WorkoutTemplateDetail;
  index: number;
  total: number;
  readOnly: boolean;
  /** focused = éditeur plein écran UX-3 */
  mode?: 'accordion' | 'focused';
  programName?: string;
  onBack?: () => void;
  onStatus: (message: string) => void;
};

export function WorkoutTemplateCard({
  programId,
  template,
  index,
  total,
  readOnly,
  mode = 'focused',
  programName,
  onBack,
  onStatus,
}: WorkoutTemplateCardProps) {
  const mutations = useProgramContentMutations();
  const focused = mode === 'focused';
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

  const setCount = template.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
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
      onBack?.();
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
      onStatus('Exercice ajouté à la séance.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’ajouter cet exercice.'));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start gap-2">
        {focused && onBack ? (
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            aria-label={
              programName
                ? `Retour à ${programName}`
                : 'Retour au programme'
            }
            onClick={onBack}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {programName ? (
            <p className="text-xs text-[var(--muted)]">{programName}</p>
          ) : null}
          <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {template.name}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {template.exerciseCount} exercice
            {template.exerciseCount === 1 ? '' : 's'} · {setCount} série
            {setCount === 1 ? '' : 's'}
            {template.estimatedDurationMinutes != null
              ? ` · ${template.estimatedDurationMinutes} min`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {template.exerciseCount > 0 ? (
            <StartWorkoutButton
              sourceWorkoutTemplateId={template.id}
              label="Démarrer"
              disabled={readOnly}
              className="min-h-9 px-2.5 text-sm"
            />
          ) : null}
          {!readOnly ? (
            <ContextMenu
              label={`Actions pour ${template.name}`}
              items={[
                {
                  label: 'Modifier',
                  onSelect: () => setEditOpen(true),
                },
                {
                  label: 'Déplacer vers le haut',
                  disabled: !canMoveUp(index) || busy,
                  onSelect: () => void handleReorder('up'),
                },
                {
                  label: 'Déplacer vers le bas',
                  disabled: !canMoveDown(index, total) || busy,
                  onSelect: () => void handleReorder('down'),
                },
                {
                  label: 'Ajouter un exercice',
                  onSelect: () => setPickerOpen(true),
                },
                {
                  label: 'Supprimer',
                  destructive: true,
                  onSelect: () => setDeleteOpen(true),
                },
              ]}
            />
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        {template.exercises.length === 0 ? (
          <p className="py-6 text-sm text-[var(--muted)]" role="status">
            Aucun exercice
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
            className="mt-2 w-full gap-2"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Ajouter un exercice
          </Button>
        ) : null}
      </div>

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
        variant="secondary"
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
