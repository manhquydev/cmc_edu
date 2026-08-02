# CodeQL Auth/Cert Findings Triage — 2026-08-02

Read-only triage of 10 CodeQL default-setup alerts against actual code (HEAD `c9af5f1`, working tree).
App context: staff ERP with email/password login (Entra SSO code present but disabled), HMAC-signed
session cookies, PBKDF2 password hashing.

## Verdict table

| Alert | Rule | File:line | Verdict | Evidence | Fix |
|------|------|-----------|---------|----------|-----|
| #29 | disabling-certificate-validation | scripts/seed-local-sim-demo.ts:24 | ACCEPTABLE-BY-DESIGN | `NODE_TLS_REJECT_UNAUTHORIZED='0'` is set only AFTER a regex gate (line 21) that throws unless `BASE` matches `https://(erp.)?localhost(:port)?`; process only ever fetches `BASE` (loopback, self-signed). Dev seed script gated by `LOCAL_SIM_SEED_ALLOW=1`. | None required. Guard is correct. |
| #28 | clear-text-storage-of-sensitive-data | apps/lms/src/lib/trpc.ts:50 | FALSE-POSITIVE | Taint source is `mustChangePassword` — a **boolean** flag (interface line 36), not a secret. `storeSession` writes it to localStorage; the boolean is not sensitive. | None for the flagged value. See note below on the `sessionToken` in the same object. |
| #27 | clear-text-storage-of-sensitive-data | apps/api/src/auth/password-routes.ts:170 | FALSE-POSITIVE | Line 170 is `headers['Set-Cookie'] = cookie` — the HMAC-signed staff session token delivered via `buildStaffCookieHeader` (HttpOnly, SameSite=Lax, Secure in prod). That is the correct cookie-delivery path, not clear-text at-rest storage. Response body carries only `{ok, mustChangePassword}` — no secret. | None required. |
| #26 | clear-text-storage-of-sensitive-data | apps/api/src/auth/sso-routes.ts:138 | ACCEPTABLE-BY-DESIGN | Set-Cookie for `oauth_state` = random state + HMAC (CSRF token). HttpOnly, SameSite=Lax, 5-min TTL, Secure in prod. Comment at 125 explicitly notes "no secret". CSRF token, not sensitive data. | None required. |
| #22 | insufficient-password-hash | apps/api/src/auth/staff-session.ts:43 | FALSE-POSITIVE (taint mislabel) | `hmacB64` (HMAC-SHA256) signs the **session token**, not a password. HMAC-SHA256 is the correct primitive for token signing. No password is hashed here. | None required. |
| #21 | insufficient-password-hash | apps/api/src/auth/sso-routes.ts:92 | FALSE-POSITIVE (taint mislabel) | `signOauthState` HMAC-SHA256s the random OAuth `state` value read by `parseCookieValue`. It is a CSRF nonce, not a password; HMAC is correct. | None required. |
| #1 | missing-workflow-permissions | .github/workflows/ci.yml job `typecheck-and-test` (~L23 committed) | REAL — ALREADY FIXED (uncommitted) | Committed HEAD had no workflow-level `permissions:`; GITHUB_TOKEN defaulted broad on a public repo. | Working tree adds workflow-level `permissions: contents: read` (L18-19). Correct minimal fix. |
| #2 | missing-workflow-permissions | ci.yml job `e2e` (~L124) | REAL — ALREADY FIXED | Same as #1. | Covered by the workflow-level `contents: read`. |
| #3 | missing-workflow-permissions | ci.yml job `ui-e2e` (~L238) | REAL — ALREADY FIXED | Same as #1; this job uploads an artifact. | Working tree adds job-level `permissions: {contents: read, actions: write}` (L244-246). |
| #4 | missing-workflow-permissions | ci.yml job `security-scan` (~L344) | REAL — ALREADY FIXED | Same as #1; uploads Trivy report. | Working tree adds job-level `permissions: {contents: read, actions: write}` (L353-355). |

