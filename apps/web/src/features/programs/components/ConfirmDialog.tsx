import { useId } from 'react';

import { Button } from '@/components/ui/button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  error = null,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!pending) {
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'primary'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'En cours…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
