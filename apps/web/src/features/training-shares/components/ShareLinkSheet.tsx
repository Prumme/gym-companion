import { Check, Copy, Share2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { buildShareUrl } from '../api/training-share-api';

type ShareLinkSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  token: string | null;
  expiresAt: string | null;
  loading?: boolean;
  error?: string | null;
};

export function ShareLinkSheet({
  open,
  onClose,
  title,
  token,
  expiresAt,
  loading = false,
  error = null,
}: ShareLinkSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const url = token ? buildShareUrl(token) : '';
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setShareError(null);
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleCopy() {
    if (!url) return;
    setShareError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setShareError('Impossible de copier le lien.');
    }
  }

  async function handleNativeShare() {
    if (!url || !canNativeShare) return;
    setShareError(null);
    try {
      await navigator.share({
        title: 'Gym Companion',
        text: title,
        url,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setShareError('Partage annulé ou indisponible.');
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Valide pendant 1 heure
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--surface)]"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted)]" role="status">
            Génération du lien…
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {token && !loading && !error ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Lien
            </label>
            <input
              readOnly
              value={url}
              className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
            {expiresAt ? (
              <p className="text-xs text-[var(--muted)]">
                Expire à{' '}
                {new Intl.DateTimeFormat('fr-FR', {
                  timeStyle: 'short',
                  dateStyle: 'short',
                }).format(new Date(expiresAt))}
              </p>
            ) : null}
            {shareError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {shareError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1 gap-2"
                onClick={() => void handleCopy()}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied ? 'Lien copié' : 'Copier le lien'}
              </Button>
              {canNativeShare ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={() => void handleNativeShare()}
                >
                  <Share2 className="size-4" aria-hidden="true" />
                  Partager
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
