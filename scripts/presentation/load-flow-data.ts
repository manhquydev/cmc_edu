// Compose two-tier audience labels from manifest + verification JSON.
// Field whitelist only — never dump raw verification values into the deck.
// D9: never hard-fail in draft mode; --release enforces completeness.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flows as manifestFlows } from '../acceptance-report/flow-manifest.js';
import type {
  AudienceStatus,
  Cluster,
  DeckFlowData,
  FlowTierLabel,
  LoadWarnings,
} from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../..');

const VERIFICATION_PATH = path.join(REPO_ROOT, 'acceptance-report/verification.json');
const BUSINESS_PATH = path.join(REPO_ROOT, 'acceptance-report/business-verification.json');

/** Whitelist of fields we are allowed to read from verification.json (AC 6b). */
const VERIFICATION_WHITELIST = [
  'generatedAt',
  'commit',
  'evidenceRun',
  'flows',
] as const;

const VERIFICATION_FLOW_WHITELIST = ['flow', 'evidence', 'status'] as const;
const VERIFICATION_FLOW_INNER = ['id', 'displayName', 'cluster', 'actorRoles', 'expected'] as const;
const VERIFICATION_EVIDENCE = ['state', 'badge'] as const;

const BUSINESS_WHITELIST = [
  'generatedAt',
  'ledgerCommit',
  'resultsSha',
  'counts',
  'criticalReachableOnly',
  'flows',
] as const;

const BUSINESS_FLOW_WHITELIST = [
  'id',
  'displayName',
  'cluster',
  'ledgerState',
  'correctness',
  'moneyStateCritical',
] as const;

export interface LoadOptions {
  release?: boolean;
  /** Override paths for tests */
  verificationPath?: string;
  businessPath?: string;
  headCommit?: string | null;
  repoRoot?: string;
}

interface VerificationFile {
  commit?: string;
  evidenceRun?: { sha?: string | null };
  flows?: Array<{
    flow?: { id?: string };
    evidence?: { state?: string; badge?: string };
  }>;
}

interface BusinessFile {
  ledgerCommit?: string;
  resultsSha?: string;
  criticalReachableOnly?: string[];
  flows?: Array<{
    id?: string;
    correctness?: string;
    moneyStateCritical?: boolean;
    ledgerState?: string;
  }>;
}

function pick<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out as Partial<T>;
}

function readJsonSafe(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

export function resolveHeadCommit(repoRoot: string = REPO_ROOT): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function shortSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  return sha.slice(0, 7);
}

function normalizeCommit(sha: string | null | undefined): string | null {
  if (!sha) return null;
  return sha.toLowerCase();
}

function commitsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCommit(a);
  const nb = normalizeCommit(b);
  if (!na || !nb) return false;
  // verification stores short SHA; evidenceRun may store full
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

function audienceLabelFor(
  correctness: AudienceStatus,
  reachability: FlowTierLabel['reachability'],
  moneyCritical: boolean,
  criticalSmoke: boolean,
): { label: string; hint?: string } {
  if (correctness === 'unmeasured' || reachability === 'unmeasured') {
    return { label: 'Chưa đo', hint: 'Thiếu file số liệu — chạy pnpm acceptance:report' };
  }
  if (correctness === 'verified-correct') {
    return { label: 'Đã kiểm đúng nghiệp vụ' };
  }
  if (correctness === 'reachable-only' || reachability === 'proven') {
    const hint = criticalSmoke || moneyCritical
      ? 'Luồng tiền/lương/trạng thái quan trọng — mới ở mức chạy thông, chưa kiểm số học'
      : 'Chạy thông ≠ đúng số học nghiệp vụ';
    return { label: 'Đã chạy được, chưa kiểm số học', hint };
  }
  return { label: 'Chưa chứng minh' };
}

function parseVerification(raw: unknown): {
  file: VerificationFile | null;
  byId: Map<string, { state: string }>;
  commit: string | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { file: null, byId: new Map(), commit: null };
  }
  const picked = pick(raw as Record<string, unknown>, VERIFICATION_WHITELIST);
  const file = picked as VerificationFile;
  const byId = new Map<string, { state: string }>();
  for (const entry of file.flows ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const flowPicked = pick(entry as Record<string, unknown>, VERIFICATION_FLOW_WHITELIST);
    const flowInner = flowPicked.flow;
    if (!flowInner || typeof flowInner !== 'object') continue;
    const inner = pick(flowInner as Record<string, unknown>, VERIFICATION_FLOW_INNER);
    const id = typeof inner.id === 'string' ? inner.id : null;
    if (!id) continue;
    const evidence = flowPicked.evidence && typeof flowPicked.evidence === 'object'
      ? pick(flowPicked.evidence as Record<string, unknown>, VERIFICATION_EVIDENCE)
      : {};
    const state = typeof evidence.state === 'string' ? evidence.state : 'not-yet';
    byId.set(id, { state });
  }
  const commit =
    (typeof file.evidenceRun?.sha === 'string' && file.evidenceRun.sha) ||
    (typeof file.commit === 'string' ? file.commit : null);
  return { file, byId, commit };
}

