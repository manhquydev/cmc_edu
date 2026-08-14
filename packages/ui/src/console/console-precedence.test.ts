/**
 * Cross-file CSS precedence pin.
 *
 * Three sheets that declare the families under test (admin also loads
 * reset.css and app.css; those do not declare --font-size-* /
 * --color-text-* / --font-family-*):
 *   tokens.css → astryx-theme-cmc.css → console.css
 *
 * console.css wins inside the admin shell because it specifies these
 * properties on .o_web_client itself. A specified value on an element
 * always beats a value inherited from an ancestor — not because
 * .o_web_client is nested in [data-astryx-theme], and not because of
 * import order or selector specificity. Load order here matches admin
 * for realism; the assertions do not depend on it.
 *
 * Assertions run on a descendant of .o_web_client. No Astryx component
 * is the shell node; descendants are what actually render.
 *
 * jsdom does not resolve var() on used properties (color/font-size stay
 * as the var() string). Custom-property getPropertyValue still returns
 * the specified value. Color pins therefore parse that specified var()
 * (winner + fallback hex) and hop once to the winner token's hex on the
 * same node. Text-role pins read the console.css remaps on the shell —
 * not the vendor theme-neutral mapping file.
 *
 * LIMITATION: jsdom silently drops @import of node_modules
 * (astryx-theme-cmc.css:16-17). The upstream --text-* family therefore
 * resolves empty here; the vendor mapping suite still pins that file
 * from source. Console remaps are pinned separately on .o_web_client.
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

type FontSizeStep = (typeof FONT_SIZE_STEPS)[number];

/** Odoo-dense steps specified on .o_web_client (console.css). */
const SHELL_FONT_SIZE: Record<FontSizeStep, string> = {
  '4xs': '10px',
  '3xs': '10px',
  '2xs': '11px',
  xs: '12px',
  sm: '13px',
  base: '14px',
  lg: '15px',
  xl: '16px',
  '2xl': '18px',
  '3xl': '20px',
  '4xl': '22px',
  '5xl': '24px',
};

/**
 * CMC / Astryx steps outside the shell after one var() hop
 * (astryx-theme-cmc.css + tokens.css). 4xs/3xs/sm are token refs.
 */
const OUTSIDE_FONT_SIZE: Record<FontSizeStep, string> = {
  '4xs': '11px',
  '3xs': '11px',
  '2xs': '12px',
  xs: '12px',
  sm: '13px',
  base: '14px',
  lg: '16px',
  xl: '18px',
  '2xl': '24px',
  '3xl': '24px',
  '4xl': '32px',
  '5xl': '32px',
};

function injectSheet(css: string): HTMLStyleElement {
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
  return el;
}

function prop(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Specified custom-property value, or the token it points at (one hop). */
function specifiedPx(el: Element, name: string): string {
  const value = prop(el, name);
  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/);
  return ref ? prop(el, ref[1]) : value;
}

function expectSpecified(
  el: Element,
  name: string,
  expected: string,
  otherSurface: string,
): void {
  const actual = specifiedPx(el, name);
  expect(
    actual,
    `${name} specified as ${JSON.stringify(prop(el, name))} → ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}; other surface is ${JSON.stringify(otherSurface)}`,
  ).toBe(expected);
}

/** jsdom resolves a hex color only when it is assigned as a used `color`. */
function hexAsRgb(hex: string): string {
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  probe.style.color = hex;
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return rgb;
}

function expectHexColor(el: Element, name: string, hex: string, rgb: string): void {
  const actual = prop(el, name);
  expect(
    actual,
    `${name} specified as ${JSON.stringify(actual)}; expected hex ${JSON.stringify(hex)}`,
  ).toBe(hex);
  expect(
    hexAsRgb(actual),
    `${name} ${JSON.stringify(actual)} as used color; expected ${JSON.stringify(rgb)}`,
  ).toBe(rgb);
}

/** First `var()` hop: winner token and optional fallback (rest after the first comma). */
function parseCssVar(specified: string): { name: string; fallback: string | null } {
  const match = specified.match(/^var\((--[a-z0-9-]+)(?:,\s*(.+))?\)$/i);
  if (!match) {
    throw new Error(`expected var(--token[, fallback]), got ${JSON.stringify(specified)}`);
  }
  return { name: match[1], fallback: match[2] ?? null };
}

/**
 * Pin a console color role by resolved value, not by substring.
 * Mutating the fallback hex or flipping the winner token must fail.
 */
