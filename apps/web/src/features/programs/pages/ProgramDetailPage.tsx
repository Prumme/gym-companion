import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';
import { ShareLinkSheet } from '@/features/training-shares/components/ShareLinkSheet';
import { useCreateProgramShareMutation } from '@/features/training-shares/hooks/use-training-share-mutations';
import { getTrainingShareErrorMessage } from '@/features/training-shares/lib/share-format';

import { programDetailQueryOptions } from '../api/program-query-options';
import { ProgramActivationActions } from '../components/ProgramActivationActions';
import { DeactivateProgramDialog } from '../components/ProgramActivationDialog';
import { ProgramDangerZone } from '../components/ProgramDangerZone';
import {
  CreateWorkoutTemplateButton,
  WorkoutTemplateCard,
} from '../components/WorkoutTemplateCard';
import { StatusBadge } from '../components/ContextMenu';
import { useDeactivateProgramMutation } from '../hooks/use-program-mutations';
import { getTrainingGoalLabel } from '../lib/program-labels';

export function ProgramDetailPage() {
  const { programId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const deactivateMutation = useDeactivateProgramMutation();
  const shareMutation = useCreateProgramShareMutation();

  const editingTemplateId = searchParams.get('templateId');

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

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const program = detailQuery.data;
  const editingTemplate = useMemo(() => {
    if (!program || !editingTemplateId) return null;
    return (
      program.workoutTemplates.find(
        (template) => template.id === editingTemplateId,
      ) ?? null
    );
  }, [program, editingTemplateId]);

  if (detailQuery.isLoading) {
    return <LoadingState label="Chargement du programme…" />;
  }

  if (detailQuery.isError || !program) {
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
          Programmes
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

  const isArchived =
    program.status === 'ARCHIVED' || program.archivedAt != null;
  const readOnly = isArchived || !program.permissions.canEdit;
  const currentProgram = program;

  function openTemplate(templateId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('templateId', templateId);
    setSearchParams(next, { replace: false });
  }

  function closeTemplate() {
    const next = new URLSearchParams(searchParams);
    next.delete('templateId');
    setSearchParams(next, { replace: false });
  }

  async function handleDeactivate() {
    setDeactivateError(null);
    try {
      await deactivateMutation.mutateAsync(currentProgram.id);
      setDeactivateOpen(false);
      setStatus('Programme courant désactivé.');
    } catch (err) {
      setDeactivateError(
        getApiErrorMessage(err, 'Impossible de désactiver ce programme.'),
      );
    }
  }

  async function handleShareProgram() {
    setMenuOpen(false);
    setShareOpen(true);
    setShareToken(null);
    setShareExpiresAt(null);
    setShareError(null);
    try {
      const result = await shareMutation.mutateAsync(currentProgram.id);
      setShareToken(result.token);
      setShareExpiresAt(result.expiresAt);
    } catch (err) {
      setShareError(
        getTrainingShareErrorMessage(
          err,
          'Impossible de générer le lien de partage.',
        ),
      );
    }
  }

  if (editingTemplate) {
    const templateIndex = program.workoutTemplates.findIndex(
      (item) => item.id === editingTemplate.id,
    );
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
        {status ? (
          <p
            className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
            role="status"
          >
            {status}
          </p>
        ) : null}
        <WorkoutTemplateCard
          programId={program.id}
          template={editingTemplate}
          index={Math.max(0, templateIndex)}
          total={program.workoutTemplates.length}
          readOnly={readOnly}
          mode="focused"
          programName={program.name}
          onBack={closeTemplate}
          onStatus={setStatus}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
      <header className="flex items-start gap-2">
        <Link
          to="/programs"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label="Retour aux programmes"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{program.name}</h1>
            {program.isCurrent ? (
              <StatusBadge tone="active">Actif</StatusBadge>
            ) : isArchived ? (
              <StatusBadge tone="archived">Archivé</StatusBadge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {getTrainingGoalLabel(program.goal)} ·{' '}
            {program.workoutTemplateCount} séance
            {program.workoutTemplateCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <Button
            type="button"
            variant="ghost"
            className="size-11 min-h-11 px-0"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label="Actions du programme"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
            >
              {!readOnly ? (
                <Link
                  role="menuitem"
                  to={`/programs/${program.id}/edit`}
                  className="block rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-sm hover:bg-[var(--background)]"
                  onClick={() => setMenuOpen(false)}
                >
                  Modifier les informations
                </Link>
              ) : null}
              <Link
                role="menuitem"
                to={`/programs/${program.id}/schedule`}
                className="block rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-sm hover:bg-[var(--background)]"
                onClick={() => setMenuOpen(false)}
              >
                Planning
              </Link>
              {!isArchived ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)] disabled:opacity-50"
                  disabled={shareMutation.isPending}
                  onClick={() => {
                    void handleShareProgram();
                  }}
                >
                  Partager
                </button>
              ) : null}
              {program.isCurrent && program.permissions.canDeactivate ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--background)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeactivateError(null);
                    setDeactivateOpen(true);
                  }}
                >
                  Désactiver
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {status ? (
        <p
          className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
          role="status"
        >
          {status}
        </p>
      ) : null}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Séances
        </h2>

        {program.workoutTemplates.length === 0 ? (
          <div className="mt-3 space-y-3">
            <EmptyState
              title="Aucune séance"
              description="Commence par créer la première séance de ton programme."
            />
            {!readOnly ? (
              <CreateWorkoutTemplateButton
                programId={program.id}
                onStatus={setStatus}
                onCreated={(templateId) => openTemplate(templateId)}
              />
            ) : null}
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {program.workoutTemplates.map((template) => {
              const setCount = template.exercises.reduce(
                (sum, exercise) => sum + exercise.sets.length,
                0,
              );
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    className="flex w-full min-h-14 items-center justify-between gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                    onClick={() => openTemplate(template.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {template.exerciseCount} exercice
                        {template.exerciseCount === 1 ? '' : 's'}
                        {' · '}
                        {setCount} série{setCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-5 shrink-0 text-[var(--muted)]"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!readOnly && program.workoutTemplates.length > 0 ? (
          <div className="mt-3">
            <CreateWorkoutTemplateButton
              programId={program.id}
              onStatus={setStatus}
              onCreated={(templateId) => openTemplate(templateId)}
            />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Planning
        </h2>
        <Link
          to="/planning"
          className="mt-2 flex min-h-11 items-center justify-between gap-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          Voir le planning
          <span className="text-[var(--muted)]" aria-hidden="true">
            →
          </span>
        </Link>
      </section>

      <ProgramActivationActions program={program} onStatus={setStatus} />

      <ProgramDangerZone
        programId={program.id}
        isArchived={isArchived}
        canArchive={program.permissions.canArchive}
        canRestore={program.permissions.canRestore}
        onStatus={setStatus}
      />

      <DeactivateProgramDialog
        open={deactivateOpen}
        programName={program.name}
        pending={deactivateMutation.isPending}
        error={deactivateError}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => setDeactivateOpen(false)}
      />

      <ShareLinkSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Partager le programme"
        token={shareToken}
        expiresAt={shareExpiresAt}
        loading={shareMutation.isPending && !shareToken && !shareError}
        error={shareError}
      />
    </main>
  );
}
