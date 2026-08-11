import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={inputId}>
      <span className="font-medium text-[var(--foreground)]">{label}</span>
      <input
        id={inputId}
        className={cn(
          'min-h-12 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[0.9375rem] outline-none transition focus:border-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
          error && 'border-[var(--danger)]',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-sm text-[var(--danger)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
