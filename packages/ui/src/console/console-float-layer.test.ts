import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * After console.css retirement on admin, float layers that mount outside
 * `.o_web_client` (ToastViewport as ToastProvider sibling of the router) must
 * keep unscoped rules in console.css. Re-scoping them under `.o_web_client`
 * silently strips position/z-index chrome — unit DOM tests will not catch it.
 */
const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

function ruleBlock(selector: string): string | null {
  // Match bare selector blocks only (not ".o_web_client .console-toast…").
  const re = new RegExp(
    `(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  );
  const m = css.match(re);
  return m ? m[1] : null;
}

describe('console.css float-layer scope (toast + command palette)', () => {
  it('ships unscoped .console-toast-viewport with fixed positioning', () => {
    const body = ruleBlock('.console-toast-viewport');
    expect(body, 'expected bare .console-toast-viewport {…} in console.css').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*fixed/);
    expect(css).not.toMatch(/\.o_web_client\s+\.console-toast-viewport\s*\{/);
  });

  it('ships unscoped .console-toast card chrome', () => {
    const body = ruleBlock('.console-toast');
    expect(body, 'expected bare .console-toast {…} in console.css').toBeTruthy();
    expect(body).toMatch(/box-shadow/);
    expect(css).not.toMatch(/\.o_web_client\s+\.console-toast\s*\{/);
    expect(css).not.toMatch(/\.o_web_client\s+\.console-toast--(success|error|info)\s*\{/);
  });

  it('ships unscoped .console-cmd overlay chrome', () => {
    const body = ruleBlock('.console-cmd');
    expect(body, 'expected bare .console-cmd {…} in console.css').toBeTruthy();
    expect(body).toMatch(/position\s*:\s*fixed/);
    expect(css).not.toMatch(/\.o_web_client\s+\.console-cmd\s*\{/);
    expect(css).not.toMatch(/\.o_web_client\s+\.console-cmd-backdrop\s*\{/);
    expect(css).not.toMatch(/\.o_web_client\s+\.console-cmd-panel\s*\{/);
  });

  it('stacks toast above navbar band and below command palette', () => {
    const toast = ruleBlock('.console-toast-viewport');
    const cmd = ruleBlock('.console-cmd');
    const navbar = ruleBlock('.console-navbar');
    expect(toast).toBeTruthy();
    expect(cmd).toBeTruthy();
    expect(navbar).toBeTruthy();
    const toastZ = Number(toast!.match(/z-index\s*:\s*(\d+)/)?.[1]);
    const cmdZ = Number(cmd!.match(/z-index\s*:\s*(\d+)/)?.[1]);
    const navZ = Number(navbar!.match(/z-index\s*:\s*(\d+)/)?.[1]);
    expect(toastZ).toBeGreaterThanOrEqual(1100);
    expect(cmdZ).toBeGreaterThanOrEqual(1200);
    expect(navZ).toBeGreaterThanOrEqual(1000);
    expect(toastZ).toBeGreaterThan(navZ);
    expect(cmdZ).toBeGreaterThan(toastZ);
  });

  it('ships unscoped dialog.console-dialog chrome (ConfirmDialog / top-layer)', () => {
    const body = ruleBlock('dialog.console-dialog');
    expect(body, 'expected dialog.console-dialog {…} in console.css').toBeTruthy();
    expect(body).toMatch(/z-index\s*:\s*1150/);
    expect(css).toMatch(/dialog\.console-dialog::backdrop\s*\{/);
    expect(css).toMatch(/\.console-dialog-root\s*\{/);
    // Fixed ladder still holds; native showModal paints above this ladder.
    const toastZ = Number(ruleBlock('.console-toast-viewport')!.match(/z-index\s*:\s*(\d+)/)?.[1]);
    const cmdZ = Number(ruleBlock('.console-cmd')!.match(/z-index\s*:\s*(\d+)/)?.[1]);
    expect(1150).toBeGreaterThan(toastZ);
    expect(cmdZ).toBeGreaterThan(1150);
  });
});
