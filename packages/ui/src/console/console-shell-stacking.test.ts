import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * App-switcher is position:absolute under .o-navbar. Without a shell z-index,
 * main.o-main (and .o-page-header) paints over the open menu — live design3
 * audit 2026-08-06 (session-assessment + 6 Form/Detail pages).
 */
const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

function ruleBlock(selector: string): string | null {
  const re = new RegExp(
    `(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  );
  const m = css.match(re);
  return m ? m[1] : null;
}

describe('odoo.css shell stacking (navbar over main content)', () => {
  it('gives .o-navbar a shell z-index above page chrome', () => {
    const body = ruleBlock('.o-navbar');
    expect(body, 'expected .o-navbar {…} in odoo.css').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*relative/);
    const z = body!.match(/z-index\s*:\s*(\d+)/);
    expect(z, 'expected .o-navbar z-index').toBeTruthy();
    expect(Number(z![1])).toBeGreaterThanOrEqual(100);
  });

  it('keeps app-switcher menu positioned under the navbar layer', () => {
    const body = ruleBlock('.o-app-switcher-menu');
    expect(body, 'expected .o-app-switcher-menu {…}').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*absolute/);
    expect(body).toMatch(/z-index\s*:\s*\d+/);
  });

  it('disables sticky/z-index competition on .o-page-header under shell', () => {
    const body = ruleBlock('.o_web_client .o-page-header');
    expect(body, 'expected .o_web_client .o-page-header {…}').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*static/);
    expect(body).toMatch(/z-index\s*:\s*auto/);
  });
});
