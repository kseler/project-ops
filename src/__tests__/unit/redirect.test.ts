import { describe, expect, it } from 'vitest';

import { safeRedirect, withRedirect } from '@/lib/redirect';

describe('safeRedirect', () => {
  it('allows internal paths', () => {
    expect(safeRedirect('/accept-invitation/abc')).toBe('/accept-invitation/abc');
    expect(safeRedirect('/projects?view=gantt')).toBe('/projects?view=gantt');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '', null, undefined])(
    'rejects %s',
    (value) => {
      expect(safeRedirect(value)).toBeNull();
    },
  );
});

describe('withRedirect', () => {
  it('appends an encoded redirect param', () => {
    expect(withRedirect('/sign-in', '/accept-invitation/a b')).toBe('/sign-in?redirect=%2Faccept-invitation%2Fa%20b');
  });

  it('returns the path unchanged without a redirect', () => {
    expect(withRedirect('/sign-in', null)).toBe('/sign-in');
  });
});
