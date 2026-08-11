import { describe, expect, it } from 'vitest';

import {
  FORBIDDEN_BOTTOM_NAV_PATHS,
  isFocusModePath,
  isNavItemActive,
  moreNavGroups,
  moreNavItems,
  primaryNavItems,
} from './nav-config';

describe('nav-config', () => {
  it('primary nav has exactly 3 métier destinations', () => {
    expect(primaryNavItems).toHaveLength(3);
    expect(primaryNavItems.map((i) => i.id)).toEqual([
      'home',
      'training',
      'progress',
    ]);
  });

  it('forbids secondary destinations in bottom nav paths list', () => {
    expect(FORBIDDEN_BOTTOM_NAV_PATHS).toContain('/records');
    expect(FORBIDDEN_BOTTOM_NAV_PATHS).toContain('/planning');
    expect(FORBIDDEN_BOTTOM_NAV_PATHS).not.toContain('/');
    expect(FORBIDDEN_BOTTOM_NAV_PATHS).not.toContain('/training');
  });

  it('marks training active on nested workout routes', () => {
    const training = primaryNavItems.find((i) => i.id === 'training')!;
    expect(isNavItemActive(training, '/training')).toBe(true);
    expect(isNavItemActive(training, '/planning')).toBe(true);
    expect(isNavItemActive(training, '/programs/abc')).toBe(true);
    expect(isNavItemActive(training, '/workouts')).toBe(true);
    expect(isNavItemActive(training, '/')).toBe(false);
  });

  it('marks progress active on records and overview', () => {
    const progress = primaryNavItems.find((i) => i.id === 'progress')!;
    expect(isNavItemActive(progress, '/progress')).toBe(true);
    expect(isNavItemActive(progress, '/progress/overview')).toBe(true);
    expect(isNavItemActive(progress, '/records')).toBe(true);
    expect(isNavItemActive(progress, '/exercises')).toBe(false);
  });

  it('detects focus mode on active workout', () => {
    expect(isFocusModePath('/workouts/active')).toBe(true);
    expect(isFocusModePath('/workouts')).toBe(false);
    expect(isFocusModePath('/training')).toBe(false);
  });

  it('more menu includes exercises shared coach profile', () => {
    expect(moreNavItems.map((i) => i.id)).toEqual([
      'exercises',
      'shared',
      'coach',
      'profile',
    ]);
  });

  it('more menu is organized in groups without settings', () => {
    expect(moreNavGroups.map((g) => g.id)).toEqual([
      'training-more',
      'coaching-more',
      'account-more',
    ]);
    expect(
      moreNavItems.some((item) => item.to.includes('settings')),
    ).toBe(false);
  });
});
