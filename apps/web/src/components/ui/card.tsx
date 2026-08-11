import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

type CardProps = PropsWithChildren<{
  className?: string;
  as?: 'div' | 'section' | 'article';
}>;

/** Surface légère — à utiliser seulement quand une vraie surface aide la lecture. */
export function Card({
  children,
  className,
  as: Component = 'div',
}: CardProps) {
  return (
    <Component
      className={cn(
        'rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-4)]',
        className,
      )}
    >
      {children}
    </Component>
  );
}

type CardLinkProps = PropsWithChildren<{
  to: string;
  className?: string;
  'aria-label'?: string;
}>;

export function CardLink({
  to,
  children,
  className,
  ...props
}: CardLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col gap-1 rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-4)] transition-colors hover:bg-[var(--background)]',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
