# Family force-rotate (leftover 1)

Worktree: `/home/manhquy/Downloads/cmc_edu-family-rotate`
Cleanup is a **constraint**: do not delete OTP, LoginOtp, loginStudent, Brevo/Graph, student tab.
Delete only unused locals the rotate diff creates.

## Acceptance

- New `parentAccount.create` default hash sets `mustChangePassword: true`
- Existing NULL-hash rows stay false (migration default)
- `setFamilyPassword` requires current + new (≥12); bumps `tokenVersion`
- Family `lmsProcedure` blocked until rotate (except `setFamilyPassword`)
- Family token TTL 12h; parent/student stay 7d
- `requestOtp*` / `loginStudent` still exported
