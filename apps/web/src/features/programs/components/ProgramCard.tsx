import type { ProgramListItem } from '@gym-companion/shared';
import { Link, useNavigate } from 'react-router-dom';

import { getTrainingGoalLabel } from '../lib/program-labels';
import { ContextMenu, StatusBadge } from './ContextMenu';

type ProgramCardProps = {
  program: ProgramListItem;
};

export function ProgramCard({ program }: ProgramCardProps) {
  const navigate = useNavigate();
  const isArchived = program.status === 'ARCHIVED' || program.archivedAt != null;

  const menuItems = [
    {
      label: 'Voir le détail',
      onSelect: () => {
        void navigate(`/programs/${program.id}`);
      },
    },
    ...(program.permissions.canEdit
      ? [
          {
            label: 'Modifier',
            onSelect: () => {
              void navigate(`/programs/${program.id}/edit`);
            },
          },
        ]
      : []),
  ];

  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-1">
        <Link
          to={`/programs/${program.id}`}
          className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 py-3 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label={`Ouvrir le programme ${program.name}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold tracking-tight">
                {program.name}
              </h2>
              {program.isCurrent ? (
                <StatusBadge tone="active">Actif</StatusBadge>
              ) : isArchived ? (
                <StatusBadge tone="archived">Archivé</StatusBadge>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {program.workoutTemplateCount} séance
              {program.workoutTemplateCount === 1 ? '' : 's'}
              {' · '}
              {getTrainingGoalLabel(program.goal)}
            </p>
          </div>
        </Link>
        <ContextMenu
          label={`Actions pour ${program.name}`}
          items={menuItems}
        />
      </div>
    </li>
  );
}
