// session router — client-side mirror of the current staff session.
//
// `session.me` is intentionally a MIRROR, not an authoritative source:
// under dev-header auth (context.ts) the identity is whatever the client
// supplied via `x-dev-user`; it becomes authoritative only after Entra SSO
// is wired. The real security gate is always `can()` + `withFacility` on
// the server — `session.me` is a UI convenience for nav gating and threshold
// display, not a trust boundary. (M5 remediation, phase-01a plan.)

import { APPROVAL_SECOND_EYE_THRESHOLD } from '../finance/router.js';
import { protectedProcedure, router, scoped, staffMustChangePassword } from '../trpc.js';

export const sessionRouter = router({
  /** Returns the calling staff subject's identity and config values that the
   * UI needs for nav gating and threshold-aware button visibility.
   *
   * - `roles`: echoes the session's resolved roles (from dev-header / SSO).
   * - `config.approvalSecondEyeThreshold`: the VND amount above which
   *   `finance.receiptApprove` requires a `giam_doc_dao_tao`/`super_admin`
   *   approver. UI reads this from here — never hardcodes 20,000,000.
   *
   * Security note: `can()` + RLS on every domain procedure are the real gates.
   * Do not treat this response as proof of permissions. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const { facilityId } = scoped(ctx);
    return {
      userId: ctx.subject.userId,
      roles: ctx.subject.roles,
      facilityId,
      config: {
        approvalSecondEyeThreshold: APPROVAL_SECOND_EYE_THRESHOLD,
      },
      mustChangePassword: await staffMustChangePassword(ctx),
    };
  }),
});