## Detail on the REAL findings (#1–#4)

`git diff` on `.github/workflows/ci.yml` shows the exact fix is **already present in the working tree**
(uncommitted, part of plan `plans/260802-1026-p0-local-sim-harden-non-root-loopback-ci-permissions/`).
`git blame` confirms lines 16-20 are "Not Committed Yet". The committed `main` version (blob `3411e10`)
lacked any `permissions:` block, which is exactly what CodeQL flagged. The staged fix is the correct,
minimal least-privilege pattern:

- Workflow-level default `permissions: contents: read` → satisfies the rule for `typecheck-and-test`
  and `e2e` (which only need to read the repo).
- Job-level `contents: read` + `actions: write` on `ui-e2e` and `security-scan` (the two jobs that call
  `actions/upload-artifact`).

Minor accuracy note (non-blocking): `actions/upload-artifact@v4` does not actually require the
`actions: write` GITHUB_TOKEN scope — artifact upload uses the Actions runtime token, not GITHUB_TOKEN
permissions. The `actions: write` grant and its comment are harmlessly over-provisioned. Dropping it to
just `contents: read` on both jobs would be even tighter, but this is a nitpick, not a defect. The
current fix passes the CodeQL rule and is safe to commit as-is.

## FALSE-POSITIVE root cause

All six HIGH auth/cert alerts (#21, #22, #26, #27, #28, #29) are CodeQL taint mislabels or design-correct
patterns:

- The `insufficient-password-hash` rule (#21, #22) fires on any HMAC-of-a-cookie-value, mislabeling
  session-token and CSRF-token signing as "password hashing". The **actual** password hashing lives in
  `apps/api/src/lms-auth/password-hash.ts` — PBKDF2-SHA256, 100k iterations, 16-byte per-password salt,
  `timingSafeEqual` verify. That is a real KDF and CodeQL did not flag it.
- The `clear-text-storage` rule (#26, #27, #28) fires on Set-Cookie writes and a boolean localStorage
  field, none of which store a plaintext secret at rest.
- The cert-validation disable (#29) is loopback-gated in a dev-only seed script.

## Informational (not CodeQL alerts, surfaced during triage — non-blocking)

1. **PBKDF2 iteration count** (`password-hash.ts:20`): 100,000 iterations meets the older NIST SP 800-132
   floor cited in the file comment, but OWASP's 2023 guidance for PBKDF2-HMAC-SHA256 is 600,000. Low-value
   hardening for offline-crack resistance; a one-line constant bump if/when a rehash-on-login path exists.
   Not urgent — online brute force is already rate-limited + lockout-gated.
2. **Session token in localStorage** (`trpc.ts:49-51`): `sessionToken` (LMS bearer) is stored in
   localStorage, XSS-exfiltratable by design. This is the standard SPA bearer pattern and a deliberate
   tradeoff (staff sessions use HttpOnly cookies; LMS uses bearer). Not the flagged issue (#28 flagged the
   boolean), and not a regression — noted only for completeness.

## Recommendation — fix these 0 outstanding real ones

The only REAL findings (#1–#4) already have their correct fix staged in the working tree. **Action: commit
the `ci.yml` change** (with the rest of plan `260802-1026`) and CodeQL alerts #1–#4 will resolve on the next
scan. The six HIGH auth/cert alerts should be **dismissed in the CodeQL UI as false-positive / used-in-tests
/ won't-fix** with the evidence above — no code change is warranted or advisable for any of them.

Priority order (by exploitability): #1–#4 are the only ones with any real security delta (broad GITHUB_TOKEN
on a public repo → risk if a workflow step is compromised), and they are already remediated. Everything else
is noise.

## Unresolved questions

- None blocking. Confirm the working-tree `ci.yml` change lands in the commit that closes plan
  `260802-1026` so the CodeQL alerts actually clear.
