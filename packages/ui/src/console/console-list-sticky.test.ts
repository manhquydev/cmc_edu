import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/** Phase 5–6 — sticky thead for DataTable only (not global thead). */
const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

describe('console.css sticky list thead', () => {
  it('scopes sticky to .console-list thead th only (no bare thead th)', () => {
    const m = css.match(/\.console-list thead th\s*\{([^}]*)\}/);
    expect(m, 'expected .console-list thead th sticky rule').toBeTruthy();
    expect(m![1]).toMatch(/position\s*:\s*sticky/);
    expect(m![1]).toMatch(/top\s*:\s*0/);
    // Forbid unscoped thead th (Phase 6 regression when multi-selector delete
    // left a bare "thead th," sibling after removing .console-list-table).
    expect(css).not.toMatch(/(?:^|[,}])\s*thead\s+th\s*[,{]/m);
  });
});
