import { describe, expect, it } from 'vitest';

import {
  buildProgressChartAxisLabels,
  createDedupedAxisTickFormatter,
  formatProgressChartTime,
} from '../lib/progress-filters';

describe('buildProgressChartAxisLabels', () => {
  it('conserve le label date seul quand chaque jour est unique', () => {
    const labels = buildProgressChartAxisLabels(
      [
        { localDate: '2025-08-10', startedAt: '2025-08-10T08:00:00.000Z' },
        { localDate: '2025-08-11', startedAt: '2025-08-11T08:00:00.000Z' },
      ],
      'short',
    );

    expect(labels).toHaveLength(2);
    expect(labels[0]).not.toMatch(/\d{2}:\d{2}/);
    expect(labels[1]).not.toMatch(/\d{2}:\d{2}/);
    expect(labels[0]).not.toEqual(labels[1]);
  });

  it('ajoute l’heure quand plusieurs points partagent le même jour', () => {
    const labels = buildProgressChartAxisLabels(
      [
        { localDate: '2025-08-11', startedAt: '2025-08-11T08:00:00.000Z' },
        { localDate: '2025-08-11', startedAt: '2025-08-11T17:30:00.000Z' },
      ],
      'short',
    );

    expect(labels[0]).toContain(formatProgressChartTime('2025-08-11T08:00:00.000Z'));
    expect(labels[1]).toContain(formatProgressChartTime('2025-08-11T17:30:00.000Z'));
    expect(labels[0]).not.toEqual(labels[1]);
  });
});

describe('createDedupedAxisTickFormatter', () => {
  it('masque les labels consécutifs identiques', () => {
    const format = createDedupedAxisTickFormatter();
    expect(format('11 août')).toBe('11 août');
    expect(format('11 août')).toBe('');
    expect(format('12 août')).toBe('12 août');
  });
});
