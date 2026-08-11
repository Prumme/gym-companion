import type { ReactNode } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  className?: string;
};

/**
 * Empty state compact — une seule surface, pas de CTA dupliqué hors composant.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-start gap-[var(--space-3)] rounded-[var(--radius-surface)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-[var(--space-6)]',
        className,
      )}
    >
      {icon ? (
        <div className="text-[var(--muted-foreground)]" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h2 className="section-title">{title}</h2>
        {description ? (
          <p className="secondary-text max-w-md">{description}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          {action ? (
            action.to ? (
              <ButtonLink to={action.to}>{action.label}</ButtonLink>
            ) : (
              <Button type="button" onClick={action.onClick}>
                {action.label}
              </Button>
            )
          ) : null}
          {secondaryAction ? (
            secondaryAction.to ? (
              <ButtonLink to={secondaryAction.to} variant="secondary">
                {secondaryAction.label}
              </ButtonLink>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
