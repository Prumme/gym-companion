import { cn } from '@/lib/utils';

type SharedPresenceDotProps = {
  online: boolean | null;
  /** null = présence inconnue (socket down) */
  className?: string;
};

export function SharedPresenceDot({ online, className }: SharedPresenceDotProps) {
  const label =
    online === null ? 'Présence inconnue' : online ? 'En ligne' : 'Hors ligne';

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs text-[var(--muted)]', className)}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-2 shrink-0 rounded-full',
          online === true
            ? 'bg-[var(--primary)]'
            : 'bg-[var(--muted)]/50',
        )}
      />
      <span className="sr-only sm:not-sr-only sm:inline">{label}</span>
    </span>
  );
}
