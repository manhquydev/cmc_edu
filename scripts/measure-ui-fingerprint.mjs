#!/usr/bin/env node
/**
 * Live design-fingerprint sweep for CMC admin routes: off-scale font sizes
 * and distinct border-radii per page, measured via getComputedStyle on a
 * real running dev server (not a static analysis of source).
 *
 * Requires a running admin dev server + API + Postgres with dev-auth enabled
 * (DEV_AUTH_ENABLED, non-prod). Not a CI gate — this is a manual/dev-time
 * verification tool for visual-consistency phases (Phase 4/5 of
 * plans/260809-2040-erp-ui-clean-sync-complete/); no automated pass/fail,
 * just data for a human to read alongside a screenshot.
 *
 * Usage:
 *   node scripts/measure-ui-fingerprint.mjs /finance /crm/pipeline ...
 *
 * Env:
 *   UI_SWEEP_BASE_URL      default http://localhost:5173
 *   UI_SWEEP_FACILITY_ID   dev-auth facility id (required — no default;
 *                          pick a real seeded facility, e.g. via
 *                          `select id from "Facility" limit 1`)
 *
 * History: an earlier ad-hoc version of this script (used to produce the
 * Phase-4 planning numbers) had two real bugs, both fixed here:
 *  1. Hardcoded the wrong type scale ([11,12,13,14,16,18,24,32] — a
 *     documentation role list, not a real token) instead of the actual
 *     declared scale in console.css (.o_web_client's --font-size-*).
 *  2. Attributed "ownership" of an off-scale value via
 *     `className.split(' ')[0]` — the FIRST class token, with no causal
 *     link to the property being measured (e.g. flagged a `{margin:0}`
 *     reset utility class as if it owned an unrelated font-size).
 * Both inflated and misattributed the original sweep's numbers; a red-team
 * pass caught it. See plan.md's "HIỆU CHỈNH SAU RED-TEAM" section.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The real declared scale (console.css, .o_web_client --font-size-*), not a
// guessed or documentation-role list. Keep in sync if that block changes.
export const REAL_TYPE_SCALE = [
  '10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px', '22px', '24px',
];

/**
 * Pure analysis over a plain array of leaf-node descriptors — no DOM
 * dependency, so this half is unit-testable without a browser or jsdom.
 * @param {{fontSize: string, isTextLeaf: boolean, borderRadius: string, ownerSelector: string}[]} nodes
 * @param {string[]} scale
 */
export function analyzeFingerprint(nodes, scale = REAL_TYPE_SCALE) {
  const offScale = {};
  const offScaleOwners = {};
  const radii = new Set();
  for (const n of nodes) {
    if (n.isTextLeaf && n.fontSize && !scale.includes(n.fontSize)) {
      offScale[n.fontSize] = (offScale[n.fontSize] || 0) + 1;
      (offScaleOwners[n.fontSize] ??= new Set()).add(n.ownerSelector);
    }
    if (n.borderRadius && n.borderRadius !== '0px') radii.add(n.borderRadius);
  }
  const ownersOut = {};
  for (const [k, v] of Object.entries(offScaleOwners)) ownersOut[k] = [...v];
  return {
    offScale,
    offScaleOwners: ownersOut,
    offScaleTotal: Object.values(offScale).reduce((a, b) => a + b, 0),
    radii: [...radii].sort((a, b) => parseFloat(a) - parseFloat(b)),
    radiiCount: radii.size,
  };
}

async function main() {
  const routes = process.argv.slice(2);
  if (routes.length === 0) {
    console.error('Usage: node scripts/measure-ui-fingerprint.mjs /route1 /route2 ...');
    process.exit(1);
  }
  const facilityId = process.env.UI_SWEEP_FACILITY_ID;
  if (!facilityId) {
    console.error('UI_SWEEP_FACILITY_ID env var is required (a real seeded facility id).');
    process.exit(1);
  }
  const baseUrl = process.env.UI_SWEEP_BASE_URL || 'http://localhost:5173';

  // @playwright/test is a real dependency of apps/e2e, not the workspace
  // root — this tool is a manual dev/verification utility, not a CI gate,
  // so it borrows e2e's install rather than adding a root devDependency.
  const pw = await import(
    path.join(root, 'apps/e2e/node_modules/@playwright/test/index.js')
  );
  const chromium = pw.chromium ?? pw.default?.chromium;
  const devUser = JSON.stringify({ userId: 'u5', roles: ['super_admin'], facilityId });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((u) => localStorage.setItem('cmc_dev_user', u), devUser);
  const page = await ctx.newPage();

  const results = [];
  for (const route of routes) {
    try {
      await page.goto(baseUrl + route, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(600);
      const nodes = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return null;
        const out = [];
        main.querySelectorAll('*').forEach((el) => {
          const s = getComputedStyle(el);
          const isTextLeaf = Boolean(el.textContent && el.children.length === 0 && el.innerText?.trim());
          out.push({
            fontSize: s.fontSize,
            isTextLeaf,
            borderRadius: s.borderRadius,
            ownerSelector: (() => {
              const cls = (el.className || '').toString().trim();
              return cls
                ? `${el.tagName.toLowerCase()}.${cls.split(/\s+/).join('.')}`
                : el.tagName.toLowerCase();
            })(),
          });
        });
        return { nodes: out, comingSoon: main.innerText.includes('Đang phát triển') };
      });
      if (!nodes) {
        results.push({ route, error: 'no <main> found' });
        continue;
      }
      const { comingSoon, nodes: leafNodes } = nodes;
      results.push({ route, comingSoon, ...analyzeFingerprint(leafNodes) });
    } catch (e) {
      results.push({ route, error: String(e).slice(0, 120) });
    }
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
}

// Only run the live-browser sweep when invoked directly (not when imported
// by the test file for the pure-logic checks).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
