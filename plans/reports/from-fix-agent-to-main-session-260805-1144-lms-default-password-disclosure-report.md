# LMS default-password disclosure — fix report

Date: 2026-08-05
Skill: ak-fix (quick/simple workflow — root cause pre-diagnosed and verified by caller, re-diagnosis skipped per HARD-GATE-EXACT-ROOT-CAUSE "reuse from accepted design" allowance)

## Outcome

The public, unauthenticated student login tab in `apps/lms/src/pages/login.tsx`
no longer discloses the real shared default password (`Cmc2026@`) used for all
newly-provisioned student accounts.

## Root cause (as supplied, verified against file)

`apps/lms/src/pages/login.tsx:208-210`, inside `StudentLoginTab()`, rendered
unconditionally (no `import.meta.env.DEV` gate, unlike `DevHeaderWriter` at
line 326):

```tsx
<Text type="supporting" size="2xs" justify="center" display="block">
  Mật khẩu mặc định: Cmc2026@ — phải đổi lần đầu đăng nhập.
</Text>
```

`Cmc2026@` is hardcoded server-side as the shared provisioning default
(`apps/api/src/student/router.ts:94`, `apps/api/src/provisioning/provision-from-receipt.ts:306`).
Students authenticate with their parent's phone number, not a private
username, so this public string let anyone who knows a newly-enrolled
student's parent phone log into that child's account before the family
changed the password.

## Fix (minimal, cause-aligned)

Replaced the disclosing line with a generic instruction that carries no
secret value:

```diff
-        Mật khẩu mặc định: Cmc2026@ — phải đổi lần đầu đăng nhập.
+        Học sinh mới cần mật khẩu mặc định — vui lòng liên hệ nhân viên tuyển sinh/CSKH để được cấp lại. Bắt buộc đổi mật khẩu ngay lần đăng nhập đầu tiên.
```

Kept: the "must change on first login" expectation-setting (still useful UX),
the header comment block (lines 1-16), the `[DEV ONLY — blocked-on-comms]`
OTP badge/banner (intentional, not a bug), and the `import.meta.env.DEV`
gate on `DevHeaderWriter` (already correct, untouched).

Not touched: `apps/api/*` (provisioning mechanism unchanged — out of scope),
`apps/lms/src/pages/student/change-password.tsx` (post-auth display of the
same string is not a public disclosure — confirmed reachable only after
successful login via `mustChangePassword` redirect).

## Verification

- `grep -n "Cmc2026\|Mật khẩu mặc định" apps/lms/src/pages/login.tsx` →
  no matches (secret value and old disclosing string both gone).
- `pnpm --filter lms typecheck` → clean, no errors.
- Searched for tests referencing this text: `apps/e2e/tests/lms-login.ui.spec.ts`
  and `apps/e2e/tests/journeys/lms-student-activation.journey.ui.spec.ts` both
  reference the literal `Cmc2026@` string, but only to *fill* the password
  field programmatically (`page.getByLabel('Mật khẩu', ...).fill('Cmc2026@')`)
  — neither asserts on the removed display text, so no test breakage.
  `apps/lms` has no local unit-test script (`package.json` scripts: dev,
  build, typecheck, preview only); e2e specs require a running stack and were
  not executed (out of scope — not modified, not required by the stated
  acceptance criteria).
- `git diff --stat -- apps/lms/src/pages/login.tsx` → 1 file, 1 line changed.
- `git status --short` → only `apps/lms/src/pages/login.tsx` modified (plus a
  pre-existing unrelated untracked report file from an earlier session).

## Open risk (not fixed, out of scope per caller's instruction)

The underlying architecture — one hardcoded shared default password
(`Cmc2026@`) for every new student account — is unchanged. This fix stops the
value from being displayed publicly on the login page, but the shared-secret
provisioning design itself remains a risk (e.g. still discoverable via source
code, staff knowledge, or social engineering). A per-student random default
password would close that gap but is a larger provisioning-flow change,
explicitly out of scope here.

Status: DONE
Summary: Replaced the ungated public login text that displayed the literal default password (`Mật khẩu mặc định: Cmc2026@ — phải đổi lần đầu đăng nhập.`) with a generic, non-disclosing instruction directing new students to contact enrollment/support staff for the default password, keeping the "must change on first login" requirement. Only `apps/lms/src/pages/login.tsx` changed (1 line); typecheck is clean; no test depends on the removed text.
