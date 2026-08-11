import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

import { cn } from '@/lib/utils';

const variants = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-95',
  secondary:
    'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]',
  ghost: 'bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]',
  destructive:
    'border border-[var(--danger)]/30 bg-[var(--danger)]/5 text-[var(--danger)] hover:bg-[var(--danger)]/10',
} as const;

type Variant = keyof typeof variants;

const baseClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
  }
>;

export function Button({
  children,
  className,
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(baseClass, variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = PropsWithChildren<
  LinkProps & {
    variant?: Variant;
    className?: string;
  }
>;

export function ButtonLink({
  children,
  className,
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(baseClass, variants[variant], className)} {...props}>
      {children}
    </Link>
  );
}
