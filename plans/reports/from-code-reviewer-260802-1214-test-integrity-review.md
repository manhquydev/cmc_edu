# Test-Integrity Review — ui-e2e journey suite (PR #46 + #47), final main `88896d7`

Scope: verify the 4-round CI fix (21 failing → 40/40 green) RESTORED coverage
rather than WEAKENED it to chase green. Baseline diffed: `e563f51` (pre-#46) →
`HEAD` (`88896d7`). Every assertion change was checked against the live admin
UI source, not the diff's own claims.

## Verdict: COVERAGE PRESERVED

No vacuous/always-true substitutions, no meaningful assertion deleted, no
unconditional wait/skip/`test.skip` added, no locator swapped to an incidental
element. Two specs were materially STRENGTHENED. Every fix is a faithful
adaptation to real product changes introduced in `01f6e4c` (admin-contract
tightening) — each product claim in the test comments was verified against
source.

## Root-cause chain is real (verified, not assumed)

| Test change | Product change that forced it | Source verified |
|---|---|---|
| create-staff picks a role at create time | "Vai trò" is now REQUIRED on create | `users.tsx:229` `form.roles.length > 0` in `isFormValid`; `handleCreate` sends `roles: form.roles` (line 180) |
| receipt specs assert success banner, not `/finance/:id` URL | `sale` lacks `finance.receiptGet`; create no longer navigates `sale` to detail | `receipt-create.tsx:131` `if (canDo('finance','receiptGet')) navigate(...)`; else in-place banner `Đã tạo phiếu thu ${code}` (line 202) |
| receipt-create specs fill "Email phụ huynh" | `parentEmail` now REQUIRED | `receipt-create.tsx:45` `validate` rejects empty parentEmail |
| grading queue located by student name, not `HS: <prefix>` | queue renders `studentFullName` when set | `grading.tsx:76` `item.studentFullName ?? \`HS: ${prefix}\`` |
| shift-config nav via 'Nhân sự' not 'Quản trị' | shift-config moved to `hr` group | `nav-registry.ts:123-124` group `hr` label 'Nhân sự', child `shift-config` line 139 |

## Per-target findings

### create-staff-via-admin-ui.ts — PRESERVED (adaptation forced, faithful)
Old helper created an account with NO role then drove a post-creation
`user.updateRoles` modal. That path is now dead: the create dialog gates "Tạo"
on a role being picked. New helper picks the role in the required "Vai trò"
MultiSelector, scoped to the open dialog (`page.getByRole('dialog')`) then
`getByRole('button', { name: 'Vai trò', exact: true })`, and selects options by
exact visible label — a real element, not incidental. The scoping rationale
(Astryx keeps closed dialogs mounted → unscoped `getByLabel` is strict-mode
ambiguous) matches the same pattern in `users.test.tsx`. The `position→role`
inference for callers that omit `roleLabels` is sound: those callers' permission
gates read roles from the signed cookie, not this column, so any valid role
unblocks the field without changing what's proven. `findInList` by `fullName`
still confirms the new row appears. Not weakened.

### user-admin-roles.journey.ui.spec.ts — STRENGTHENED
Old premise ("fresh staff has no role badge → assign giao_vien → badge
appears") is impossible now (role required at create). Rewrite creates with
`sale`, asserts the `sale` badge landed, then in the roles modal toggles `sale`
OFF and `Giáo viên` ON, and asserts the transition BOTH ways: `giao_vien`
visible AND `sale` gone. This proves `user.updateRoles` performed a real
REPLACE, not a no-op re-pick — a strictly stronger proof than the original
append. The roles-modal `getByRole('button', { name: 'Roles', exact: true })`
correctly disambiguates from the `hasClear` "Clear all Roles" button.

### provision-student-via-receipt.ts + finance-receipt / crm-receipt / enrollment-second-class / session-assessment-roster — PRESERVED
Two coordinated adaptations, both faithful:
1. Always fill `parentEmail` (default `@e2e.cmc`) — the field is now required;
   callers needing a specific address still pass it (`lms-parent-otp-login`
   passes its own and reads OTP by it). No spec asserted "parent has no email",
   so the always-filled default alters no premise. The parent identity carries
   both phone and email; phone-OTP journeys are unaffected.
2. Replace `expect(salePage).toHaveURL(/finance/:id/)` with
   `expect(getByText(/^Đã tạo phiếu thu /))`. The banner renders only in
   `onSuccess` from the created receipt (`createdReceipt.code`), so it is a
   genuine mutation-succeeded proof, not vacuous. The receipt UUID is now read
   from the APPROVER's real navigation into detail (their role holds
   `receiptGet`) — `sale` never observes it, matching real SoD. The downstream
   business outcome (director approve → provisioning) is untouched.

Note: the banner assertion is marginally less specific than reading the actual
receipt code, but it is the correct current app behavior and the real outcome
is proven downstream. Acceptable.

### receipt-approve-negation.journey.ui.spec.ts — PRESERVED (goto is legitimate, arguably stronger)
The "goto vs click" change is NOT a weakening. Old test relied on the app
auto-navigating `sale` to `/finance/:id`; that navigation no longer happens for
`sale` (ADR-B SoD), so the old `toHaveURL` step is now unreachable. The rewrite
spins a FRESH `sale` session and `page.goto('/finance/:receiptId')` directly,
then asserts the SAME two things: the real `Không tìm thấy phiếu thu` denial
banner (from `receipt-detail.tsx`'s server-denied `error || !receipt` branch)
AND zero `Duyệt & Kích hoạt` buttons. The permission boundary proven
(`finance.receiptGet` excludes `sale`) is identical, and `receiptGet` is
role-based not row-ownership-based, so a fresh session is denied identically.
The `goto` here models forced-browsing/IDOR — exactly the scenario worth
proving — and the denial comes from a real server gate, not a bypassed client
guard. Negation timing is correct: it runs before the approver clicks approve,
and denial is state-independent.

### crm-receipt locator hardening — PRESERVED
"Ghi danh" locator narrowed from `.sh-content`-scoped to an OpportunityCard
scoped by this run's `contactName` + `has` a "Ghi danh" button + `.last()`.
This is a robustness fix for CI-retry orphan cards (`retries: 1`), mirroring the
`groupCard` pattern in shift-config-admin. Still clicks the real button and
asserts nav to `/finance/new?opportunityId=`. Not weakened.

### lms-grade-parent-view / lms-stars-redeem-cycle grading locators — PRESERVED
Same `HS: <prefix>` → `studentName` swap as grading-submission, for the same
verified reason (`grading.tsx:76`). These students are provisioned with real
names, so `studentFullName` is the rendered label. The pre-condition remains
falsifiable (row must be visible before grading) and the row is still clicked.

### shift-config / checkin-offsite / shift-register nav labels — PRESERVED
'Quản trị' → 'Nhân sự' matches the real nav-registry move; route stays
`/admin/shift-config`. `menuNav` selects by the real rendered group label and
still exercises the permission-filtered nav gate.

### vitest 2→4 (#47) — NO SUITE DISABLED
`c9af5f1` touches only `package.json` version fields (vitest, coverage-v8,
vite, plugin-react) + `pnpm-lock.yaml`. NO `vitest.config`/`vite.config` or test
setup file changed (verified by `git show --name-only`). Coverage thresholds
(`--coverage.thresholds.lines=90 --coverage.thresholds.functions=90`) and
`--passWithNoTests` flags are preserved verbatim. No config-level mechanism
could have silently disabled a suite. `apps/e2e/package.json` bumps only
`@playwright/test` 1.49→1.62 and `tsx` 4.19→4.23 — no runner/config change.

## Minor, non-blocking (not test-integrity)
- `shift-config.tsx:291,312` breadcrumb still reads 'Quản trị' > 'Ca làm việc'
  after the nav move to 'Nhân sự' — cosmetic drift, no test asserts on it.
- `finance-receipt.journey.ui.spec.ts:94` comment about `enqueueReceiptEmail`
  no-op on null parentEmail is stale (the spec now passes an email). Harmless.

## Unresolved questions
- None affecting the verdict. All 40 specs were checked for assertion integrity;
  the suite was not run here (READ-ONLY, CI is the measured source of truth per
  AGENTS.md).

Status: DONE
Summary: Coverage PRESERVED across #46/#47. Every green-chasing fix is a faithful
adaptation to real `01f6e4c` contract changes (all product claims source-verified);
user-admin-roles and receipt-approve-negation are strengthened. No vacuous asserts,
deletions, skips, or incidental locators; vitest 2→4 disabled no suite.
Concerns: Two cosmetic stale-comment/breadcrumb nits only; non-blocking.
