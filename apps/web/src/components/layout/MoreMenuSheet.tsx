import { useEffect, useId, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';

import {
  isNavItemActive,
  moreNavGroups,
} from '@/app/navigation/nav-config';
import { cn } from '@/lib/utils';

type MoreMenuSheetProps = {
  open: boolean;
  onClose: () => void;
  pathname: string;
};

export function MoreMenuSheet({ open, onClose, pathname }: MoreMenuSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <div
        id="more-menu-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] pt-[var(--space-4)] shadow-lg"
        style={{
          paddingBottom:
            'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-3">
          <h2 id={titleId} className="section-title">
            Plus
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-[var(--space-5)] pb-[var(--space-2)]">
          {moreNavGroups.map((group) => (
            <section key={group.id} aria-labelledby={`more-group-${group.id}`}>
              <h3
                id={`more-group-${group.id}`}
                className="mb-2 px-1 text-[0.6875rem] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
              >
                {group.label}
              </h3>
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item, pathname);
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-12 items-center gap-3 border-b border-[var(--border)] px-1 py-2',
                          active
                            ? 'text-[var(--foreground)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--background)]',
                        )}
                      >
                        <Icon
                          className="size-5 shrink-0 text-[var(--muted-foreground)]"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {item.label}
                          </span>
                          {item.description ? (
                            <span className="block text-xs text-[var(--muted-foreground)]">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-[var(--muted-foreground)]"
                          aria-hidden="true"
                        />
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
