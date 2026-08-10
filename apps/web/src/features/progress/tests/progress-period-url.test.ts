import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { todayLocalDateString } from '@/features/programs/lib/schedule-utils';

import { progressQueryKeys } from '../api/progress-query-keys';
import {
  buildOverviewSearchParams,
  parseOverviewSearchParams,
} from '../lib/overview-filters';
import {
  buildProgressSearchParams,
  parseProgressSearchParams,
  resolvePresetRange,
} from '../lib/progress-filters';

describe('progress period URL (Tout)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sans paramètres → défaut 3 mois', () => {
    const today = todayLocalDateString();
    const parsed = parseProgressSearchParams(new URLSearchParams());
    const expected = resolvePresetRange('3m', today);
    expect(parsed.period).toBe('3m');
    expect(parsed.from).toBe(expected.from);
    expect(parsed.to).toBe(expected.to);
  });

  it('period=all → tout l’historique (from/to absents)', () => {
    const parsed = parseProgressSearchParams(
      new URLSearchParams('period=all'),
    );
    expect(parsed).toEqual({
      metric: undefined,
      from: undefined,
      to: undefined,
      period: 'all',
    });
  });

  it('build period=all écrit le sentinel sans from/to', () => {
    const params = buildProgressSearchParams({
      period: 'all',
      metric: 'MAX_WEIGHT',
    });
    expect(params.get('period')).toBe('all');
    expect(params.get('from')).toBeNull();
    expect(params.get('to')).toBeNull();
    expect(params.get('metric')).toBe('MAX_WEIGHT');
  });

  it('round-trip Tout conserve period=all après rebuild/parse', () => {
    const built = buildProgressSearchParams({ period: 'all' });
    const parsed = parseProgressSearchParams(built);
    expect(parsed.period).toBe('all');
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });

  it('period=all prime sur from/to éventuels', () => {
    const parsed = parseProgressSearchParams(
      new URLSearchParams('period=all&from=2026-01-01&to=2026-08-01'),
    );
    expect(parsed.period).toBe('all');
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });

  it('preset 30 jours via from/to reste détecté', () => {
    const range = resolvePresetRange('30d', todayLocalDateString());
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
    });
    const parsed = parseProgressSearchParams(params);
    expect(parsed.period).toBe('30d');
    expect(parsed.from).toBe(range.from);
    expect(parsed.to).toBe(range.to);
  });

  it('période personnalisée conserve from/to', () => {
    const parsed = parseProgressSearchParams(
      new URLSearchParams('from=2026-02-01&to=2026-03-15'),
    );
    expect(parsed.period).toBe('custom');
    expect(parsed.from).toBe('2026-02-01');
    expect(parsed.to).toBe('2026-03-15');
  });

  it('query keys 3 mois ≠ Tout', () => {
    const three = resolvePresetRange('3m', todayLocalDateString());
    const key3m = progressQueryKeys.exercise('ex-1', {
      from: three.from,
      to: three.to,
    });
    const keyAll = progressQueryKeys.exercise('ex-1', {
      from: undefined,
      to: undefined,
    });
    const strength3m = progressQueryKeys.exerciseStrength('ex-1', {
      from: three.from,
      to: three.to,
    });
    const strengthAll = progressQueryKeys.exerciseStrength('ex-1', {
      from: undefined,
      to: undefined,
    });
    const overview3m = progressQueryKeys.overview({
      from: three.from,
      to: three.to,
    });
    const overviewAll = progressQueryKeys.overview({});

    expect(key3m).not.toEqual(keyAll);
    expect(strength3m).not.toEqual(strengthAll);
    expect(overview3m).not.toEqual(overviewAll);
  });
});

describe('overview period URL (Tout)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sans paramètres → défaut 3 mois', () => {
    const parsed = parseOverviewSearchParams(new URLSearchParams());
    expect(parsed.period).toBe('3m');
    expect(parsed.from).toBeDefined();
    expect(parsed.to).toBeDefined();
  });

  it('period=all → tout', () => {
    const parsed = parseOverviewSearchParams(
      new URLSearchParams('period=all'),
    );
    expect(parsed.period).toBe('all');
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });

  it('build/parse round-trip Tout', () => {
    const built = buildOverviewSearchParams({
      period: 'all',
      metric: 'TOTAL_REPS',
    });
    expect(built.get('period')).toBe('all');
    expect(built.get('metric')).toBe('TOTAL_REPS');
    expect(built.get('from')).toBeNull();
    const parsed = parseOverviewSearchParams(built);
    expect(parsed.period).toBe('all');
    expect(parsed.metric).toBe('TOTAL_REPS');
  });
});
