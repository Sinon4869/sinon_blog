import { describe, expect, it } from 'vitest';

import { enforceRateLimit } from '../lib/rate-limit';

describe('rate limit', () => {
  it('should limit after threshold in the same window', () => {
    const key = `test-key-${Date.now()}`;
    expect(enforceRateLimit(key, 2, 1000).ok).toBe(true);
    expect(enforceRateLimit(key, 2, 1000).ok).toBe(true);
    expect(enforceRateLimit(key, 2, 1000).ok).toBe(false);
  });
});
