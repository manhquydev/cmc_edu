import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/** Phase 5 — sticky thead is the list-header affordance for DataTable scroll. */
const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

describe('console.css sticky list thead', () => {
  it('makes .console-list thead th sticky (DataTable path)', () => {
    // Phase 6 removed unused .console-list-table (no emitters); sticky stays on
    // the live DataTable wrapper only.
    const m = css.match(/\.console-list thead th\s*\{([^}]*)\}/);
    expect(m, 'expected .console-list thead th sticky rule').toBeTruthy();
    expect(m![1]).toMatch(/position\s*:\s*sticky/);
    expect(m![1]).toMatch(/top\s*:\s*0/);
  });
});
