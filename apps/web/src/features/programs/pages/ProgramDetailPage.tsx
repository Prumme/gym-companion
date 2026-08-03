import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { programDetailQueryOptions } from '../api/program-query-options';
import { ProgramActivationActions } from '../components/ProgramActivationActions';
import { ProgramDangerZone } from '../components/ProgramDangerZone';
import {
  CreateWorkoutTemplateButton,
  WorkoutTemplateCard,
} from '../components/WorkoutTemplateCard';
import { formatProgramUpdatedAt } from '../lib/format';
import { getTrainingGoalLabel } from '../lib/program-labels';

export function ProgramDetailPage() {
  const { programId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);

  const detailQuery = useQuery({
    ...programDetailQueryOptions(programId),
    enabled: Boolean(programId),
  });

  useEffect(() => {
    const flash = (location.state as { flash?: string } | null)?.flash;
    if (flash) {
      setStatus(flash);
      void navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  if (detailQuery.isLoading) {
    return <LoadingState label="Chargement du programme…" />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    const httpStatus = (detailQuery.error as ApiRequestError | undefined)?.status;
    const message =
      httpStatus === 404
        ? 'Ce programme est introuvable ou inaccessible.'
        : getApiErrorMessage(
            detailQuery.error,
            'Impossible de charger ce programme.',
          );

    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to="/programs" variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour aux programmes
        </ButtonLink>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{message}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => void detailQuery.refetch()}
          >
            Réessayer
          </Button>
        </div>
      </main>
    );
  }

  const program = detailQuery.data;
  const isArchived =
    program.status === 'ARCHIVED' || program.archivedAt != null;
  const readOnly = isArchived || !program.permissions.canEdit;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <ButtonLink to="/programs" variant="ghost" className="mb-3 w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour aux programmes
        </ButtonLink>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
            {program.description ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {program.description}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-[var(--muted)]">
              {getTrainingGoalLabel(program.goal)} ·{' '}
              {program.workoutTemplateCount} séance
              {program.workoutTemplateCount === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Modifié le {formatProgramUpdatedAt(program.updatedAt)}
            </p>
          </div>
          <span
            className={
              isArchived
                ? 'rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900'
                : program.isCurrent
                  ? 'rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900'
                  : 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900'
            }
          >
            {isArchived
              ? 'Archivé'
              : program.isCurrent
                ? 'Programme courant'
                : 'Disponible'}
          </span>
        </div>
      </div>

      {status ? (
        <p
          className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
          role="status"
        >
          {status}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!readOnly ? (
          <>
            <ButtonLink
              to={`/programs/${program.id}/edit`}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Modifier les informations
            </ButtonLink>
            <CreateWorkoutTemplateButton
              programId={program.id}
              onStatus={setStatus}
              onCreated={(templateId) => setOpenTemplateId(templateId)}
            />
          </>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Modèles de séance
        </h2>

        {program.workoutTemplates.length === 0 ? (
          <div
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
            role="status"
          >
            <p className="text-sm text-[var(--muted)]">
              Aucune séance dans ce programme pour le moment.
            </p>
          </div>
        ) : null}

        {program.workoutTemplates.map((template, index) => (
          <WorkoutTemplateCard
            key={template.id}
            programId={program.id}
            template={template}
            index={index}
            total={program.workoutTemplates.length}
            readOnly={readOnly}
            defaultOpen={openTemplateId === template.id || index === 0}
            onStatus={setStatus}
          />
        ))}
      </section>

      <ProgramActivationActions program={program} onStatus={setStatus} />

      <ProgramDangerZone
        programId={program.id}
        isArchived={isArchived}
        canArchive={program.permissions.canArchive}
        canRestore={program.permissions.canRestore}
        onStatus={setStatus}
      />
    </main>
  );
}
