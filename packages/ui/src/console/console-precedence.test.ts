/**
 * Cross-file CSS precedence pin.
 *
 * Admin import order (apps/admin/src/main.tsx):
 *   tokens.css → astryx-theme-cmc.css → console.css
 *
 * .o_web_client is nested inside [data-astryx-theme=neutral], so console.css
 * declarations on .o_web_client intentionally win inside the admin shell.
 * Outside that shell (LMS), Astryx/CMC mappings win.
 *
 * LIMITATION: jsdom silently drops @import of node_modules
 * (astryx-theme-cmc.css:16-17). The upstream --text-* family therefore
 * resolves empty here; the mapping suite below pins those remaps from source.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/tokens.css'), 'utf8');
const astryxCss = readFileSync(resolve(process.cwd(), 'src/astryx-theme-cmc.css'), 'utf8');
const consoleCss = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

const UPSTREAM_THEME = resolve(
  process.cwd(),
  'node_modules/@astryxdesign/theme-neutral/dist/theme.css',
);

const FONT_SIZE_STEPS = [
  '4xs',
  '3xs',
  '2xs',
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
] as const;

const COLOR_TEXT_STEPS = ['primary', 'secondary', 'disabled'] as const;
const FONT_FAMILY_STEPS = ['body', 'heading'] as const;

function injectSheet(css: string): HTMLStyleElement {
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
  return el;
}

function prop(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

function expectWinner(
  el: Element,
  name: string,
  expected: string,
  otherSurface: string,
): void {
  const actual = prop(el, name);
  expect(
    actual,
    `${name} resolved to ${JSON.stringify(actual)}; expected winner ${JSON.stringify(expected)}; other surface is ${JSON.stringify(otherSurface)}`,
  ).toBe(expected);
}

describe('console / Astryx / CMC precedence', () => {
  let sheets: HTMLStyleElement[];
  let shell: HTMLElement;
  let outside: HTMLElement;

  beforeEach(() => {
    // Real admin import order — do not reorder.
    sheets = [injectSheet(tokensCss), injectSheet(astryxCss), injectSheet(consoleCss)];

    const theme = document.createElement('div');
    theme.setAttribute('data-astryx-theme', 'neutral');
    shell = document.createElement('div');
    shell.className = 'o_web_client';
    theme.appendChild(shell);
    document.body.appendChild(theme);

    // Control: same theme attribute as LMS, not inside .o_web_client.
    outside = document.createElement('div');
    outside.setAttribute('data-astryx-theme', 'neutral');
    document.body.appendChild(outside);
  });

  afterEach(() => {
    for (const sheet of sheets) sheet.remove();
    document.body.innerHTML = '';
  });

  it('lets console.css win --font-size-* / --color-text-* / --font-family-* inside the admin shell', () => {
    for (const step of FONT_SIZE_STEPS) {
      const name = `--font-size-${step}`;
      expect(prop(shell, name).length, `${name} empty on .o_web_client (outside=${JSON.stringify(prop(outside, name))})`).toBeGreaterThan(0);
    }

    // Distinct literals that prove which sheet won (shared steps like base=14px
    // cannot tell the layers apart).
    expectWinner(shell, '--font-size-lg', '15px', prop(outside, '--font-size-lg'));
    expectWinner(shell, '--font-size-xl', '16px', prop(outside, '--font-size-xl'));
    expectWinner(shell, '--font-size-2xl', '18px', prop(outside, '--font-size-2xl'));
    expectWinner(shell, '--font-size-5xl', '24px', prop(outside, '--font-size-5xl'));

    // jsdom serializes var() fallbacks without the space after the comma.
    expectWinner(
      shell,
      '--color-text-primary',
      'var(--console-gray-900,#212529)',
      prop(outside, '--color-text-primary'),
    );
    expectWinner(
      shell,
      '--color-text-secondary',
      'var(--console-gray-600,#6c757d)',
      prop(outside, '--color-text-secondary'),
    );
    expectWinner(
      shell,
      '--color-text-disabled',
      'var(--console-gray-600,#6c757d)',
      prop(outside, '--color-text-disabled'),
    );

    // jsdom serializes the family list with double quotes and no spaces.
    const consoleFont =
      '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    expectWinner(shell, '--font-family-body', consoleFont, prop(outside, '--font-family-body'));
    expectWinner(shell, '--font-family-heading', consoleFont, prop(outside, '--font-family-heading'));
  });

  it('lets CMC / Astryx win the same families outside .o_web_client', () => {
    expectWinner(outside, '--font-size-lg', '16px', prop(shell, '--font-size-lg'));
    expectWinner(outside, '--font-size-xl', '18px', prop(shell, '--font-size-xl'));
    expectWinner(outside, '--font-size-2xl', '24px', prop(shell, '--font-size-2xl'));
    expectWinner(outside, '--font-size-5xl', '32px', prop(shell, '--font-size-5xl'));

    expectWinner(outside, '--color-text-primary', 'var(--cmc-text)', prop(shell, '--color-text-primary'));
    expectWinner(
      outside,
      '--color-text-secondary',
      'var(--cmc-text-muted)',
      prop(shell, '--color-text-secondary'),
    );
    expectWinner(
      outside,
      '--color-text-disabled',
      'var(--cmc-text-faint)',
      prop(shell, '--color-text-disabled'),
    );

    expectWinner(
      outside,
      '--font-family-body',
      'var(--cmc-font-sans)',
      prop(shell, '--font-family-body'),
    );
    expectWinner(
      outside,
      '--font-family-heading',
      'var(--cmc-font-sans)',
      prop(shell, '--font-family-heading'),
    );

    for (const step of FONT_SIZE_STEPS) {
      const name = `--font-size-${step}`;
      expect(prop(outside, name).length, `${name} empty outside shell`).toBeGreaterThan(0);
    }
    for (const step of COLOR_TEXT_STEPS) {
      const name = `--color-text-${step}`;
      expect(prop(outside, name).length, `${name} empty outside shell`).toBeGreaterThan(0);
    }
    for (const step of FONT_FAMILY_STEPS) {
      const name = `--font-family-${step}`;
      expect(prop(outside, name).length, `${name} empty outside shell`).toBeGreaterThan(0);
    }
  });

  it('resolves different winners on the two surfaces (console ≠ CMC)', () => {
    expect(
      prop(shell, '--font-size-lg'),
      `--font-size-lg shell=${JSON.stringify(prop(shell, '--font-size-lg'))} outside=${JSON.stringify(prop(outside, '--font-size-lg'))}`,
    ).not.toBe(prop(outside, '--font-size-lg'));
    expect(
      prop(shell, '--color-text-primary'),
      `--color-text-primary shell=${JSON.stringify(prop(shell, '--color-text-primary'))} outside=${JSON.stringify(prop(outside, '--color-text-primary'))}`,
    ).not.toBe(prop(outside, '--color-text-primary'));
    expect(
      prop(shell, '--font-family-body'),
      `--font-family-body shell=${JSON.stringify(prop(shell, '--font-family-body'))} outside=${JSON.stringify(prop(outside, '--font-family-body'))}`,
    ).not.toBe(prop(outside, '--font-family-body'));
  });
});

describe('upstream Astryx theme-neutral --text-* mapping', () => {
  it.skipIf(!existsSync(UPSTREAM_THEME))(
    'keeps --text-label-size / --text-heading-3-weight / --text-supporting-size remapped to font tokens',
    () => {
      const css = readFileSync(UPSTREAM_THEME, 'utf8');
      expect(css).toMatch(/--text-label-size\s*:\s*var\(--font-size-base\)/);
      expect(css).toMatch(/--text-heading-3-weight\s*:\s*var\(--font-weight-bold\)/);
      expect(css).toMatch(/--text-supporting-size\s*:\s*var\(--font-size-sm\)/);
    },
  );
});