function parseBusiness(raw: unknown): {
  file: BusinessFile | null;
  byId: Map<string, { correctness: AudienceStatus; moneyStateCritical: boolean }>;
  criticalReachableOnly: string[];
  commit: string | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { file: null, byId: new Map(), criticalReachableOnly: [], commit: null };
  }
  const picked = pick(raw as Record<string, unknown>, BUSINESS_WHITELIST);
  const file = picked as BusinessFile;
  const byId = new Map<string, { correctness: AudienceStatus; moneyStateCritical: boolean }>();
  for (const entry of file.flows ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const f = pick(entry as Record<string, unknown>, BUSINESS_FLOW_WHITELIST);
    const id = typeof f.id === 'string' ? f.id : null;
    if (!id) continue;
    const c = f.correctness;
    const correctness: AudienceStatus =
      c === 'verified-correct' || c === 'reachable-only' || c === 'not-proven'
        ? c
        : 'unmeasured';
    byId.set(id, {
      correctness,
      moneyStateCritical: f.moneyStateCritical === true,
    });
  }
  const critical = Array.isArray(file.criticalReachableOnly)
    ? file.criticalReachableOnly.filter((x): x is string => typeof x === 'string')
    : [];
  const commit =
    (typeof file.resultsSha === 'string' && file.resultsSha) ||
    (typeof file.ledgerCommit === 'string' ? file.ledgerCommit : null);
  return { file, byId, criticalReachableOnly: critical, commit };
}

/**
 * Load and compose deck data. Never throws in draft mode.
 * In --release: requires both JSON files and SHA matching HEAD on data-affecting paths.
 */
export function loadFlowData(options: LoadOptions = {}): DeckFlowData {
  const release = options.release === true;
  const verificationPath = options.verificationPath ?? VERIFICATION_PATH;
  const businessPath = options.businessPath ?? BUSINESS_PATH;
  const head =
    options.headCommit !== undefined
      ? options.headCommit
      : resolveHeadCommit(options.repoRoot ?? REPO_ROOT);

  const vRaw = readJsonSafe(verificationPath);
  const bRaw = readJsonSafe(businessPath);
  const v = parseVerification(vRaw);
  const b = parseBusiness(bRaw);

  const missingVerification = vRaw === null;
  const missingBusiness = bRaw === null;

  const measuredCommit = v.commit ?? b.commit;
  const stale =
    !missingVerification &&
    !missingBusiness &&
    head !== null &&
    measuredCommit !== null &&
    !commitsMatch(measuredCommit, head);

  const manifestIds = new Set(manifestFlows.map((f) => f.id));
  const statusIds = new Set([...v.byId.keys(), ...b.byId.keys()]);
  const idMismatches: string[] = [];
  for (const id of manifestIds) {
    if (v.byId.size > 0 && !v.byId.has(id)) idMismatches.push(`manifest→verification: ${id}`);
    if (b.byId.size > 0 && !b.byId.has(id)) idMismatches.push(`manifest→business: ${id}`);
  }
  for (const id of statusIds) {
    if (!manifestIds.has(id)) idMismatches.push(`status→manifest: ${id}`);
  }

  if (release) {
    const errors: string[] = [];
    if (missingVerification) {
      errors.push(`Thiếu ${path.relative(REPO_ROOT, verificationPath)} — chạy pnpm acceptance:report`);
    }
    if (missingBusiness) {
      errors.push(`Thiếu ${path.relative(REPO_ROOT, businessPath)} — chạy pnpm business:verify`);
    }
    if (stale) {
      errors.push(
        `Số liệu commit ${shortSha(measuredCommit)} ≠ HEAD ${shortSha(head)}. Chạy lại acceptance:report + business:verify.`,
      );
    }
    if (errors.length > 0) {
      throw new Error(`deck:build --release thất bại:\n- ${errors.join('\n- ')}`);
    }
  }

  const criticalSet = new Set(b.criticalReachableOnly);
  const labels: FlowTierLabel[] = manifestFlows.map((flow) => {
    const reachRaw = v.byId.get(flow.id)?.state;
    const reachability: FlowTierLabel['reachability'] = missingVerification
      ? 'unmeasured'
      : reachRaw === 'proven'
        ? 'proven'
        : 'not-yet';

    const biz = b.byId.get(flow.id);
    const correctness: AudienceStatus = missingBusiness
      ? 'unmeasured'
      : (biz?.correctness ?? 'not-proven');

    const moneyStateCritical = biz?.moneyStateCritical === true;
    const criticalSmokeOnly = criticalSet.has(flow.id);
    const { label, hint } = audienceLabelFor(
      correctness,
      reachability,
      moneyStateCritical,
      criticalSmokeOnly,
    );

    return {
      id: flow.id,
      displayName: flow.displayName,
      cluster: flow.cluster as Cluster,
      actorRoles: [...flow.actorRoles],
      uiRoutes: [...flow.expected.uiRoutes],
      reachability,
      correctness,
      moneyStateCritical,
      criticalSmokeOnly,
      audienceLabel: label,
      audienceHint: hint,
    };
  });

  const counts = {
    total: labels.length,
    proven: labels.filter((f) => f.reachability === 'proven').length,
    notYet: labels.filter((f) => f.reachability === 'not-yet').length,
    verifiedCorrect: labels.filter((f) => f.correctness === 'verified-correct').length,
    reachableOnly: labels.filter((f) => f.correctness === 'reachable-only').length,
    notProven: labels.filter((f) => f.correctness === 'not-proven').length,
    unmeasured: labels.filter(
      (f) => f.correctness === 'unmeasured' || f.reachability === 'unmeasured',
    ).length,
    criticalReachableOnly: [...criticalSet],
  };

  const warnings: LoadWarnings = {
    missingVerification,
    missingBusiness,
    stale,
    measuredCommit: shortSha(measuredCommit),
    headCommit: shortSha(head),
    idMismatches,
    draftBanner: !release,
  };

  return { flows: labels, warnings, counts };
}

