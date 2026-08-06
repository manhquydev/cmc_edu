// Integration: full draft build covers manifest size; release fails when stale/missing.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { flows } from '../acceptance-report/flow-manifest.js';
import { buildDeck } from './build.js';
import { loadFlowData, REPO_ROOT } from './load-flow-data.js';
import { checkHtmlVisible } from './check-copy.js';

describe('deck:build integration', () => {
  it('draft build produces offline deck covering every manifest flow', () => {
    const out = buildDeck({ release: false });
    expect(out.endsWith('index.html')).toBe(true);
    expect(existsSync(out)).toBe(true);
    const html = readFileSync(out, 'utf8');
    expect(html).toMatch(/BẢN NHÁP/);
    for (const f of flows) {
      expect(html).toContain(`data-flow="${f.id}"`);
    }
    expect(checkHtmlVisible(html)).toEqual([]);
    // relative vendor only
    expect(html).toMatch(/src="vendor\/reveal\.js"/);
    expect(html).not.toMatch(/src="https?:/);
  });

  it('release mode rejects missing verification files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'deck-rel-'));
    expect(() =>
      loadFlowData({
        release: true,
        verificationPath: path.join(dir, 'no-v.json'),
        businessPath: path.join(dir, 'no-b.json'),
        headCommit: 'abc',
      }),
    ).toThrow(/--release/);
  });

  it('gitignore anchors presentation-deck at repo root', () => {
    const gi = readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
    expect(gi).toMatch(/^\/presentation-deck\//m);
  });
});

// keep writeFileSync import available for future fixtures
void writeFileSync;
