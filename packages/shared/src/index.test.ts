import { describe, expect, it } from 'vitest';

import { createSuccessResponse, type MuscleGroupReference } from './index';

describe('createSuccessResponse', () => {
  it('wraps data in a standard success envelope', () => {
    expect(createSuccessResponse({ id: '1' })).toEqual({ data: { id: '1' } });
  });

  it('supports reference list envelopes', () => {
    const groups: MuscleGroupReference[] = [
      { id: '1', code: 'chest', name: 'Pectoraux', parentId: null },
    ];
    expect(createSuccessResponse(groups)).toEqual({ data: groups });
  });
});
