import { describe, expect, it } from 'vitest';

import { sanitizeHtml, sanitizeText } from '../lib/security';

describe('security', () => {
  it('sanitizeHtml should remove script and event handlers', () => {
    const input = '<div onclick="alert(1)">ok</div><script>alert(2)</script>';
    const output = sanitizeHtml(input);
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('<script>');
    expect(output).toContain('ok');
  });

  it('sanitizeText should strip control chars and trim', () => {
    const out = sanitizeText(' a\u0001b\u0002c ', 10);
    expect(out).toBe('abc');
  });
});