function expectResolvedConsoleColor(
  el: Element,
  name: string,
  winner: string,
  hex: string,
  rgb: string,
): void {
  const specified = prop(el, name);
  const parsed = parseCssVar(specified);
  expect(
    parsed.name,
    `${name} winner must be ${winner}; specified ${JSON.stringify(specified)}`,
  ).toBe(winner);
  expect(
    parsed.fallback,
    `${name} fallback hex must be ${hex}; specified ${JSON.stringify(specified)}`,
  ).toBe(hex);
  const resolved = prop(el, parsed.name);
  expect(
    resolved,
    `${name} ${parsed.name} resolves to ${JSON.stringify(resolved)}; expected ${JSON.stringify(hex)}`,
  ).toBe(hex);
  expect(
    hexAsRgb(resolved),
    `${name} resolved ${JSON.stringify(resolved)} as used color; expected ${JSON.stringify(rgb)}`,
  ).toBe(rgb);
}

describe('console / Astryx / CMC precedence', () => {
  let sheets: HTMLStyleElement[];
  let shellChild: HTMLElement;
  let outsideChild: HTMLElement;

  beforeEach(() => {
    // Order matches admin for realism; assertions do not depend on it.
    sheets = [injectSheet(tokensCss), injectSheet(astryxCss), injectSheet(consoleCss)];

    const theme = document.createElement('div');
    theme.setAttribute('data-astryx-theme', 'neutral');
    const shell = document.createElement('div');
    shell.className = 'o_web_client';
    shellChild = document.createElement('span');
    shell.appendChild(shellChild);
    theme.appendChild(shell);
    document.body.appendChild(theme);

    const outside = document.createElement('div');
    outside.setAttribute('data-astryx-theme', 'neutral');
    outsideChild = document.createElement('span');
    outside.appendChild(outsideChild);
    document.body.appendChild(outside);
  });

  afterEach(() => {
    for (const sheet of sheets) sheet.remove();
    document.body.innerHTML = '';
  });

  it('lets console.css win --font-size-* / --color-text-* / --font-family-* on descendants of the admin shell', () => {
    for (const step of FONT_SIZE_STEPS) {
      const name = `--font-size-${step}`;
      expectSpecified(shellChild, name, SHELL_FONT_SIZE[step], specifiedPx(outsideChild, name));
    }

    expectHexColor(shellChild, '--console-gray-900', '#212529', 'rgb(33, 37, 41)');
    expectHexColor(shellChild, '--console-gray-600', '#6c757d', 'rgb(108, 117, 125)');
    expectResolvedConsoleColor(
      shellChild,
      '--color-text-primary',
      '--console-gray-900',
      '#212529',
      'rgb(33, 37, 41)',
    );
    expectResolvedConsoleColor(
      shellChild,
      '--color-text-secondary',
      '--console-gray-600',
      '#6c757d',
      'rgb(108, 117, 125)',
    );
    expectResolvedConsoleColor(
      shellChild,
      '--color-text-disabled',
      '--console-gray-600',
      '#6c757d',
      'rgb(108, 117, 125)',
    );

    // jsdom serialization of this family list (double quotes, no spaces) is a
    // jsdom artifact, not a CSS contract — a jsdom bump that changes serialize
    // will fail closed.
    const consoleFont =
      '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    expect(
      prop(shellChild, '--font-family-body'),
      `--font-family-body shell=${JSON.stringify(prop(shellChild, '--font-family-body'))} outside=${JSON.stringify(prop(outsideChild, '--font-family-body'))}`,
    ).toBe(consoleFont);
    expect(
      prop(shellChild, '--font-family-heading'),
      `--font-family-heading shell=${JSON.stringify(prop(shellChild, '--font-family-heading'))} outside=${JSON.stringify(prop(outsideChild, '--font-family-heading'))}`,
    ).toBe(consoleFont);

    // Console remaps (not vendor theme-neutral). Changing these in
    // console.css must fail this suite.
    expect(prop(shellChild, '--text-heading-3-weight')).toBe('600');
    expect(prop(shellChild, '--text-label-size')).toBe('var(--font-size-sm)');
    expectSpecified(
      shellChild,
      '--text-label-size',
      SHELL_FONT_SIZE.sm,
      specifiedPx(outsideChild, '--text-label-size'),
    );
    expect(prop(shellChild, '--text-supporting-size')).toBe('var(--font-size-xs)');
    expectSpecified(
      shellChild,
      '--text-supporting-size',
      SHELL_FONT_SIZE.xs,
      specifiedPx(outsideChild, '--text-supporting-size'),
    );
  });

  it('lets CMC / Astryx win the same families on descendants outside .o_web_client', () => {
    for (const step of FONT_SIZE_STEPS) {
      const name = `--font-size-${step}`;
      expectSpecified(outsideChild, name, OUTSIDE_FONT_SIZE[step], specifiedPx(shellChild, name));
    }

    expectHexColor(outsideChild, '--cmc-text', '#1d1d1f', 'rgb(29, 29, 31)');
    expectHexColor(outsideChild, '--cmc-text-muted', '#6e6e73', 'rgb(110, 110, 115)');
    expectHexColor(outsideChild, '--cmc-text-faint', '#a39e96', 'rgb(163, 158, 150)');
    expect(prop(outsideChild, '--color-text-primary')).toBe('var(--cmc-text)');
    expect(prop(outsideChild, '--color-text-secondary')).toBe('var(--cmc-text-muted)');
    expect(prop(outsideChild, '--color-text-disabled')).toBe('var(--cmc-text-faint)');

    expect(prop(outsideChild, '--font-family-body')).toBe('var(--cmc-font-sans)');
    expect(prop(outsideChild, '--font-family-heading')).toBe('var(--cmc-font-sans)');
  });

  it('resolves different winners on the two descendant surfaces (console ≠ CMC)', () => {
    expect(
      specifiedPx(shellChild, '--font-size-4xl'),
      `--font-size-4xl shell=${JSON.stringify(specifiedPx(shellChild, '--font-size-4xl'))} outside=${JSON.stringify(specifiedPx(outsideChild, '--font-size-4xl'))}`,
    ).not.toBe(specifiedPx(outsideChild, '--font-size-4xl'));
    expect(
      prop(shellChild, '--console-gray-900'),
      `--console-gray-900 shell=${JSON.stringify(prop(shellChild, '--console-gray-900'))} outside=${JSON.stringify(prop(outsideChild, '--console-gray-900'))}`,
    ).not.toBe(prop(outsideChild, '--cmc-text'));
    expect(
      prop(shellChild, '--font-family-body'),
      `--font-family-body shell=${JSON.stringify(prop(shellChild, '--font-family-body'))} outside=${JSON.stringify(prop(outsideChild, '--font-family-body'))}`,
    ).not.toBe(prop(outsideChild, '--font-family-body'));
  });

  it('remaps admin primary accent to Community purple; LMS outside keeps CMC blue', () => {
    // OpenEduCat contract §2: primary under .o_web_client = #71639e.
    // Astryx Button primary paints background from --color-accent.
    expectHexColor(shellChild, '--console-brand-purple', '#71639e', 'rgb(113, 99, 158)');
    expect(
      prop(shellChild, '--cmc-brand'),
      `--cmc-brand shell=${JSON.stringify(prop(shellChild, '--cmc-brand'))}`,
    ).toBe('var(--console-brand-purple)');
    expect(
      specifiedPx(shellChild, '--cmc-brand'),
      `--cmc-brand resolved shell=${JSON.stringify(specifiedPx(shellChild, '--cmc-brand'))}`,
    ).toBe('#71639e');
    expect(
      prop(shellChild, '--color-accent'),
      `--color-accent shell=${JSON.stringify(prop(shellChild, '--color-accent'))}`,
    ).toBe('var(--console-brand-purple)');
    expect(
      specifiedPx(shellChild, '--color-accent'),
      `--color-accent resolved shell=${JSON.stringify(specifiedPx(shellChild, '--color-accent'))}`,
    ).toBe('#71639e');

    // tokens.css LMS / non-shell surface must stay Apple-blue.
    expectHexColor(outsideChild, '--cmc-brand', '#0071e3', 'rgb(0, 113, 227)');
    expect(prop(outsideChild, '--color-accent')).toBe('var(--cmc-brand)');
    expect(specifiedPx(outsideChild, '--color-accent')).toBe('#0071e3');
  });
});

describe('upstream Astryx theme-neutral --text-* mapping', () => {
  it('keeps the upstream theme file present when CI is set', () => {
    if (process.env.CI) {
      expect(existsSync(UPSTREAM_THEME)).toBe(true);
    }
  });

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
