import type { ExerciseMedia } from '@gym-companion/shared';
import { Pause, Play, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { ViewportPortal } from '@/components/ui/viewport-portal';
import { cn } from '@/lib/utils';

import {
  EXERCISE_MEDIA_FRAME_INTERVAL_MS,
  getExerciseMediaFrameLabel,
  getNextExerciseMediaFrameIndex,
  prefersReducedMotion,
} from '../lib/exercise-media';

type ExerciseMediaSheetProps = {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  media: ExerciseMedia;
};

const iconButtonClassName =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

/**
 * Démonstration d’un exercice : les images (départ → fin) défilent en boucle.
 * Si l’utilisateur réduit les animations, la lecture ne démarre pas d’elle-même.
 */
export function ExerciseMediaSheet({
  open,
  onClose,
  exerciseName,
  media,
}: ExerciseMediaSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameCount = media.frames.length;
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Indexé par URL (et non remis à zéro à l’ouverture) : une image déjà en cache
  // peut déclencher `load` avant les effets, et reste valable d’une ouverture à l’autre.
  const [loadedFrames, setLoadedFrames] = useState<ReadonlySet<string>>(() => new Set());
  // L’animation ne démarre qu’une fois toutes les images chargées : sinon le
  // cadre resterait vide alors que les libellés Départ / Fin défilent déjà.
  const ready = media.frames.every((frame) => loadedFrames.has(frame));

  useEffect(() => {
    if (!open) return;
    setFrameIndex(0);
    setLoadError(false);
    setPlaying(!prefersReducedMotion());
  }, [open, media]);

  function markFrameLoaded(frame: string) {
    setLoadedFrames((current) => {
      if (current.has(frame)) return current;
      const next = new Set(current);
      next.add(frame);
      return next;
    });
  }

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

  useEffect(() => {
    if (!open || !playing || !ready || loadError || frameCount <= 1) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => getNextExerciseMediaFrameIndex(current, frameCount));
    }, EXERCISE_MEDIA_FRAME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, playing, ready, loadError, frameCount]);

  if (!open) {
    return null;
  }

  const currentLabel = getExerciseMediaFrameLabel(frameIndex, frameCount);

  return (
    <ViewportPortal>
      <div className="fixed inset-0 z-50" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-[var(--foreground)]/40"
          aria-label="Fermer"
          tabIndex={-1}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] pt-[var(--space-4)] shadow-lg md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-surface)]"
          style={{ paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mb-[var(--space-3)] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
                Démonstration
              </p>
              <h2 id={titleId} className="section-title">
                {exerciseName}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className={iconButtonClassName}
              aria-label="Fermer la démonstration"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {loadError ? (
            <p
              className="rounded-[var(--radius-control)] border border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]"
              role="alert"
            >
              Impossible de charger la démonstration. Vérifie ta connexion puis réessaie.
            </p>
          ) : (
            <figure className="flex flex-col gap-3">
              <div
                className="relative aspect-[3/2] w-full overflow-hidden rounded-[var(--radius-control)] bg-[var(--background)]"
                aria-busy={!ready}
              >
                {media.frames.map((frame, index) => (
                  <img
                    key={frame}
                    src={frame}
                    alt={
                      index === frameIndex
                        ? `${exerciseName} — ${getExerciseMediaFrameLabel(index, frameCount).toLowerCase()} du mouvement`
                        : ''
                    }
                    aria-hidden={index === frameIndex ? undefined : true}
                    decoding="async"
                    className={cn(
                      'absolute inset-0 size-full object-contain transition-opacity duration-300 motion-reduce:transition-none',
                      ready && index === frameIndex ? 'opacity-100' : 'opacity-0',
                    )}
                    onLoad={() => markFrameLoaded(frame)}
                    onError={() => setLoadError(true)}
                  />
                ))}
                {ready ? (
                  <span
                    className="absolute top-2 left-2 rounded-full bg-[var(--surface)]/90 px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]"
                    aria-live={playing ? 'off' : 'polite'}
                  >
                    {currentLabel}
                  </span>
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted-foreground)] motion-safe:animate-pulse">
                    Chargement de la démonstration…
                  </p>
                )}
              </div>

              {frameCount > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(iconButtonClassName, 'border border-[var(--border)]')}
                    aria-label={
                      playing ? 'Mettre la démonstration en pause' : 'Lire la démonstration'
                    }
                    aria-pressed={playing}
                    onClick={() => setPlaying((value) => !value)}
                  >
                    {playing ? (
                      <Pause className="size-5" aria-hidden="true" />
                    ) : (
                      <Play className="size-5" aria-hidden="true" />
                    )}
                  </button>
                  <div className="flex flex-1 gap-2" role="group" aria-label="Étapes du mouvement">
                    {media.frames.map((frame, index) => (
                      <button
                        key={frame}
                        type="button"
                        aria-pressed={index === frameIndex}
                        className={cn(
                          'min-h-11 flex-1 rounded-[var(--radius-control)] border px-3 text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                          index === frameIndex
                            ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]',
                        )}
                        onClick={() => {
                          setPlaying(false);
                          setFrameIndex(index);
                        }}
                      >
                        {getExerciseMediaFrameLabel(index, frameCount)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <figcaption className="text-xs text-[var(--muted-foreground)]">
                Repère visuel indicatif : l’équipement de ta salle peut différer. Images{' '}
                <a
                  href={media.attribution.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {media.attribution.sourceName}
                </a>{' '}
                ({media.attribution.license}).
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </ViewportPortal>
  );
}
