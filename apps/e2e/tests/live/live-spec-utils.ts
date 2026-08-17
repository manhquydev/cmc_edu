// live-spec-utils — shared wiring for the live journey specs under tests/live/.
//
//   - attachErrors(): registers pageerror/console-error/request-failed
//     collectors on every page a spec creates (assertNoErrors then checks
//     them after key steps; the afterEach merges everything into the
//     evidence file).
//   - finishLiveSpec(): afterEach hook — records pass/fail + errors + created
//     data into plans/reports/uat-live-<ts>/result.json + README.md.
//   - staff identity generators: per-campaign emails/temp passwords are unique
//     per runId so repeated campaigns never collide on AppUser.email.

import { type Page, type TestInfo } from '@playwright/test';

import { ictMonthOf } from '@cmc/domain-time';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import {
  attachErrorCollectors,
  assertNoErrors,
  liveEvidence,
  type ErrorCollector,
  type CreatedEntity,
} from '../../src/live/live-evidence.js';
import { readLiveState, recordCreated as recordStateCreated } from '../../src/live/live-state.js';
import type { LiveStaffRole } from '../../src/live/live-ui.js';

export interface SpecScratch {
  collectors: ErrorCollector[];
  created: CreatedEntity[];
}

export function newScratch(): SpecScratch {
  return { collectors: [], created: [] };
}

/** Attaches client-error collectors to a page and keeps them for the afterEach. */
export function attachErrors(page: Page, scratch: SpecScratch): ErrorCollector {
  const collector = attachErrorCollectors(page);
  scratch.collectors.push(collector);
  return collector;
}

/** Records a created entity into the run state (coordinator cleanup) AND the
 *  evidence created-log for this spec. */
export function recordCreated(scratch: SpecScratch, kind: string, label: string, value: string): void {
  scratch.created.push({ kind, label, value });
  recordStateCreated('live', kind, label, value);
}

/** afterEach for every live spec: record the outcome + merged captures. */
export function finishLiveSpec(info: TestInfo, scratch: SpecScratch): void {
  liveEvidence.recordSpecResult(info, { created: scratch.created });
  for (const collector of scratch.collectors) {
    liveEvidence.mergeCaptures(info.title, collector);
  }
  liveEvidence.flush();
}

export { assertNoErrors };

/** Asserts EVERY collector attached by this spec has zero errors — not just
 *  the first one (a later page's console/pageerror would otherwise pass
 *  silently: the KPI specs' evidence once showed 07/08 passing while a
 *  GĐKD-page console 404 was only merged into evidence, never asserted). */
export async function assertNoErrorsAll(scratch: SpecScratch, step: string): Promise<void> {
  for (let i = 0; i < scratch.collectors.length; i += 1) {
    // assertNoErrors ignores its page arg — pass the collector itself.
    await assertNoErrors(scratch.collectors[i]! as unknown as Page, scratch.collectors[i]!, step + ' (page ' + (i + 1) + '/' + scratch.collectors.length + ')');
  }
}

/** Escapes regex metacharacters before interpolating a user-visible string
 *  (contact names, student names, emails) into a RegExp. Shared by the live
 *  specs — keep one copy here, not per-spec. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** The shared run id (stable across specs of one campaign). */
export function runId(): string {
  return readLiveState().runId;
}

/** Fresh unique identity for a staff role of this campaign. */
export function staffIdentity(roleKey: string): { userId: string; email: string; tempPassword: string } {
  const rid = runId();
  return {
    userId: 'live-' + roleKey + '-' + rid,
    email: 'live-' + roleKey + '-' + rid + '@cmcvn.edu.vn',
    tempPassword: 'CmcTemp!' + rid, // >= 8 chars; rotated on first login
  };
}

/** A plausible fresh parent phone for the receipt (normalized server-side). */
export function freshParentPhone(): string {
  return randomVnPhone();
}

/** A KPI period N months before the current ICT month. kpi.submitSlip
 *  only opens from day 3 of the FOLLOWING month (auto-score.ts), so a period
 *  2 months back is always submittable without touching the clock — same
 *  reasoning the local kpi journey documents for its hardcoded 2026-06. */
export function pastPeriodIct(monthsBack = 2): string {
  const [y, m] = ictMonthOf(new Date()).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return shifted.toISOString().slice(0, 7);
}

/** The 4 staff accounts 00-setup-roles creates, with their UI labels. */
export const STAFF_ROLES: Array<{
  key: 'sale' | 'giam_doc_kinh_doanh' | 'giam_doc_dao_tao' | 'giao_vien';
  role: LiveStaffRole;
  fullNamePrefix: string;
  position: string;
}> = [
  { key: 'sale', role: 'sale', fullNamePrefix: 'Nhân viên kinh doanh', position: 'Nhân viên kinh doanh' },
  { key: 'giam_doc_kinh_doanh', role: 'giam_doc_kinh_doanh', fullNamePrefix: 'Giám đốc kinh doanh', position: 'Giám đốc kinh doanh' },
  { key: 'giam_doc_dao_tao', role: 'giam_doc_dao_tao', fullNamePrefix: 'Giám đốc đào tạo', position: 'Giám đốc đào tạo' },
  { key: 'giao_vien', role: 'giao_vien', fullNamePrefix: 'Giáo viên', position: 'Giáo viên' },
];

export function staffFullName(roleKey: string): string {
  const entry = STAFF_ROLES.find((r) => r.key === roleKey);
  if (!entry) throw new Error('staffFullName: unknown role key ' + roleKey);
  return entry.fullNamePrefix + ' ' + runId();
}
