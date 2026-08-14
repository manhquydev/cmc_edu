/**
 * Family computed pins — three sheets (tokens → astryx-theme-cmc → console),
 * same inject order as console-precedence.test.ts. Pins FilterBar child width,
 * StatusBadge solid capsules, ProgressSteps text-only chevrons, StatCard --static,
 * and LMS not loading console.css.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilterBar } from '../components/filter-bar.js';
import { StatusBadge } from '../components/status-badge.js';
import { ProgressSteps } from '../components/progress-steps.js';
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

  it('pins FilterBar search chrome height 35px', () => {
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
    const box = mount.querySelector('.console-search-box') as HTMLElement;
    expect(box).toBeTruthy();
    expect(getComputedStyle(box).height).toMatch(/35px/);
    expect(getComputedStyle(box).borderRadius).toBe('999px');
  });

  it('pins StatusBadge md as a solid capsule (not pastel chip)', () => {
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(<StatusBadge status="active" label="Đang mở" />, { container: mount });
    const badge = mount.querySelector('.console-badge-soft') as HTMLElement;
    expect(badge.classList.contains('console-badge-soft--sm')).toBe(false);
    expect(badge.classList.contains('console-badge-soft--lg')).toBe(false);
    const cs = getComputedStyle(badge);
    expect(cs.paddingLeft).toBe('8px');
    expect(cs.paddingRight).toBe('8px');
    expect(cs.height).toBe('20px');
    expect(cs.color).toBe('rgb(255, 255, 255)');
    expect(cs.backgroundColor).toBe('rgb(40, 167, 69)');
  });

  it('paints Draft capsules gray-on-white, not pastel ink', () => {
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(<StatusBadge status="draft" label="Draft" />, { container: mount });
    const cs = getComputedStyle(mount.querySelector('.console-badge-soft') as HTMLElement);
    expect(cs.backgroundColor).toBe('rgb(108, 117, 125)');
    expect(cs.color).toBe('rgb(255, 255, 255)');
  });

  it('hides ProgressSteps numbers under the shell (text-only chevrons)', () => {
    const mount = document.createElement('div');
    shell.appendChild(mount);
    render(
      <ProgressSteps
        activeIndex={0}
        steps={[
          { id: 'draft', label: 'Draft' },
          { id: 'done', label: 'Done' },
        ]}
      />,
      { container: mount },
    );
    const num = mount.querySelector('.console-steps-num') as HTMLElement;
    expect(num).toBeTruthy();
    // Visually hidden (sr-only clip) — stays in DOM for a11y/tests, not display:none
    const numStyle = getComputedStyle(num);
    expect(numStyle.position).toBe('absolute');
    expect(numStyle.width).toBe('1px');
    expect(numStyle.height).toBe('1px');
    expect(numStyle.clip).toMatch(/rect\(0(px)?, 0(px)?, 0(px)?, 0(px)?\)/);
    const current = mount.querySelector('.is-current .console-steps-btn') as HTMLElement;
    expect(getComputedStyle(current).backgroundColor).toBe('rgb(224, 217, 241)');
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
