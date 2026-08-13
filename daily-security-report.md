# Daily Security Review

## Executive Summary

Overall status:

PASS WITH RECOMMENDATIONS

Review date:
2026-08-12

Branch reviewed:
main

Commits reviewed:
cc9c2d4 (Merge pull request #119 from manhquydev/develop)

Files reviewed:
- apps/api/src/trpc.ts
- apps/api/src/auth/password-routes.ts
- apps/api/src/auth/sso-routes.ts
- apps/api/src/auth/staff-session.ts
- apps/api/src/boot-checks.ts
- apps/api/src/context.ts
- apps/api/src/lms-auth/session-token.ts

Security-sensitive areas reviewed:
- Authentication & Authorization flow (Staff & LMS)
- API endpoint protections
- RLS context and boot assertions
- Cryptography & Session handling

Security tools/tests executed:
- Manual static analysis of codebase and recent pull request diffs.

Critical findings:
0

High findings:
0

Medium findings:
0

Low findings:
0

Needs manual verification:
0

---

## Recent Changes Reviewed

Summarize the security-relevant changes reviewed during this run:
- A large number of UI changes, tests, scripts, and plan/report markdowns were added via PR #119.
- The `trpc.ts` structure was modified to introduce the `auditLogMiddleware`, which automatically logs every SUCCESSFUL mutation to `AuditLog`. It is applied at the root of `basedProcedure` protecting against missing logs on individual mutations.
- The authentication logic for Staff Password and SSO login flows was added.
- The staff session tokens were introduced via `staff-session.ts`, separating their structure and secret (`STAFF_SESSION_SECRET`) from LMS session tokens (`LMS_SESSION_SECRET`).

These changes were reviewed and determined to be safe. They provide defense-in-depth regarding enumeration and timing attacks through features like constant time signature comparison (`timingSafeEqual`) and a `DUMMY_PASSWORD_HASH` for failing passwords.

---

## Confirmed Security Findings

No actionable security vulnerabilities were identified in the reviewed code.

---

## Needs Manual Verification

None.

---

## Dependency Security

No actionable dependency security issues detected.

---

## Secrets Review

No potential secrets detected.

---

## Security-Sensitive Code Reviewed and Considered Safe

- **Staff Password Login (`apps/api/src/auth/password-routes.ts`)**: Validates credentials securely and equalises timing via a dummy hash when matching AppUser does not exist. Employs per-account lockout logic.
- **SSO Login Callback (`apps/api/src/auth/sso-routes.ts`)**: Secure OAuth flow with a random state generation, HMAC-SHA256 signature verification over the state using `STAFF_SESSION_SECRET` providing robust CSRF protection. Fails closed on various validation steps (e.g., matching STAFF_EMAIL_DOMAIN).
- **Session Tokens (`apps/api/src/auth/staff-session.ts` and `apps/api/src/lms-auth/session-token.ts`)**: Uses HttpOnly, securely signed cookies/tokens for staff and LMS separately. Ensures distinct secrets are enforced in production (`boot-checks.ts`).
- **Authorization Bypass Checks (`apps/api/src/boot-checks.ts` and `apps/api/src/context.ts`)**: Fail-closed logic ensures `ALLOW_DEV_AUTH` is not permitted in the production environment. Furthermore, `assertCmcAppNotSuperuser` ensures that the database connection does not inherently bypass all RLS policies.

---

## Limitations

- The report covers recent changes focusing on authentication/authorization and API endpoints within `apps/api`. External infrastructure (e.g., PostgreSQL config) and other unmodified subsystems were not fully analyzed in this run.

---

## Final Assessment

PASS WITH RECOMMENDATIONS
