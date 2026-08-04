import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { tokens } from './index.js';

// Read the CSS source directly (vitest runs with cwd = package root via the
// `test` script; ?raw imports get processed away under the jsdom css handler).
const css = readFileSync(resolve(process.cwd(), 'src/tokens.css'), 'utf8');

// Parity guard: every key the typed `tokens` object exposes must resolve to a
// `var(--cmc-*)` whose custom property is actually declared in tokens.css. This
// catches drift between the TS surface and the CSS source (either direction).
function assertVarsDeclared(group: Record<string, string>) {
  for (const [key, value] of Object.entries(group)) {
    const matched = value.match(/^var\((--cmc-[a-z0-9-]+)\)$/);
    expect(matched, `${key} should be a var(--cmc-*) ref, got "${value}"`).not.toBeNull();
    const cssVar = matched![1];
    expect(css.includes(`${cssVar}:`), `${cssVar} must be declared in tokens.css`).toBe(true);
  }
}

describe('design tokens parity (typed object vs tokens.css)', () => {
  it('exposes the premium layer and every key maps to a declared CSS var', () => {
    expect(tokens.premium).toBeDefined();
    assertVarsDeclared(tokens.premium);
  });

  it('premium radius scale (control/md/lg/pill) is declared', () => {
    assertVarsDeclared({
      control: tokens.radius.control,
      md: tokens.radius.md,
      lg: tokens.radius.lg,
      pill: tokens.radius.pill,
    });
  });

  it('tokens.css actually declares the core premium custom properties', () => {
    for (const v of ['--cmc-canvas', '--cmc-surface-raised', '--cmc-radius-pill', '--cmc-blur-nav', '--cmc-fs-metric']) {
      expect(css.includes(`${v}:`), `${v} missing from tokens.css`).toBe(true);
    }
  });
});
