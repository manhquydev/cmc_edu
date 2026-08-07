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
    expect(css.includes('--console-font-size-base:')).toBe(true);
    expect(css.includes('--console-kanban-color-1:')).toBe(true);
    expect(css.includes('--console-kanban-color-6:')).toBe(true);
    expect(css.includes('--console-navbar-height:')).toBe(true);
  });

  it('exposes remapped class names (console- prefix, not odoo-lab-)', () => {
    expect(css.includes('.console-navbar')).toBe(true);
    expect(css.includes('.console-kanban-board')).toBe(true);
    expect(css.includes('.console-statusbar-step')).toBe(true);
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
