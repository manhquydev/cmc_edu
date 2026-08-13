/**
 * Family computed pins — three sheets (tokens → astryx-theme-cmc → console),
 * same inject order as console-precedence.test.ts. Pins FilterBar child width,
 * StatusBadge md padding, StatCard --static source, EmptyState ops class,
 * and LMS not loading console.css.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilterBar } from '../components/filter-bar.js';
import { StatusBadge } from '../components/status-badge.js';
import { StatCard } from '../components/stat-card.js';
import { EmptyState } from '../components/empty-state.js';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/tokens.css'), 'utf8');
const astryxCss = readFileSync(resolve(process.cwd(), 'src/astryx-theme-cmc.css'), 'utf8');
const consoleCss = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

function injectSheet(css: string): HTMLStyleElement {
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
  return el;
}

describe('console family computed pins', () => {
  let sheets: HTMLStyleElement[];
  let shell: HTMLElement;

  beforeEach(() => {
    sheets = [injectSheet(tokensCss), injectSheet(astryxCss), injectSheet(consoleCss)];
    const theme = document.createElement('div');
    theme.setAttribute('data-astryx-theme', 'neutral');
    shell = document.createElement('div');
    shell.className = 'o_web_client';
    theme.appendChild(shell);
    document.body.appendChild(theme);
  });

  afterEach(() => {
    for (const sheet of sheets) sheet.remove();
    document.body.innerHTML = '';
  });

  it('pins FilterBar select/date 160px and text 180px', () => {
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(
      <MemoryRouter>
        <FilterBar
          filters={[
            { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'a', label: 'A' }] },
            { key: 'from', label: 'Từ ngày', type: 'date' },
            { key: 'q', label: 'Tìm', type: 'text' },
          ]}
          value={{ status: '', from: '', q: '' }}
          onChange={() => {}}
        />
      </MemoryRouter>,
      { container: mount },
    );
    const fields = [...mount.querySelectorAll('.console-filter-field')] as HTMLElement[];
    expect(fields.length).toBe(3);
    expect(getComputedStyle(fields[0]!).width).toBe('160px');
    expect(getComputedStyle(fields[1]!).width).toBe('160px');
    expect(getComputedStyle(fields[2]!).width).toBe('180px');
    expect(fields[2]!.classList.contains('console-filter-field--text')).toBe(true);
  });

  it('pins StatusBadge md padding (not sm/lg)', () => {
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(<StatusBadge status="active" label="Đang mở" />, { container: mount });
    const badge = mount.querySelector('.console-badge-soft') as HTMLElement;
    expect(badge.classList.contains('console-badge-soft--sm')).toBe(false);
    expect(badge.classList.contains('console-badge-soft--lg')).toBe(false);
    const cs = getComputedStyle(badge);
    expect(cs.paddingLeft).toBe('9px');
    expect(cs.paddingRight).toBe('9px');
  });

  it('keeps StatCard --static (source) and not a link', () => {
    expect(consoleCss).toMatch(/\.console-mc\.console-mc--static:hover/);
    expect(consoleCss).toMatch(/transform:\s*none/);
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(<StatCard label="KPI" value={1} />, { container: mount });
    const el = mount.querySelector('.console-mc.console-mc--static');
    expect(el?.tagName).toBe('DIV');
    expect(mount.querySelector('a')).toBeNull();
  });

  it('scopes EmptyState ops class; default has none', () => {
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(
      <>
        <EmptyState title="ops" density="ops" />
        <EmptyState title="default" />
      </>,
      { container: mount },
    );
    expect(mount.querySelectorAll('.console-empty-ops').length).toBe(1);
  });
});

describe('LMS does not load console.css', () => {
  it('apps/lms/src/main.tsx never imports console.css', () => {
    const main = readFileSync(resolve(process.cwd(), '../../apps/lms/src/main.tsx'), 'utf8');
    expect(main).not.toMatch(/console\.css/);
  });
});
