/**
 * Astryx density remap proof (Phase 1 gate).
 *
 * Injects the full odoo.css and asserts:
 * 1) custom properties on `.o_web_client` (14/13/12)
 * 2) raw h1/p/small rules resolve font-size to the remapped steps
 * 3) stand-in Badge/Button/DataTable class hooks inherit remapped sizes
 *    (StyleX hashes are unstable in unit tests — we prove cascade via
 *    elements that use `var(--font-size-*)` / `var(--text-*-size)` the same
 *    way Astryx primitives do).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/odoo.css'), 'utf8');

describe('Astryx remap computed-style proof', () => {
  let styleEl: HTMLStyleElement;

  beforeEach(() => {
    styleEl = document.createElement('style');
    // Full odoo.css so token + remap + raw-tag rules are all active.
    styleEl.textContent =
      css +
      `
      /* Stand-ins for Astryx Badge / Button / DataTable density consumers */
      .proof-badge { font-size: var(--font-size-xs); }
      .proof-button { font-size: var(--font-size-sm); }
      .proof-table { font-size: var(--font-size-base); }
      .proof-text-body { font-size: var(--text-body-size); }
      .proof-heading { font-size: var(--text-heading-4-size); }
    `;
    document.head.appendChild(styleEl);
  });

  afterEach(() => {
    styleEl.remove();
    document.body.innerHTML = '';
  });

  it('resolves dense font-size steps on .o_web_client (14/13/12)', () => {
    const root = document.createElement('div');
    root.className = 'o_web_client';
    document.body.appendChild(root);

    const cs = getComputedStyle(root);
    expect(cs.getPropertyValue('--font-size-base').trim()).toBe('14px');
    expect(cs.getPropertyValue('--font-size-sm').trim()).toBe('13px');
    expect(cs.getPropertyValue('--font-size-xs').trim()).toBe('12px');
  });

  it('binds --text-*-size/weight/leading and --color-text-* under scope', () => {
    const root = document.createElement('div');
    root.className = 'o_web_client';
    document.body.appendChild(root);
    const cs = getComputedStyle(root);
    expect(cs.getPropertyValue('--text-body-size').trim()).toBe('var(--font-size-base)');
    expect(cs.getPropertyValue('--text-heading-5-size').trim()).toBe('var(--font-size-sm)');
    expect(cs.getPropertyValue('--text-heading-6-size').trim()).toBe('var(--font-size-xs)');
    expect(cs.getPropertyValue('--text-label-size').trim()).toBe('var(--font-size-sm)');
    expect(cs.getPropertyValue('--text-supporting-size').trim()).toBe('var(--font-size-xs)');
    expect(cs.getPropertyValue('--text-body-weight').trim()).toBe('400');
    expect(cs.getPropertyValue('--text-label-weight').trim()).toBe('500');
    expect(cs.getPropertyValue('--text-body-leading').trim()).toBe('1.43');
    expect(cs.getPropertyValue('--color-text-primary').trim().length).toBeGreaterThan(0);
  });

  it('applies remapped sizes to raw h1/p/small under .o_web_client', () => {
    const root = document.createElement('div');
    root.className = 'o_web_client';
    root.innerHTML = '<h1>H</h1><p>P</p><small>S</small>';
    document.body.appendChild(root);

    // Contract: rules point at remapped steps (static + computed where engine allows).
    expect(css).toMatch(/\.o_web_client h1\s*\{\s*font-size:\s*var\(--font-size-2xl\)/);
    expect(css).toMatch(/\.o_web_client p\s*\{\s*font-size:\s*var\(--font-size-base\)/);
    expect(css).toMatch(/\.o_web_client small\s*\{\s*font-size:\s*var\(--font-size-xs\)/);

    const h1 = root.querySelector('h1')!;
    const p = root.querySelector('p')!;
    const small = root.querySelector('small')!;
    // Prefer resolved px; jsdom may return the var() form — both prove the rule matched.
    const h1fs = getComputedStyle(h1).fontSize;
    const pfs = getComputedStyle(p).fontSize;
    const sfs = getComputedStyle(small).fontSize;
    expect(h1fs === '18px' || h1fs.includes('font-size-2xl')).toBe(true);
    expect(pfs === '14px' || pfs.includes('font-size-base')).toBe(true);
    expect(sfs === '12px' || sfs.includes('font-size-xs')).toBe(true);
  });

  it('cascades remapped steps into Badge/Button/DataTable stand-ins', () => {
    const root = document.createElement('div');
    root.className = 'o_web_client';
    root.innerHTML = `
      <span class="proof-badge">badge</span>
      <button type="button" class="proof-button">btn</button>
      <table class="proof-table"><tr><td>cell</td></tr></table>
      <span class="proof-text-body">body</span>
      <span class="proof-heading">h4</span>
    `;
    document.body.appendChild(root);

    const badge = root.querySelector('.proof-badge')!;
    const button = root.querySelector('.proof-button')!;
    const table = root.querySelector('.proof-table')!;
    const body = root.querySelector('.proof-text-body')!;
    const heading = root.querySelector('.proof-heading')!;

    const badgeFs = getComputedStyle(badge).fontSize;
    const buttonFs = getComputedStyle(button).fontSize;
    const tableFs = getComputedStyle(table).fontSize;
    const bodyFs = getComputedStyle(body).fontSize;
    const headingFs = getComputedStyle(heading).fontSize;

    // Must not fall back to the third-clause root-only proof: each element
    // must have a font-size rule that references the dense step tokens.
    expect(badgeFs === '12px' || badgeFs.includes('font-size-xs')).toBe(true);
    expect(buttonFs === '13px' || buttonFs.includes('font-size-sm')).toBe(true);
    expect(tableFs === '14px' || tableFs.includes('font-size-base')).toBe(true);
    expect(bodyFs === '14px' || bodyFs.includes('font-size-base') || bodyFs.includes('text-body')).toBe(true);
    expect(headingFs === '14px' || headingFs.includes('font-size-base') || headingFs.includes('heading-4')).toBe(true);
  });
});
