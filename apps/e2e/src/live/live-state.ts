// live-state — gitignored cross-spec runtime state (apps/e2e/.live-run-state.json).
//
// Live specs run sequentially (workers=1) but each in its own Playwright
// worker context — they cannot pass values through variables. This file is
// the durable bridge: spec 01 records the CRM contact name, spec 02 reads it
// to drive the "Ghi danh" receipt, records the parent email + student name,
// spec 04 reads the email for the LMS OTP login, etc. It is ALSO the
// created-data log the coordinator uses for cleanup (mirrored into the
// evidence file plans/reports/uat-live-<ts>/).
//
// The task contract names only apps/e2e/.live-credentials.json for
// credentials; business state lives here so secrets and data stay separate.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { E2E_DIR } from './live-env.js';

export interface CreatedEntity {
  /** spec short name, e.g. '00-setup-roles' */
  spec: string;
  /** e.g. 'staff-account', 'opportunity', 'receipt', 'class-batch', 'parent-email' */
  kind: string;
  /** human label, e.g. 'sale email' */
  label: string;
  /** the created value (email, name, code…) — never a password */
  value: string;
  at: string;
}

export interface LiveRunState {
  version: 1;
  runId: string;
  updatedAt: string;
  /** spec 01/02 — CRM lead / student name (the same person end-to-end). */
  contactName?: string;
  /** spec 02 — parent identity recorded on the receipt (LMS OTP login). */
  parentEmail?: string;
  parentPhone?: string;
  /** spec 02 — created receipt code. */
  receiptCode?: string;
  /** spec 02/03 — class codes. */
  receiptClassCode?: string;
  attendanceClassCode?: string;
  /** spec 00 — staff role → userId (audit-log actor filter). */
  staffUserIds?: Record<string, string>;
  created: CreatedEntity[];
}

const STATE_PATH = new URL('../../.live-run-state.json', import.meta.url);

function emptyState(): LiveRunState {
  return {
    version: 1,
    runId: randomUUID().slice(0, 8),
    updatedAt: new Date().toISOString(),
    created: [],
  };
}

let cache: LiveRunState | null = null;

export function readLiveState(): LiveRunState {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Partial<LiveRunState>;
    cache = { ...emptyState(), ...parsed, created: parsed.created ?? [] };
  } catch {
    cache = emptyState();
  }
  return cache!;
}

export function writeLiveState(next: LiveRunState): void {
  next.updatedAt = new Date().toISOString();
  cache = next;
  mkdirSync(E2E_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), 'utf8');
}

export function updateLiveState(mutate: (state: LiveRunState) => void): void {
  const state = readLiveState();
  mutate(state);
  writeLiveState(state);
}

/** Records one created entity (evidence + coordinator cleanup log). */
export function recordCreated(spec: string, kind: string, label: string, value: string): void {
  updateLiveState((s) => {
    s.created.push({ spec, kind, label, value, at: new Date().toISOString() });
  });
}

/** The run id shared by every live spec of this campaign. */
export function liveRunId(): string {
  return readLiveState().runId;
}

/** Starts a NEW campaign run: fresh runId + cleared per-run fields (staff
 *  emails/names are derived from the runId, so each campaign creates fresh
 *  accounts and never collides with the previous one). The created log is
 *  kept — it is the coordinator's cleanup ledger across runs. */
export function rotateRun(): void {
  writeLiveState({
    ...emptyState(),
    created: readLiveState().created,
  });
}
