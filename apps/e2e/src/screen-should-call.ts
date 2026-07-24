import type { Role } from '@cmc/auth';

// (path, role) pairs KNOWN to issue at least one tRPC call on mount, when the
// role has real permission to be on that screen. This is not a data-shape
// expectation (no listField, no non-empty claim) — only "does the screen ask
// the API for anything at all". A pair in this list that produced zero calls
// during the sweep means a client-side gate (a `canDo()` check or similar)
// stopped the screen from calling out before it ever reached the network —
// invisible to plain denied/notFound detection, because no request means no
// response to inspect.
//
// Seeded with exactly the 3 screens tied to the incidents this capture exists
// to prevent (plans/260723-1422-may-hoa-nghiem-thu-ba-tang, phase 1):
//   - /finance/class-placement: fires `classBatch.list` unconditionally on
//     mount (apps/admin/src/pages/enrollment/class-placement.tsx) to populate
//     the class-selector dropdown.
//   - /teaching/session-assessment: fires `classBatch.list` unconditionally
//     on mount (apps/admin/src/pages/teaching/session-assessment.tsx). This
//     only proves the page's FIRST query fired — it is NOT a check on
//     `classBatch.listStudents` (the nested, `classBatch.classBatchId`-gated
//     call that F2's actual incident broke, itself gated server-side by
//     `classRoster.read`), which only fires after selecting a class, an
//     interaction this sweep never drives. Re-proving that specific
//     regression is Phase 4's job (a real journey that drives the interaction
//     and falsifies the actual gate) — this entry only guards against the
//     page dying at mount for these roles, a narrower but still real check.
//   - /hr/payroll: fires `user.pickList` unconditionally on mount
//     (apps/admin/src/pages/hr/payroll.tsx) to populate the staff list.
//
// New entries need the same evidence: a read of the page component showing an
// unconditional (non-`enabled`-gated, or gated only on state guaranteed
// present at mount) query fired for that role.
export interface ScreenShouldCallPair {
  path: string;
  role: Role;
}

export const SCREEN_SHOULD_CALL: readonly ScreenShouldCallPair[] = [
  { path: '/finance/class-placement', role: 'giam_doc_kinh_doanh' },
  { path: '/finance/class-placement', role: 'giam_doc_dao_tao' },
  { path: '/finance/class-placement', role: 'sale' },
  { path: '/teaching/session-assessment', role: 'giao_vien' },
  { path: '/teaching/session-assessment', role: 'giam_doc_dao_tao' },
  { path: '/hr/payroll', role: 'giam_doc_kinh_doanh' },
  { path: '/hr/payroll', role: 'giam_doc_dao_tao' },
];
