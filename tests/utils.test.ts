import { describe, expect, it } from 'vitest';

import { buildPostPath, slugify } from '../lib/utils';

describe('utils', () => {
  it('slugify should normalize text', () => {
    expect(slugify(' Hello World!! ')).toBe('hello-world');
    expect(slugify('中文 标题')).toBe('中文-标题');
  });

  it('buildPostPath should include yyyy/mm/dd/id', () => {
    const path = buildPostPath({ id: 'abc 123', publishedAt: '2026-03-01T00:00:00.000Z' });
    expect(path).toBe('/posts/2026/03/01/abc%20123');
  });
});
