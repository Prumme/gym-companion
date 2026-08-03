import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { exerciseDetailQueryOptions } from '../api/exercise-query-options';
import { ExerciseSourceBadge } from '../components/ExerciseSourceBadge';
import { getMeasurementTypeLabel } from '../lib/exercise-labels';

type DetailLocationState = {
  from?: string;
};

export function ExerciseDetailPage() {
  const { exerciseId = '' } = useParams();
  const location = useLocation();
  const backTo =
    (location.state as DetailLocationState | null)?.from ?? '/exercises';
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
        ? 'Exercice introuvable ou inaccessible.'
        : getApiErrorMessage(
            detailQuery.error,
            'Impossible de charger cet exercice.',
          );

    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to={backTo} variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au catalogue
        </ButtonLink>
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-[var(--danger)]">{message}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
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

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <ButtonLink to={backTo} variant="ghost" className="mb-3 w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au catalogue
        </ButtonLink>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{exercise.name}</h1>
          {preference.isFavorite ? (
            <span className="inline-flex items-center gap-1 text-amber-600" title="Favori">
              <Star className="size-5 fill-current" aria-hidden="true" />
              <span className="sr-only">Favori</span>
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <ExerciseSourceBadge source={exercise.source} />
          {exercise.archivedAt ? (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              Archivé
            </span>
          ) : null}
        </div>
      </div>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Général
        </h2>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Groupe principal</dt>
            <dd className="font-medium">{exercise.primaryMuscleGroup.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Muscles secondaires</dt>
            <dd className="font-medium">
              {exercise.secondaryMuscleGroups.length > 0
                ? exercise.secondaryMuscleGroups.map((item) => item.name).join(', ')
                : 'Aucun'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Type de mesure</dt>
            <dd className="font-medium">
              {getMeasurementTypeLabel(exercise.measurementType)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Équipement par défaut</dt>
            <dd className="font-medium">
              {exercise.defaultEquipmentType?.name ?? 'Sans équipement'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Équipements compatibles</dt>
            <dd className="font-medium">
              {exercise.compatibleEquipmentTypes.length > 0
                ? exercise.compatibleEquipmentTypes
                    .map((item) => item.equipmentType.name)
                    .join(', ')
                : 'Aucun'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Repos par défaut</dt>
            <dd className="font-medium">
              {exercise.defaultRestSeconds != null
                ? `${exercise.defaultRestSeconds} s`
                : 'Non défini'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Instructions
        </h2>
        <p className="text-sm whitespace-pre-wrap">
          {exercise.instructions?.trim() || 'Aucune instruction.'}
        </p>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Préférences personnelles
        </h2>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Favori</dt>
            <dd className="font-medium">{preference.isFavorite ? 'Oui' : 'Non'}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Équipement préféré</dt>
            <dd className="font-medium">
              {preference.preferredEquipmentType?.name ?? 'Non défini'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Repos personnel</dt>
            <dd className="font-medium">
              {preference.restSecondsOverride != null
                ? `${preference.restSecondsOverride} s`
                : 'Non défini'}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Lecture seule — l’édition des préférences arrivera dans un prochain jalon.
        </p>
      </section>
    </main>
  );
}
