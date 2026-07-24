// Composes one flow's ledger state from three inputs: what the static scan
// found (`FlowStatus`), what the manifest declares (`journey`, `statusReason`),
// and what a real Playwright run did (`RunFacts`).
//
// Kept separate from verify.ts because verify.ts runs `main()` on import — the
// rules below have to be unit-testable without launching the scanners.
//
// The single rule the whole ledger rests on: `proven` is reachable from
// exactly one place, an ingested run at the current commit in which the flow's
// own spec really executed and really passed. Everything else degrades to a
// state that says why it is not proven, and says it out loud.

import type { FlowEntry, FlowEvidence, FlowStatus, RunFacts } from './types.js';

/** `built` flows fall back to "built, unproven"; anything less complete is
 *  still "under construction". Evidence can only ever promote a flow to
 *  `proven` — it never upgrades an unbuilt flow into a built one. */
function fallbackState(status: FlowStatus): FlowEvidence['state'] {
  return status === 'built' ? 'built-unproven' : 'not-yet';
}

export function composeFlowEvidence(
  flow: FlowEntry,
  status: FlowStatus,
  facts: RunFacts | null,
  headSha: string,
): FlowEvidence {
  const fallback = fallbackState(status);
  const reason = flow.statusReason;

  // Triage established this flow's declared journey does not actually drive
  // what the flow claims. The spec may well pass — it just is not evidence
  // ABOUT THIS FLOW. Checked before the results are consulted, because a
  // passing run is exactly the case that would otherwise render a false ⬤ on
  // the stakeholder page while the tool complained only on a terminal nobody
  // screenshots.
  if (reason?.code === 'h2-mismatch') {
    return { state: fallback, badge: 'h2-mismatch', detail: reason.detail };
  }

  if (!flow.journey) {
    if (reason?.code === 'no-ui-path') {
      return { state: 'not-yet', badge: 'no-ui-path', detail: reason.detail };
    }
    return { state: fallback, badge: 'no-journey' };
  }

  if (!facts) {
    return { state: fallback, badge: 'no-results', detail: 'Chưa có kết quả chạy nào được nạp.' };
  }

  // A run from another commit describes another codebase. It may well be
  // green; it is not evidence about THIS worktree, so it cannot carry a flow.
  if (facts.sha === null) {
    return {
      state: fallback,
      badge: 'stale',
      detail: 'Kết quả không ghi commit — không đối chiếu được với HEAD.',
    };
  }
  if (facts.sha !== headSha) {
    return {
      state: fallback,
      badge: 'stale',
      detail: `Kết quả chạy ở commit ${facts.sha}, HEAD hiện tại là ${headSha}.`,
    };
  }

  const spec = facts.specs[flow.journey];
  if (!spec) {
    return {
      state: fallback,
      badge: 'partial',
      detail: 'Luồng có khai journey nhưng spec đó không có trong kết quả — lần chạy chỉ phủ một phần.',
    };
  }

  if (spec.outcome === 'fail') {
    return reason?.code === 'red-fixme'
      ? { state: fallback, badge: 'red-fixme', detail: reason.detail }
      : { state: fallback, badge: 'red-untriaged' };
  }

  // Nothing ran: every test in the file was fixme/skip. Reporting this as
  // proven would certify a flow nobody tested — the exact failure this whole
  // ingestion exists to prevent.
  if (spec.outcome === 'skipped') {
    return reason?.code === 'red-fixme'
      ? { state: fallback, badge: 'red-fixme', detail: reason.detail }
      : {
          state: fallback,
          badge: 'vacuous',
          detail: 'Spec có chạy nhưng mọi test đều fixme/skip — không có assertion nào thực thi.',
        };
  }

  // The spec passed — but "a journey passed" and "the flow is built" are
  // different claims, and ⬤ asserts both. A flow whose static scan is still
  // `partial`/`missing` has a missing procedure, route, model, or a placeholder
  // screen; a green journey that happened not to touch the missing part does
  // not make it delivered. Without this guard the stakeholder card would show
  // ⬤ "Đã chứng minh chạy" directly above "Màn hình chưa được xây".
  if (status !== 'built') {
    return {
      state: fallback,
      badge: 'passed-not-built',
      detail: 'Bài kiểm chạy xanh nhưng luồng chưa xây đủ (thiếu màn/procedure/model hoặc còn trang giữ chỗ).',
    };
  }

  return { state: 'proven', badge: 'proven' };
}

/** Declared journey specs that the run never touched. A non-empty list means
 *  the results describe part of the suite, so they cannot back a ledger of
 *  record even where individual flows look green. */
export function findUnrunJourneys(flows: readonly FlowEntry[], facts: RunFacts | null): string[] {
  if (!facts) return [];
  return flows
    .filter((flow) => flow.journey && !facts.specs[flow.journey])
    .map((flow) => flow.journey!)
    .sort();
}
