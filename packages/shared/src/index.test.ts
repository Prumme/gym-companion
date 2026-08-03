import { describe, expect, it } from 'vitest';

import { createSuccessResponse } from './index';

describe('createSuccessResponse', () => {
  it('wraps data in a standard success envelope', () => {
    expect(createSuccessResponse({ id: '1' })).toEqual({ data: { id: '1' } });
  });
});
