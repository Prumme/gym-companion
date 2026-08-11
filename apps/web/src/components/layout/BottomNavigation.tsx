import { Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import {
  isNavItemActive,
  moreNavItems,
  primaryNavItems,
} from '@/app/navigation/nav-config';
import { cn } from '@/lib/utils';

type BottomNavigationProps = {
  pathname: string;
  onOpenMore: () => void;
  moreOpen: boolean;
};

export function BottomNavigation({
  pathname,
  onOpenMore,
  moreOpen,
}: BottomNavigationProps) {
  const moreSectionActive = moreNavItems.some((item) =>
    isNavItemActive(item, pathname),
  );
  const plusActive = moreOpen || moreSectionActive;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <ul className="mx-auto grid h-[var(--bottom-nav-height)] max-w-lg grid-cols-4 items-stretch px-1">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.id} className="min-w-0">
              <NavLink
                to={item.to}
                end={item.end}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]',
                  active
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)]',
                )}
              >
                <Icon
                  className={cn('size-5 shrink-0', active && 'stroke-[2.5px]')}
                  aria-hidden="true"
                />
                <span className="max-w-full truncate">{item.label}</span>
                {active ? (
                  <span
                    className="mt-0.5 h-0.5 w-4 rounded-full bg-[var(--primary)]"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="mt-0.5 h-0.5 w-4" aria-hidden="true" />
                )}
              </NavLink>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            onClick={onOpenMore}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-controls="more-menu-sheet"
            aria-current={moreSectionActive ? 'true' : undefined}
            className={cn(
              'flex h-full w-full min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]',
              plusActive
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)]',
            )}
          >
            <Menu
              className={cn('size-5 shrink-0', plusActive && 'stroke-[2.5px]')}
              aria-hidden="true"
            />
            <span>Plus</span>
            {plusActive ? (
              <span
                className="mt-0.5 h-0.5 w-4 rounded-full bg-[var(--primary)]"
                aria-hidden="true"
              />
            ) : (
              <span className="mt-0.5 h-0.5 w-4" aria-hidden="true" />
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
