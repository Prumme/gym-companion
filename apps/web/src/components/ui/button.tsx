import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-[var(--primary)] text-[var(--primary-foreground)]',
  secondary: 'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]',
  ghost: 'bg-transparent text-[var(--muted)]',
} as const;

type Variant = keyof typeof variants;

const baseClass =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] px-4 text-sm font-semibold transition disabled:opacity-50';

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
