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

  it('pins every Astryx --font-size-* step to a real CMC type-scale token', () => {
    // console.css and Astryx both declare a custom property literally named
    // --font-size-lg (etc) — left unmapped, Astryx text inside .o_web_client
    // silently inherits console.css's Odoo value via plain name collision,
    // not deliberate CMC theming. Every step must be pinned explicitly.
    for (const step of ['4xs', '3xs', '2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']) {
      expect(css).toMatch(new RegExp(`--font-size-${step}\\s*:`));
    }
  });
});
