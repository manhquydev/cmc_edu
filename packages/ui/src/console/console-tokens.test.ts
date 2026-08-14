import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

describe('console.css scope + token surface', () => {
  it('never uses a document-global :root selector (scope leak guard)', () => {
    // Grep-equivalent: the string must be absent from the whole file (incl. comments).
    expect(css.includes(':root')).toBe(false);
  });

  it('scopes tokens under .o_web_client', () => {
    expect(css.includes('.o_web_client')).toBe(true);
    expect(css.includes('--console-brand-purple:')).toBe(true);
    expect(css.includes('--console-statusbar-current:')).toBe(true);
    expect(css.includes('--console-font-size-base:')).toBe(true);
    expect(css.includes('--console-kanban-color-1:')).toBe(true);
    expect(css.includes('--console-kanban-color-6:')).toBe(true);
    expect(css.includes('--console-navbar-height:')).toBe(true);
  });

  it('skins the admin statusbar as text-only lavender chevrons', () => {
    expect(css.includes('--console-statusbar-current: #e0d9f1')).toBe(true);
    expect(css.includes('--console-statusbar-radius: 4px')).toBe(true);
    expect(css.includes('var(--console-statusbar-current')).toBe(true);
    expect(css.includes('justify-content: flex-end')).toBe(true);
    expect(css.includes('flex: 0 0 auto')).toBe(true);
    expect(css.includes('polygon(evenodd')).toBe(true);
    expect(css.includes('.o_web_client .console-steps-item:last-child .console-steps-btn')).toBe(true);
    const lastIdx = css.indexOf('.o_web_client .console-steps-item:last-child .console-steps-btn');
    expect(css.slice(lastIdx, lastIdx + 380)).toMatch(/100%\s+var\(--console-statusbar-radius\)/);
    const currentIdx = css.indexOf('.o_web_client .console-steps-item.is-current .console-steps-btn');
    expect(currentIdx).toBeGreaterThan(-1);
    const currentSlice = css.slice(currentIdx, currentIdx + 420);
    expect(currentSlice).not.toMatch(/color:\s*#fff/);
    const numIdx = css.lastIndexOf('.o_web_client .console-steps-num');
    expect(numIdx).toBeGreaterThan(-1);
    expect(css.slice(numIdx, numIdx + 280)).toMatch(/clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
  });

  it('remaps interactive accent to Community purple inside the admin shell', () => {
    expect(css.includes('--cmc-brand: var(--console-brand-purple)')).toBe(true);
    expect(css.includes('--console-cp-height: 58px')).toBe(true);
    expect(css.includes('decorative only')).toBe(false);
    expect(css.includes('interactive accent stays CMC blue #0071E3')).toBe(false);
  });

  it('exposes remapped class names (console- prefix, not odoo-lab-)', () => {
    expect(css.includes('.console-navbar')).toBe(true);
    expect(css.includes('.console-kanban-board')).toBe(true);
    expect(css.includes('.console-steps-btn')).toBe(true);
    expect(css.includes('.odoo-lab-')).toBe(false);
  });

  it('retains LGPL-3 Odoo provenance attribution', () => {
    expect(css.includes('LGPL-3')).toBe(true);
    expect(css.includes('7de220c941c77d4fffdc270a7862c69475fa4577')).toBe(true);
  });

  it('remaps both --font-size-* and --text-*-size under .o_web_client', () => {
    expect(css.includes('--font-size-base: 14px')).toBe(true);
    expect(css.includes('--font-size-sm: 13px')).toBe(true);
    expect(css.includes('--font-size-xs: 12px')).toBe(true);
    expect(css.includes('--text-body-size:')).toBe(true);
    expect(css.includes('--text-heading-4-size:')).toBe(true);
    expect(css.includes('--text-label-size:')).toBe(true);
    expect(css.includes('--text-supporting-size:')).toBe(true);
  });

  it('styles raw heading/body tags under .o_web_client for Astryx/raw parity', () => {
    expect(css.includes('.o_web_client h1')).toBe(true);
    expect(css.includes('.o_web_client p')).toBe(true);
    expect(css.includes('.o_web_client small')).toBe(true);
  });

  it('pins Community list density and gray view-switcher active state', () => {
    expect(css.includes('--console-list-row-height: 40px')).toBe(true);
    expect(css.includes('--console-row-hover: #f2f2f2')).toBe(true);
    expect(css.includes('.o_web_client .console-list thead th')).toBe(true);
    expect(css.includes('background: var(--console-gray-100)')).toBe(true);
    const activeIdx = css.indexOf('.console-view-switcher button.is-active');
    expect(activeIdx).toBeGreaterThan(-1);
    const block = css.slice(activeIdx, activeIdx + 160);
    expect(block.includes('#edeef1')).toBe(true);
    expect(block.includes('--console-brand-purple')).toBe(false);
    expect(block.includes('var(--cmc-brand)')).toBe(false);
  });

  it('pins OpenEduCat remaining chrome tokens', () => {
    expect(css.includes('--console-facet-bg: #eaebf0')).toBe(true);
    expect(css.includes('--console-statusbar-current: #e0d9f1')).toBe(true);
    expect(css.includes('--console-search-height: 35px')).toBe(true);
    expect(css.includes('--console-search-radius: 999px')).toBe(true);
    expect(css.includes('--cmc-radius-control: var(--console-radius')).toBe(true);
    expect(css.includes('--_button-radius: var(--console-radius')).toBe(true);
    expect(css.includes('flex-wrap: nowrap')).toBe(true);
    expect(css.includes('.console-kanban-record-grid')).toBe(true);
    expect(css.includes('.console-search-caret')).toBe(true);
    expect(css.includes('--color-accent: var(--console-brand-purple)')).toBe(true);
    expect(css.includes('height: var(--console-cp-height, 58px)')).toBe(true);
    expect(css.includes('flex-direction: row-reverse')).toBe(false);
    expect(css).toMatch(
      /\.o_web_client \.console-search-menu[\s\S]{0,120}position:\s*absolute/,
    );
    expect(css).toMatch(
      /\.o_web_client \.console-search-box[\s\S]{0,900}border-radius:\s*999px\s*!important/,
    );
    expect(css).toMatch(
      /\.o_web_client \.console-steps-num[\s\S]{0,280}clip:\s*rect\(0,\s*0,\s*0,\s*0\)/,
    );
  });

  it('wires kanban narrow viewport width to --console-kanban-card-width-sm', () => {
    expect(css.includes('--console-kanban-card-width-sm:')).toBe(true);
    expect(css.includes('@media (max-width: 768px)')).toBe(true);
    expect(css.includes('min(90vw, var(--console-kanban-card-width-sm))')).toBe(true);
    // Cards fill column only inside the media block (desktop keeps fixed card width).
    const mediaIdx = css.indexOf('@media (max-width: 768px)');
    const mediaSlice = css.slice(mediaIdx, mediaIdx + 400);
    expect(mediaSlice.includes('.console-kanban-card')).toBe(true);
    expect(mediaSlice.includes('width: 100%')).toBe(true);
  });
});
