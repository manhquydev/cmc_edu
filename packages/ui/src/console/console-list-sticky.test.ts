import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/** Phase 5 — sticky thead is the list-header affordance for DataTable scroll. */
const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

describe('console.css sticky list thead', () => {
  it('makes .console-list-table and .console-list thead th sticky', () => {
    expect(css).toMatch(/\.console-list-table thead th\s*,\s*\n?\s*\.console-list thead th\s*\{/);
    // Position sticky must appear in that rule block (not only elsewhere).
    const m = css.match(
      /\.console-list-table thead th\s*,\s*\n?\s*\.console-list thead th\s*\{([^}]*)\}/,
    );
    expect(m, 'expected combined sticky thead rule').toBeTruthy();
    expect(m![1]).toMatch(/position\s*:\s*sticky/);
    expect(m![1]).toMatch(/top\s*:\s*0/);
  });
});
