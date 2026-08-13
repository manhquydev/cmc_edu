import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/console.css'), 'utf8');

const FOCUS_SELECTORS = [
  '.console-app-switcher-toggle',
  '.console-menu-item',
  '.console-app-switcher-tile',
  '.console-systray-badge',
  'button.console-kanban-card',
  '.console-view-switcher button',
] as const;

const NAVBAR_SELECTORS = [
  '.console-app-switcher-toggle',
  '.console-menu-item',
  '.console-systray-badge',
] as const;

const LIGHT_SELECTORS = [
  '.console-app-switcher-tile',
  'button.console-kanban-card',
  '.console-view-switcher button',
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Body of the first rule whose selector list includes `${selector}:focus-visible`. */
function focusVisibleBlock(source: string, selector: string): string | null {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRe = /([^{}]+)\{([^}]*)\}/g;
  const wanted = `${selector}:focus-visible`;
  const scoped = `.o_web_client ${wanted}`;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(stripped))) {
    const selectors = match[1]
      .split(',')
      .map((part) => part.replace(/\s+/g, ' ').trim());
    if (selectors.includes(wanted) || selectors.includes(scoped)) return match[2];
  }
  return null;
}

describe('console.css :focus-visible rings (WCAG 2.4.7)', () => {
  it.each(FOCUS_SELECTORS)('%s has a :focus-visible block with outline', (selector) => {
    const block = focusVisibleBlock(css, selector);
    expect(block, `expected ${selector}:focus-visible { … }`).toBeTruthy();
    expect(block).toMatch(/outline\s*:\s*2px\s+solid\s+var\(--(?:console|cmc)-[a-z0-9-]+\)/);
    expect(block).toMatch(/outline-offset\s*:\s*-?2px/);
  });

  it('uses --console-gray-100 on purple navbar chrome and --cmc-brand on light surfaces', () => {
    for (const selector of NAVBAR_SELECTORS) {
      expect(focusVisibleBlock(css, selector)).toMatch(/var\(--console-gray-100\)/);
    }
    for (const selector of LIGHT_SELECTORS) {
      expect(focusVisibleBlock(css, selector)).toMatch(/var\(--cmc-brand\)/);
    }
  });

  it('scopes each ring under .o_web_client so it ties/beats the Astryx :is() rule', () => {
    for (const selector of FOCUS_SELECTORS) {
      expect(css).toMatch(
        new RegExp(`\\.o_web_client\\s+${escapeRegExp(selector)}:focus-visible`),
      );
    }
  });

  it('does not redeclare locked token families in the new focus rules', () => {
    for (const selector of FOCUS_SELECTORS) {
      const block = focusVisibleBlock(css, selector);
      expect(block).toBeTruthy();
      expect(block).not.toMatch(/--(?:font-size|color-text|text|console)-[a-z0-9-]*\s*:/);
    }
  });

  it('keeps a parseable :focus-visible rule for each listed selector (removal must fail)', () => {
    // Pin the six class strings so deleting one rule cannot hide behind a comment.
    for (const selector of FOCUS_SELECTORS) {
      expect(css).toMatch(new RegExp(`${escapeRegExp(selector)}:focus-visible`));
    }
  });
});
