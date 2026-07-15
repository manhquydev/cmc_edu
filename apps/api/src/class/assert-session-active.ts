// Status guard (scenario audit pattern #2, 2026-07-15): a `ClassSession` in
// `cancelled` never ran and must reject further writes tied to it (evidence,
// attendance already gated in ../attendance/router.ts's `loadGatedSession`).
// `done` is a separate one-way state (HR remediation phase 7: its hours are
// already credited) — only `assignUnit` needs to block it (changing the
// curriculum unit of an already-taught session), so it is opt-in via
// `alsoBlockDone`, not a blanket rule for every session-scoped write.

import { badRequest } from '../errors.js';

export function assertSessionActive(session: { status: string }, opts?: { alsoBlockDone?: boolean }): void {
  if (session.status === 'cancelled') {
    throw badRequest('Session is cancelled.');
  }
  if (opts?.alsoBlockDone && session.status === 'done') {
    throw badRequest('Session is already done; its curriculum unit is locked.');
  }
}
