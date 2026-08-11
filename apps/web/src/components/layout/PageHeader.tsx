import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Affiche le branding produit (Accueil / écran racine uniquement). */
  brand?: boolean;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Top bar compacte pour pages internes.
 * Ne pas répéter « Gym Companion » en header massif hors Accueil.
 */
export function PageHeader({
  title,
  description,
  brand = false,
  backTo,
  backLabel = 'Retour',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-[var(--space-6)] flex items-start justify-between gap-[var(--space-3)]',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {backTo ? (
          <Link
            to={backTo}
            className="mb-[var(--space-2)] inline-flex min-h-11 items-center text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            ← {backLabel}
          </Link>
        ) : null}
        {brand ? (
          <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--muted-foreground)] uppercase">
            Gym Companion
          </p>
        ) : null}
        <h1 className="page-title truncate">{title}</h1>
        {description ? (
          <p className="secondary-text mt-[var(--space-2)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-[var(--space-2)]">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
