import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/astryx-theme-cmc.css'), 'utf8');

describe('Astryx CMC theme bridge', () => {
  it('does not hardcode --radius-inner — falls through to Astryx\'s own default', () => {
    // Was `--radius-inner: 10px` — a magic number with no CMC token behind
    // it. Leaving it unset lets CSS's per-property cascade fall through to
    // Astryx's own considered default (4px, astryx.css:60) instead of this
    // bridge inventing a replacement number.
    expect(css).not.toMatch(/--radius-inner\s*:/);
  });

  it('declares every Astryx --font-size-* step for surfaces outside the admin shell', () => {
    // Inside .o_web_client (admin), console.css sets these properties on the
    // element itself, so they win over inherited theme values — that cascade
    // is pinned in console-precedence.test.ts.
    // Outside the shell (LMS), these CMC mappings are what resolve. Declaring
    // them here keeps the LMS type scale from silently falling through to
    // Astryx defaults. They cannot override console.css inside the admin
    // shell: a specified value on .o_web_client beats inheritance.
    for (const step of ['4xs', '3xs', '2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']) {
      expect(css).toMatch(new RegExp(`--font-size-${step}\\s*:`));
    }
  });
});