/** Build HTML warning banners for the deck shell. */
export function renderWarningBanners(warnings: LoadWarnings, counts: DeckFlowData['counts']): string {
  const parts: string[] = [];
  if (warnings.draftBanner) {
    parts.push(
      `<div class="deck-banner deck-banner-draft" role="status">BẢN NHÁP — số liệu chưa xác nhận (build không có cờ --release)</div>`,
    );
  }
  if (warnings.missingVerification || warnings.missingBusiness) {
    const missing = [
      warnings.missingVerification ? 'verification.json' : null,
      warnings.missingBusiness ? 'business-verification.json' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    parts.push(
      `<div class="deck-banner deck-banner-warn" role="status">Chưa đo: thiếu ${escapeHtml(missing)}. Nhãn trạng thái = "Chưa đo".</div>`,
    );
  }
  if (warnings.stale) {
    parts.push(
      `<div class="deck-banner deck-banner-stale" role="status">Số liệu chạy ở commit ${escapeHtml(warnings.measuredCommit ?? '?')} — HEAD hiện tại ${escapeHtml(warnings.headCommit ?? '?')}. Không dùng làm số liệu chính thức.</div>`,
    );
  }
  if (warnings.idMismatches.length > 0) {
    const sample = warnings.idMismatches.slice(0, 8).join(', ');
    const more =
      warnings.idMismatches.length > 8 ? ` (+${warnings.idMismatches.length - 8})` : '';
    parts.push(
      `<div class="deck-banner deck-banner-warn" role="status">Lệch tập luồng: ${escapeHtml(sample)}${escapeHtml(more)}</div>`,
    );
  }
  if (counts.criticalReachableOnly.length > 0) {
    parts.push(
      `<div class="deck-banner deck-banner-critical" role="status">Luồng tiền/lương còn mức chạy thông (chưa kiểm số): ${escapeHtml(counts.criticalReachableOnly.join(', '))}</div>`,
    );
  }
  return parts.join('\n');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function roleLabelVi(role: string): string {
  const map: Record<string, string> = {
    sale: 'Sale',
    giam_doc_kinh_doanh: 'Giám đốc Kinh doanh',
    giam_doc_dao_tao: 'Giám đốc Đào tạo',
    giao_vien: 'Giáo viên',
    phu_huynh: 'Phụ huynh',
    hoc_vien: 'Học viên',
    he_thong: 'Hệ thống',
    agent: 'AI soạn nháp',
    super_admin: 'Quản trị hệ thống',
  };
  return map[role] ?? role;
}
