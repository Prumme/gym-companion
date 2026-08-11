import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ContextMenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type ContextMenuProps = {
  label: string;
  items: ContextMenuItem[];
  className?: string;
};

export function ContextMenu({ label, items, className }: ContextMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={cn('relative shrink-0', className)} ref={rootRef}>
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--foreground)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                'block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)] disabled:opacity-50',
                item.destructive && 'text-[var(--danger)]',
              )}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type StatusBadgeProps = {
  children: ReactNode;
  tone?: 'neutral' | 'active' | 'archived';
};

export function StatusBadge({
  children,
  tone = 'neutral',
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[var(--radius-control)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'active' &&
          'bg-[var(--primary)] text-[var(--primary-foreground)]',
        tone === 'archived' &&
          'border border-amber-300 bg-amber-50 text-amber-900',
        tone === 'neutral' &&
          'border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]',
      )}
    >
      {children}
    </span>
  );
}
