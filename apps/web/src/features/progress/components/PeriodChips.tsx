import { cn } from '@/lib/utils';

import type { ProgressPeriodPreset } from '../lib/progress-filters';

const PERIOD_CHIP_OPTIONS: Array<{
  value: ProgressPeriodPreset;
  label: string;
}> = [
  { value: '30d', label: '1 mois' },
  { value: '3m', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '1 an' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Perso.' },
];

type PeriodChipsProps = {
  value: ProgressPeriodPreset | string;
  onChange: (period: ProgressPeriodPreset) => void;
  /** Masquer l’option Personnalisé si non utile. */
  includeCustom?: boolean;
  className?: string;
};

export function PeriodChips({
  value,
  onChange,
  includeCustom = true,
  className,
}: PeriodChipsProps) {
  const options = includeCustom
    ? PERIOD_CHIP_OPTIONS
    : PERIOD_CHIP_OPTIONS.filter((option) => option.value !== 'custom');

  return (
    <div className={cn('max-w-full min-w-0 overflow-hidden', className)}>
      <div
        role="group"
        aria-label="Période"
        className={cn(
          'flex gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth',
          'snap-x snap-mandatory scroll-px-1 px-0.5 pb-0.5',
          '[-ms-overflow-style:none] [scrollbar-width:none]',
          '[&::-webkit-scrollbar]:hidden',
        )}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                'inline-flex min-h-11 shrink-0 snap-start items-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium transition outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                selected
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
        {/* Spacer : dernier chip entièrement accessible en fin de scroll */}
        <span className="w-1 shrink-0 snap-end" aria-hidden="true" />
      </div>
    </div>
  );
}
