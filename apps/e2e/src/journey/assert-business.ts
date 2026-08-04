// Business-invariant assertion for acceptance journeys.
//
// The acceptance ledger proves a flow is REACHABLE and green (`proven`) — a
// journey opened the right screens and nothing threw. It does NOT prove the
// numbers are right. A receipt journey can type "Học phí = 5000001", submit,
// and assert only that a "Đã tạo phiếu thu" banner appeared — a green that says
// nothing about whether the receipt actually stored 5000001.
//
// This helper is the one that asserts the arithmetic/state a stakeholder cares
// about (a receipt amount, a payroll total, a star balance, a forbidden action
// staying forbidden). It tags the assertion with a Playwright annotation so the
// `business:verify` gate can tell a flow that checks its numbers apart from one
// that only smoke-passes.
//
// The tag rides on an annotation, not a source marker, so it is recorded in
// journeys.json only when the assertion actually EXECUTED — the same "proven by
// running, not by existing in source" rule flow-evidence.ts already enforces
// (see its `vacuous` badge for the mirror case).

import { expect, test } from '@playwright/test';

/** The annotation type the business-verify gate scans for. Keep in sync with
 *  the literal in scripts/business-verify/verify.ts (INVARIANT_ANNOTATION). */
export const BUSINESS_INVARIANT_ANNOTATION = 'business-invariant';

/**
 * Assert a business invariant inside an acceptance journey.
 *
 * @param label   Human-readable invariant, shown in reports and on failure,
 *                e.g. "phiếu thu lưu đúng số tiền đã nhập".
 * @param actual  The value the system actually produced (read back from the UI
 *                or an authorized API call — never the value the test typed in).
 * @param expected The independently-computed expected value.
 *
 * The annotation is pushed BEFORE the assertion so a business invariant that
 * FAILS is still recorded as attempted; a failed spec never reaches
 * `verified-correct` anyway (the gate also requires the spec to pass), so this
 * only ever helps, by making "this flow tried to check its numbers and the
 * number was wrong" visible instead of silent.
 */
export function assertBusinessInvariant(label: string, actual: unknown, expected: unknown): void {
  test.info().annotations.push({ type: BUSINESS_INVARIANT_ANNOTATION, description: label });
  expect(actual, `business invariant: ${label}`).toEqual(expected);
}
