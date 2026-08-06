import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * After premium.css retirement on admin, float layers that mount outside
 * `.o_web_client` (ToastViewport as ToastProvider sibling of the router) must
 * keep unscoped rules in odoo.css. Re-scoping them under `.o_web_client`
 * silently strips position/z-index chrome — unit DOM tests will not catch it.
 */
const css = readFileSync(resolve(process.cwd(), 'src/odoo.css'), 'utf8');

function ruleBlock(selector: string): string | null {
  // Match bare selector blocks only (not ".o_web_client .ck-toast…").
  const re = new RegExp(
    `(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  );
  const m = css.match(re);
  return m ? m[1] : null;
}

describe('odoo.css float-layer scope (toast + command palette)', () => {
  it('ships unscoped .ck-toast-viewport with fixed positioning', () => {
    const body = ruleBlock('.ck-toast-viewport');
    expect(body, 'expected bare .ck-toast-viewport {…} in odoo.css').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*fixed/);
    expect(css).not.toMatch(/\.o_web_client\s+\.ck-toast-viewport\s*\{/);
  });

  it('ships unscoped .ck-toast card chrome', () => {
    const body = ruleBlock('.ck-toast');
    expect(body, 'expected bare .ck-toast {…} in odoo.css').toBeTruthy();
    expect(body).toMatch(/box-shadow/);
    expect(css).not.toMatch(/\.o_web_client\s+\.ck-toast\s*\{/);
    expect(css).not.toMatch(/\.o_web_client\s+\.ck-toast--(success|error|info)\s*\{/);
  });

  it('ships unscoped .ck-cmd overlay chrome', () => {
    const body = ruleBlock('.ck-cmd');
    expect(body, 'expected bare .ck-cmd {…} in odoo.css').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*fixed/);
    expect(css).not.toMatch(/\.o_web_client\s+\.ck-cmd\s*\{/);
    expect(css).not.toMatch(/\.o_web_client\s+\.ck-cmd-backdrop\s*\{/);
    expect(css).not.toMatch(/\.o_web_client\s+\.ck-cmd-panel\s*\{/);
  });
});
