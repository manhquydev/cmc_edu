// TDD: two-tier labels, D9 missing/stale, --release hard-fail.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadFlowData, renderWarningBanners } from './load-flow-data.js';

function fixtureDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'deck-data-'));
  return dir;
}

function writeJson(dir: string, name: string, data: unknown): string {
  const p = path.join(dir, name);
  writeFileSync(p, JSON.stringify(data), 'utf8');
  return p;
}

const minimalVerification = (ids: string[], commit: string) => ({
  generatedAt: '2026-08-05T00:00:00.000Z',
  commit,
  evidenceRun: { sha: commit },
  flows: ids.map((id) => ({
    flow: { id },
    evidence: { state: 'proven', badge: 'proven' },
    status: 'built',
  })),
});

const minimalBusiness = (ids: string[], commit: string) => ({
  generatedAt: '2026-08-05T00:00:00.000Z',
  ledgerCommit: commit,
  resultsSha: commit,
  criticalReachableOnly: [] as string[],
  flows: ids.map((id) => ({
    id,
    correctness: 'verified-correct',
    moneyStateCritical: false,
    ledgerState: 'proven',
  })),
});

describe('loadFlowData', () => {
  it('builds with missing JSON and labels everything unmeasured (D9 draft)', () => {
    const dir = fixtureDir();
    const data = loadFlowData({
      verificationPath: path.join(dir, 'missing-v.json'),
      businessPath: path.join(dir, 'missing-b.json'),
      headCommit: 'abc1234',
    });
    expect(data.warnings.missingVerification).toBe(true);
    expect(data.warnings.missingBusiness).toBe(true);
    expect(data.warnings.draftBanner).toBe(true);
    expect(data.flows.length).toBeGreaterThan(0);
    expect(data.flows.every((f) => f.audienceLabel === 'Chưa đo')).toBe(true);
  });

  it('fails --release when JSON is missing', () => {
    const dir = fixtureDir();
    expect(() =>
      loadFlowData({
        release: true,
        verificationPath: path.join(dir, 'missing-v.json'),
        businessPath: path.join(dir, 'missing-b.json'),
        headCommit: 'abc1234',
      }),
    ).toThrow(/--release/);
  });

  it('sets stale banner when measured commit ≠ HEAD without silent old numbers', () => {
    const dir = fixtureDir();
    // Use empty flow lists so we don't need full manifest id set — mismatches ok in draft
    const v = writeJson(dir, 'v.json', minimalVerification(['P1-01'], 'oldcommit'));
    const b = writeJson(dir, 'b.json', minimalBusiness(['P1-01'], 'oldcommit'));
    const data = loadFlowData({
      verificationPath: v,
      businessPath: b,
      headCommit: 'newcommit000',
    });
    expect(data.warnings.stale).toBe(true);
    expect(data.warnings.measuredCommit).toBeTruthy();
    expect(data.warnings.headCommit).toBeTruthy();
    const banners = renderWarningBanners(data.warnings, data.counts);
    expect(banners).toMatch(/commit/i);
  });

  it('fails --release on stale SHA', () => {
    const dir = fixtureDir();
    const v = writeJson(dir, 'v.json', minimalVerification(['P1-01'], 'oldcommit'));
    const b = writeJson(dir, 'b.json', minimalBusiness(['P1-01'], 'oldcommit'));
    expect(() =>
      loadFlowData({
        release: true,
        verificationPath: v,
        businessPath: b,
        headCommit: 'newcommit000',
      }),
    ).toThrow(/commit/);
  });

  it('draft mode always shows draft banner; release clears it', () => {
    const dir = fixtureDir();
    // For release path we still need files present and matching HEAD —
    // use matching short sha; flow id set may mismatch but release only checks missing+stale
    const head = 'deadbeef';
    const v = writeJson(dir, 'v.json', minimalVerification(['P1-01'], head));
    const b = writeJson(dir, 'b.json', minimalBusiness(['P1-01'], head));
    const draft = loadFlowData({
      verificationPath: v,
      businessPath: b,
      headCommit: head,
      release: false,
    });
    expect(draft.warnings.draftBanner).toBe(true);
    const rel = loadFlowData({
      verificationPath: v,
      businessPath: b,
      headCommit: head,
      release: true,
    });
    expect(rel.warnings.draftBanner).toBe(false);
  });

  it('maps verified-correct and reachable-only to two-tier Vietnamese labels', () => {
    const dir = fixtureDir();
    const head = 'abc1234567890';
    const vPath = writeJson(dir, 'v.json', {
      commit: head,
      evidenceRun: { sha: head },
      flows: [
        { flow: { id: 'P1-01' }, evidence: { state: 'proven' } },
        { flow: { id: 'P1-02' }, evidence: { state: 'proven' } },
        { flow: { id: 'P1-03' }, evidence: { state: 'not-yet' } },
      ],
    });
    const bPath = writeJson(dir, 'b.json', {
      resultsSha: head,
      criticalReachableOnly: ['P1-02'],
      flows: [
        { id: 'P1-01', correctness: 'verified-correct', moneyStateCritical: false },
        { id: 'P1-02', correctness: 'reachable-only', moneyStateCritical: true },
        { id: 'P1-03', correctness: 'not-proven', moneyStateCritical: false },
      ],
    });
    const data = loadFlowData({
      verificationPath: vPath,
      businessPath: bPath,
      headCommit: head,
    });
    const a = data.flows.find((f) => f.id === 'P1-01')!;
    const b = data.flows.find((f) => f.id === 'P1-02')!;
    const c = data.flows.find((f) => f.id === 'P1-03')!;
    expect(a.audienceLabel).toBe('Đã kiểm đúng nghiệp vụ');
    expect(b.audienceLabel).toBe('Đã chạy được, chưa kiểm số học');
    expect(b.criticalSmokeOnly).toBe(true);
    expect(c.audienceLabel).toBe('Chưa chứng minh');
  });

  it('ignores non-whitelisted fields without throwing', () => {
    const dir = fixtureDir();
    const head = 'abc';
    const v = writeJson(dir, 'v.json', {
      commit: head,
      evidenceRun: { sha: head },
      secretPath: '/crm/opportunities/:id',
      flows: [
        {
          flow: { id: 'P1-01' },
          evidence: { state: 'proven' },
          leak: { trpc: ['crm.opportunityAdvance'] },
        },
      ],
    });
    const b = writeJson(dir, 'b.json', {
      resultsSha: head,
      flows: [{ id: 'P1-01', correctness: 'verified-correct', moneyStateCritical: false }],
    });
    expect(() =>
      loadFlowData({ verificationPath: v, businessPath: b, headCommit: head }),
    ).not.toThrow();
  });
});

describe('renderWarningBanners', () => {
  it('includes draft strip by default', () => {
    const html = renderWarningBanners(
      {
        missingVerification: false,
        missingBusiness: false,
        stale: false,
        measuredCommit: null,
        headCommit: null,
        idMismatches: [],
        draftBanner: true,
      },
      {
        total: 0,
        proven: 0,
        notYet: 0,
        verifiedCorrect: 0,
        reachableOnly: 0,
        notProven: 0,
        unmeasured: 0,
        criticalReachableOnly: [],
      },
    );
    expect(html).toMatch(/BẢN NHÁP/);
  });
});

// silence unused import in case tree-shaking checkers complain
void mkdirSync;
