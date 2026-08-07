import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * P1 design3 densify: ControlBar is a single flat band (no nested cards);
 * Detail/Form use Odoo form sheet dual-layer under the admin shell.
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

describe('odoo.css ControlBar densify + form sheet', () => {
  it('flattens page-header inside control-bar under shell', () => {
    const body = ruleBlock('.o_web_client .o-control-bar .o-page-header');
    expect(body, 'expected CP-nested page-header rule').toBeTruthy();
    expect(body).toMatch(/border\s*:\s*0/);
    expect(body).toMatch(/background\s*:\s*transparent/);
    expect(body).toMatch(/box-shadow\s*:\s*none/);
  });

  it('flattens filter-bar inside control-bar under shell', () => {
    const body = ruleBlock('.o_web_client .o-control-bar .o-filter-bar');
    expect(body, 'expected CP-nested filter-bar rule').toBeTruthy();
    expect(body).toMatch(/border\s*:\s*0/);
    expect(body).toMatch(/background\s*:\s*transparent/);
  });

  it('ships form sheet dual-layer base classes', () => {
    expect(ruleBlock('.o-form-sheet-bg')).toBeTruthy();
    expect(ruleBlock('.o-form-sheet')).toBeTruthy();
    const sheet = ruleBlock('.o-form-sheet');
    expect(sheet).toMatch(/border/);
    expect(sheet).toMatch(/background/);
  });

  it('densifies control-bar padding under shell', () => {
    const body = ruleBlock('.o_web_client .o-control-bar');
    expect(body, 'expected shell control-bar rule').toBeTruthy();
    expect(body).toMatch(/padding\s*:\s*8px/);
    expect(body).toMatch(/gap\s*:\s*8px/);
  });

  it('flattens EntityHeader chrome inside form sheet under shell', () => {
    const body = ruleBlock('.o_web_client .o-form-sheet .o-eh');
    expect(body, 'expected in-sheet entity header rule').toBeTruthy();
    expect(body).toMatch(/border\s*:\s*0/);
    expect(body).toMatch(/box-shadow\s*:\s*none/);
    expect(body).toMatch(/background\s*:\s*transparent/);
  });

  it('sticks thin .o-detail-statusbar on md+ only (not .o-detail-summary)', () => {
    const summary = ruleBlock('.o_web_client .o-form-sheet-bg > .o-detail-summary');
    expect(summary).toBeTruthy();
    expect(summary).not.toMatch(/position\s*:\s*sticky/);

    expect(css.includes('.o_web_client .o-form-sheet-bg > .o-detail-statusbar')).toBe(true);
    const mediaIdx = css.indexOf('@media (min-width: 768px)');
    expect(mediaIdx).toBeGreaterThan(-1);
    // Find the media block that targets detail-statusbar sticky
    const stickySlice = css.slice(mediaIdx, mediaIdx + 350);
    expect(stickySlice.includes('.o-detail-statusbar')).toBe(true);
    expect(stickySlice).toMatch(/position\s*:\s*sticky/);
    expect(stickySlice).toMatch(/top\s*:\s*0/);
  });
});
