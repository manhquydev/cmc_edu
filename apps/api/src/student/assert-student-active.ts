// Status guard (scenario audit pattern #2, 2026-07-15): a `withdrawn`
// Student is void — deleted-in-spirit (see ../guardian/approved-children.ts's
// docstring on the void/withdraw distinction). Non-LMS staff actions that
// create new records tied to a student (parentMeeting.schedule,
// guardian.approveLink) must reject once a student is withdrawn. `blocked_lms`
// is an LMS-read-only restriction (enforced separately in
// approved-children.ts) — it does NOT block these staff-side writes.

import { badRequest } from '../errors.js';

export function assertStudentActive(student: { lifecycle: string }): void {
  if (student.lifecycle === 'withdrawn') {
    throw badRequest('Student is withdrawn.');
  }
}
