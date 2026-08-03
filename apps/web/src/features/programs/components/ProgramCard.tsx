import type { ProgramListItem } from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import { getTrainingGoalLabel } from '../lib/program-labels';
import {
  formatProgramUpdatedAt,
  formatShortDescription,
} from '../lib/format';

type ProgramCardProps = {
  program: ProgramListItem;
};

export function ProgramCard({ program }: ProgramCardProps) {
  const isArchived = program.status === 'ARCHIVED' || program.archivedAt != null;
  const shortDescription = formatShortDescription(program.description);

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/programs/${program.id}`}
            className="rounded-[var(--radius)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            aria-label={`Ouvrir le programme ${program.name}`}
          >
            <h2 className="text-base font-semibold leading-snug">{program.name}</h2>
          </Link>
          {shortDescription ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{shortDescription}</p>
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
            program.isCurrent
              ? 'shrink-0 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950'
              : isArchived
                ? 'shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900'
                : 'shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900'
          }
        >
          {program.isCurrent
            ? 'Programme courant'
            : isArchived
              ? 'Archivé'
              : 'Disponible'}
        </span>
      </div>
    </article>
  );
}
