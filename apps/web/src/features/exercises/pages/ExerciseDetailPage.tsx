import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/button';
import { ExercisePersonalRecordsSection } from '@/features/personal-records/components/ExercisePersonalRecordsSection';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { exerciseDetailQueryOptions } from '../api/exercise-query-options';
import { ExerciseFavoriteButton } from '../components/ExerciseFavoriteButton';
import { ExerciseManagementSection } from '../components/ExerciseManagementSection';
import { ExercisePreferenceSection } from '../components/ExercisePreferenceSection';
import { ExerciseSourceBadge } from '../components/ExerciseSourceBadge';
import { useUpdateExercisePreferenceMutation } from '../hooks/use-exercise-preference-mutations';
import { getMeasurementTypeLabel } from '../lib/exercise-labels';
import { preferenceToUpdateInput } from '../lib/exercise-preference';

type DetailLocationState = {
  from?: string;
  flash?: string;
};

export function ExerciseDetailPage() {
  const { exerciseId = '' } = useParams();
  const location = useLocation();
  const locationState = location.state as DetailLocationState | null;
  const backTo = locationState?.from ?? '/exercises';
  const [statusMessage, setStatusMessage] = useState<string | null>(
    locationState?.flash ?? null,
  );
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const updatePreference = useUpdateExercisePreferenceMutation();

  const detailQuery = useQuery({
    ...exerciseDetailQueryOptions(exerciseId),
    enabled: Boolean(exerciseId),
  });

  if (detailQuery.isLoading) {
    return <LoadingState label="Chargement de l’exercice…" />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    const status = (detailQuery.error as ApiRequestError | undefined)?.status;
    const message =
      status === 404
        ? 'Cet exercice est introuvable ou inaccessible.'
        : getApiErrorMessage(
            detailQuery.error,
            'Impossible de charger cet exercice.',
          );

    return (
      <main className="flex flex-1 flex-col gap-4">
        <PageHeader title="Exercice" backTo={backTo} backLabel="Exercices" />
        <div
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{message}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[var(--foreground)] underline-offset-2 hover:underline"
            onClick={() => void detailQuery.refetch()}
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  const exercise = detailQuery.data;
  const preference = exercise.userPreference;
  const favoritePending =
    updatePreference.isPending &&
    updatePreference.variables?.exerciseId === exercise.id;
  const hasInstructions = Boolean(exercise.instructions?.trim());
  const restSeconds =
    preference.restSecondsOverride ?? exercise.defaultRestSeconds;
  const equipmentName =
    preference.preferredEquipmentType?.name ??
    exercise.defaultEquipmentType?.name ??
    'Sans équipement';

  async function handleToggleFavorite() {
    setFavoriteError(null);
    const nextFavorite = !preference.isFavorite;
    try {
      await updatePreference.mutateAsync({
        exerciseId: exercise.id,
        input: preferenceToUpdateInput(preference, {
          isFavorite: nextFavorite,
        }),
        optimisticPreference: { ...preference, isFavorite: nextFavorite },
      });
    } catch (error) {
      setFavoriteError(
        getApiErrorMessage(error, 'Impossible de modifier ce favori. Réessaie.'),
      );
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-[var(--space-6)]">
      <PageHeader
        title={exercise.name}
        backTo={backTo}
        backLabel="Exercices"
        className="mb-0"
        actions={
          <ExerciseFavoriteButton
            preference={preference}
            pending={favoritePending}
            onToggle={() => {
              void handleToggleFavorite();
            }}
          />
        }
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ExerciseSourceBadge source={exercise.source} />
          {exercise.archivedAt ? (
            <span className="text-[0.6875rem] font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
              Archivé
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          {exercise.primaryMuscleGroup.name} · {equipmentName}
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {getMeasurementTypeLabel(exercise.measurementType)}
          {restSeconds != null ? ` · Repos conseillé : ${restSeconds} s` : null}
        </p>
        {statusMessage ? (
          <p className="text-sm text-[var(--foreground)]" role="status">
            {statusMessage}
          </p>
        ) : null}
        {favoriteError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {favoriteError}
          </p>
        ) : null}
      </div>

      {exercise.secondaryMuscleGroups.length > 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aussi :{' '}
          {exercise.secondaryMuscleGroups.map((item) => item.name).join(', ')}
        </p>
      ) : null}

      {hasInstructions ? (
        <section>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-left"
            aria-expanded={instructionsOpen}
            onClick={() => setInstructionsOpen((open) => !open)}
          >
            <h2 className="section-title">Instructions</h2>
            <ChevronRight
              className={`size-4 shrink-0 text-[var(--muted-foreground)] transition ${instructionsOpen ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
          {instructionsOpen ? (
            <p className="mt-3 text-sm whitespace-pre-wrap text-[var(--foreground)]">
              {exercise.instructions}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="section-title">Équipement</h2>
        <p className="text-sm text-[var(--foreground)]">{equipmentName}</p>
        {exercise.compatibleEquipmentTypes.length > 1 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Compatibles :{' '}
            {exercise.compatibleEquipmentTypes
              .map((item) => item.equipmentType.name)
              .join(', ')}
          </p>
        ) : null}
      </section>

      <ExercisePreferenceSection exercise={exercise} />

      <section className="flex flex-col gap-2">
        <h2 className="section-title">Progression</h2>
        <Link
          to={`/progress/exercises/${exercise.id}`}
          className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-sm font-medium text-[var(--foreground)]"
        >
          Voir ma progression
          <ChevronRight
            className="size-4 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
        </Link>
      </section>

      <ExercisePersonalRecordsSection
        exerciseId={exercise.id}
        hideProgressCta
      />

      <ExerciseManagementSection
        exercise={exercise}
        onStatus={setStatusMessage}
      />

      <ButtonLink to={backTo} variant="ghost" className="w-fit px-0">
        ← Retour aux exercices
      </ButtonLink>
    </main>
  );
}
