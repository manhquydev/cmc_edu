# Red-team plan review — Security Adversary

Plan: `plans/260723-0913-don-tien-uat-truoc-phase-4/`
Reviewer role: Security Adversary · Verification tier: Standard (Fact Checker + Contract Verifier)
Date: 2026-07-23 · Read-only review, no files modified.

---

## Finding 1: The Phase 2 boot check cannot detect the corruption it was written to prevent

- **Severity:** Critical
- **Location:** Phase 2, "Architecture" + "Implementation Steps" Bước 3
- **Flaw:** The whole phase rests on the claim that the bad `BREVO_API_KEY` "nuốt luôn dòng kế tiếp" and therefore contains a line break or stray whitespace. The repository's own incident record says the opposite: the two lines were **concatenated into one physical line with no newline and no whitespace anywhere in the value**.

  ```
  BREVO_API_KEY=xkeysib-<REDACTED>GRAPH_TENANT_ID="<REDACTED>"
  ```

  Against that string, `v !== v.trim()` is false, and the fallback the plan offers, `/[\r\n]/.test(v)`, is also false. Both proposed conditions pass a corrupted key.
- **Failure scenario:** Phase 2 ships, four tests go green (they test a synthetic `'xkeysib-abc\nBREVO_SENDER_EMAIL=…'` string that never existed on disk), Phase 4 records the gap as closed, and the next time a scripted write drops a newline in `.env.prod` the API boots clean and OTP silently dies again — now with a boot check everyone trusts. The plan's own risk row rates this "Cao" but its mitigation ("test là trọng tài") only guards the synthetic shape, because the plan's example test string is the one the implementer will copy.
- **Evidence:**
  - `docs/journals/260711-build-regression-brevo-otp-fix.md:61-66` — root cause, exact corrupted line, "absorbed the next line's `GRAPH_TENANT_ID="…"` assignment directly"
  - `docs/journals/260711-build-regression-brevo-otp-fix.md:23` — same, narrative form
  - Phase 2 lines 105-108 (`v !== v.trim()`) and line 117 (fallback `/[\r\n]/`)
- **Suggested fix:** Check the *format* of the value, not its whitespace. For `BREVO_API_KEY`, assert `/^xkeysib-[A-Za-z0-9-]+$/`; more generally, reject any single-line secret whose value contains `=`, `"`, or a known env-var name. Add the real corrupted string from the journal as the primary test case.

---

## Finding 2: Phase 3's host diagnostic returns "healthy" for the exact file that caused the outage

- **Severity:** Critical
- **Location:** Phase 3, "Implementation Steps" Bước 1 and "Success Criteria" bullet 1
- **Flaw:** The plan asserts `grep -c '^BREVO_SENDER_EMAIL=' .env.prod` returning `0` is a "dấu hiệu dứt điểm" of the swallow, and makes `== 1` a success criterion. In the real incident the swallowed line was `GRAPH_TENANT_ID`, not `BREVO_SENDER_EMAIL`. That grep returned `1` throughout the 12-day outage.
- **Failure scenario:** Operator runs Bước 1 on the UAT host, sees `1`, concludes the file is fine, skips Bước 2, redeploys, and Bước 6 fails with a 401 — the exact "mất thời gian chẩn đoán một lỗi đã biết trước nguyên nhân" the phase's ordering rationale claims to prevent. Worse, if Phase 2 also ships as written (Finding 1), the boot check will not catch it either, so both independent gates report green.
- **Evidence:** `docs/journals/260711-build-regression-brevo-otp-fix.md:63` (swallowed var is `GRAPH_TENANT_ID`); Phase 3 lines 56, 59, 75
- **Suggested fix:** Replace the single-variable grep with a whole-file check: assert the file's line count equals the number of `^[A-Z_]+=` matches, and that no value after the first `=` contains a second `NAME=` token. Drop the `BREVO_SENDER_EMAIL` criterion or generalize it to every declared var in `.env.example`.

---

## Finding 3: Phase 3 misses the documented prerequisite that actually blocks the send — Brevo's IP allowlist

- **Severity:** Critical
- **Location:** Phase 3, "Implementation Steps" (all six steps) and "Risk Assessment"
- **Flaw:** The Brevo account has IP allowlisting enabled. The journal's remaining-work list names, as step (1) of three, "add cmcv2-prod's VPS outbound IP to Brevo's authorised-IPs". Phase 3 has no such step. Its risk table enumerates "khoá bị thu hồi, tài khoản Brevo hết hạn" but never the allowlist — the one failure mode that has already been observed and diagnosed in this repo.
- **Failure scenario:** The `.env.prod` newline is fixed, boot succeeds, Bước 6 sends the parent OTP, Brevo answers `401 unrecognised IP address`, and the operator — primed by the plan to believe 401 means a malformed key — loops back to Bước 2 and re-edits a file that is already correct. The plan's stated value ("fail ở đây thì chỉ lùi lịch") is preserved, but the diagnosis loop it hands the operator points at the wrong cause.
- **Evidence:**
  - `docs/journals/260711-build-regression-brevo-otp-fix.md:71` — "401 'unrecognised IP address' (Brevo account has IP-allowlist enabled)"
  - `docs/journals/260711-build-regression-brevo-otp-fix.md:75` and `:157` — "add cmcv2-prod's VPS outbound IP to Brevo's authorised-IPs" listed as remaining step 1
- **Suggested fix:** Insert a step between Bước 3 and Bước 4: confirm the UAT host's outbound IP is on Brevo's authorised-IPs list, and add a `401 unrecognised IP address ⇒ allowlist, not key` branch to the Bước 6 troubleshooting path.

---

## Finding 4: Phase 3 closes a red BLOCKING security gate (rotate the key) with no evidence, and Phase 4 leaves the contradiction in the runbook

- **Severity:** High
- **Location:** Phase 3, Bước 2 + Success Criteria ("Không dán khoá Brevo mới"); Phase 4, "Related Code Files" (§8d not in scope)
- **Flaw:** Two problems, one root.
  1. The runbook carries `🔴 **Brevo key phải rotate + verify TRƯỚC bước 5**` as a Phase-4 prerequisite. Phase 3 decides the opposite ("khoá không sai") and cites a brainstorm report, not the incident record. The incident record contains an unresolved security action: live Brevo SMTP + API keys were pasted verbatim into an assistant session and "should be rotated on Brevo dashboard after this work completes". Choosing not to rotate leaves a credential with a known disclosure event live in the production stack that is about to be handed to seven UAT participants.
  2. Phase 4's scope is §5, §8, §9 and TL27. §8d is not in it. So after the whole batch lands, the runbook still says `🔴 rotate` while the plan says do not rotate — a fresh self-contradiction in the document whose stated acceptance criterion is "đọc từ đầu tới cuối không gặp mâu thuẫn nào".
  3. Secondary factual issue: the journal says the fix was validated with a **fresh** key ("A fresh API key was tested … The key is valid", and remaining step "Update `.env.prod` with rotated key"). Phase 3's premise that the working configuration uses the original key is not supported by the record.
- **Failure scenario:** UAT runs against a Brevo key that a prior transcript exposed; nobody rotates it because Phase 3 forbade it and the closing acceptance read of the runbook flags §8d as an unexplained contradiction, stalling the session exactly as Phase 4 says it must not.
- **Evidence:**
  - `docs/runbook-uat-golive.md:272` — the 🔴 rotate row
  - `docs/journals/260711-build-regression-brevo-otp-fix.md:77` — "User pasted live Brevo SMTP + API keys directly in this session. Both should be rotated"
  - `docs/journals/260711-build-regression-brevo-otp-fix.md:23`, `:179` — fresh key tested; "Update `.env.prod` with rotated key"
  - Phase 3 lines 61, 80; Phase 4 lines 36-38
- **Suggested fix:** Either rotate (and say so), or add §8d to Phase 4's scope with a written PO decision recording *why* a key with a disclosure event is acceptable for UAT. Do not leave the runbook holding both positions.

---

## Finding 5: Phase 1's "PermissionGate is the real second layer" claim is false for one of the four screens

- **Severity:** High
- **Location:** Phase 1, "Requirements" (Non-functional, bullet 2) and "Architecture"; Success Criteria bullet 6
- **Flaw:** The plan states the route-level `PermissionGate` stays as the second layer and that hiding a nav entry does not replace it. That is true for `/admin/courses`, `/admin/engagement/gifts` and `/admin/engagement/rewards`, all of which live in `admin.routes.tsx`. It is **not** true for `/finance/class-placement`: `finance.routes.tsx` contains no `PermissionGate` at all. `grep -rn "PermissionGate" apps/admin/src --include=*.tsx | grep -v test` returns exactly 3 non-test usages, all in `admin.routes.tsx` (lines 71, 84, 94). For class placement the nav gate is the only front-end gate that exists.
- **Failure scenario:** Phase 4 Bước 3 rewrites the runbook to say §4.3 "vào bằng menu" now applies fully to these screens. UAT testers and reviewers then read a missing menu entry as proof of a permission boundary. For `/finance/class-placement` the screen is still fully reachable by URL for any authenticated staff role, and the page's read path (`student.lookup`, `classBatch.list`) is not gated by `enrollment.enroll` — `student.lookup` is granted to `giao_vien`. A teacher who types the URL still gets a working student search over children's names and a class roster; only the enrol mutation 403s. The plan's own risk row ("Nav mới lộ màn cho vai không có quyền — mitigated by PermissionGate ở route vẫn là lớp hai") does not hold for this entry.
- **Evidence:**
  - `apps/admin/src/routes/finance.routes.tsx:36-44` — `class-placement` route, `Suspense` only, no gate
  - `apps/admin/src/routes/admin.routes.tsx:71,84,94` — the only three `PermissionGate` usages
  - `apps/admin/src/pages/enrollment/class-placement.tsx:44` (`trpc.student.lookup`), `:52` (`trpc.classBatch.list`), `:54` (`trpc.enrollment.enroll`)
  - `packages/auth/src/index.ts:76` — `student.lookup` includes `giao_vien`; `:69` — `enrollment.enroll` does not
- **Suggested fix:** Either add `PermissionGate module="enrollment" action="enroll"` to `finance.routes.tsx` in Phase 1 (a two-line change matching the established pattern), or strike the "lớp hai" claim from Phase 1 and the runbook rewrite and record the URL reachability as accepted risk.

---

## Finding 6: Adding nav entries silently shrinks the authorization-probe matrix

- **Severity:** High
- **Location:** Phase 1, "Related Code Files" (omission) and Success Criteria
- **Flaw:** `buildScreenRoleMatrix` skips a (screen, role) pair when the screen **has** a nav entry whose permission the role fails. A screen with **no** nav entry is opened by every business role, precisely because "nothing declares who is supposed to reach those, which is exactly why they need looking at". All four screens Phase 1 touches are currently in the no-nav-entry group, so all four are probed by all four business roles today. After Phase 1 they are not.

  Removed probes: `/admin/courses` × {GĐKD, sale, giao_vien}, `/admin/engagement/gifts` × {giao_vien}, `/admin/engagement/rewards` × {giao_vien}, `/finance/class-placement` × {giao_vien} — six (screen, role) authorization captures, including the only automated probe of the ungated class-placement screen from Finding 5.
- **Failure scenario:** Phase 1 lands. `pnpm --filter @cmc/admin test` is green, `pnpm typecheck`/`lint` green, all Phase 1 success criteria met. The runtime capture that would have recorded "giao_vien opened /finance/class-placement and successfully called student.lookup" no longer opens that pair. The plan reduces the repo's authorization test surface while its own narrative says nav is not a security boundary.

  Secondary contract miss: `apps/e2e/screen-role-matrix.json` is a **committed generated artifact** (`pairCount: 118`) regenerated only by manually running `apps/e2e/src/generate-screen-role-matrix.ts`. Phase 1's Related Code Files lists two files and neither the generator, the scanner, nor the artifact. Nothing in `pnpm test` regenerates or freshness-checks it, so the runbook §9 gate "e2e chạy lại sau redeploy, xanh" will run against a stale matrix and still pass.
- **Evidence:**
  - `apps/e2e/src/screen-role-matrix.ts:69-72` — the skip branch; `:10-12` — the "every business role for a screen with no entry" rule
  - `apps/e2e/src/scan-nav-entries.ts:17` — reads `apps/admin/src/shell/nav-registry.ts` as source
  - `apps/e2e/src/generate-screen-role-matrix.ts:20-35` — writes the committed JSON
  - `apps/e2e/screen-role-matrix.json` — git-tracked, `pairCount: 118`
  - `apps/e2e/tests/screen-role-capture.ui.spec.ts:113,119,122,182` — consumes the JSON, reports `pairsInMatrix`
  - Phase 1 lines 44-46 (file list)
- **Suggested fix:** Add to Phase 1: regenerate `screen-role-matrix.json`, record the before/after `pairCount`, and explicitly list the six dropped pairs with a justification per pair. Consider changing `buildScreenRoleMatrix` to keep denied pairs marked `expectDenied` rather than dropping them — a nav gate should narrow expectations, not delete the probe.

---

## Finding 7: Phase 4 D1 deletes a documented authorization fact that the code enforces

- **Severity:** High
- **Location:** plan.md "Quyết định đã chốt" D1; Phase 4, Bước 4
- **Flaw:** D1 removes `super_admin` from the WF-P3-02 actor line on the grounds that it is "đường thoát hiểm quản trị, không phải vai nghiệp vụ duyệt phiếu". The code says otherwise: for a ticket whose owner has no track (a director or super_admin), `super_admin` is the **only** role that can approve it. That is not a bypass — it is the sole approval path for a whole class of tickets, documented eleven lines further down the same file the phase edits, asserted by a named test, and acknowledged in the acceptance manifest's own comment.
- **Failure scenario:** TL27:47 loses `super_admin`; TL27:66-67 still says "Chủ phiếu không có track (GĐ/super_admin) → chỉ `super_admin` duyệt". Phase 4's acceptance criterion is "đọc runbook/spec không gặp mâu thuẫn" — the edit manufactures a new one inside TL27 itself. Downstream, a UAT participant reading the corrected actor line will not assign anyone to test director-owned timesheet approval, which is the one path where a single super-user is the only authority — exactly the path that most deserves a human check before go-live.

  Note also that the plan's claim "manifest P3-02 không khai super_admin, đã khớp" is only true of the `actorRoles` array; the comment directly above it states the opposite fact.
- **Evidence:**
  - `apps/api/src/checkin/router.ts:142-143` — "a track-less owner (director/super_admin, no sale/giao_vien role) can then ONLY be reviewed by `super_admin`"; `:158` — `if (reviewerRoles.includes('super_admin')) return;`
  - `apps/api/src/checkin/manual-punch-approval-track.test.ts:212` — "chủ phiếu role null (không sale/giao_vien) → chỉ super_admin duyệt được"
  - `docs/27-workflow-spec-p3.md:66-67` — the rule the edit would contradict
  - `scripts/acceptance-report/flow-manifest.ts:324-325` — "Phiếu do GĐ sở hữu chỉ super_admin duyệt được"
  - `docs/25-ma-tran-truy-vet-p1.md:39` — TL25 P3-02 row (verified: actor column reads `nhân viên / GĐ track`)
- **Suggested fix:** Do not delete. Reword TL27:47 to distinguish the routine approver (GĐ theo track) from the residual-case approver (`super_admin`, for track-less owners), and align TL25:39 up to that instead of aligning TL27 down. If PO genuinely wants super_admin out of the P3-02 actor set, that is a code change to `router.ts:158`, not a doc edit — and it is out of this batch's stated invariants.

---

## Finding 8: The `gift.list` gate puts a configuration screen in `sale`'s sidebar where every action 403s

- **Severity:** Medium
- **Location:** Phase 1, "Requirements" table row 1; "Risk Assessment" row 3
- **Flaw:** `/admin/engagement/gifts` is the P4-02 "Cấu hình quà đổi sao" screen. Its only mutation is `gift.upsert` (GĐKD, GĐĐT). Gating the menu entry on `gift.list` (which includes `sale`) violates the convention the same file states twice — "the menu entry follows the same key instead of inviting a 403" and "the menu entry must not promise more than that".

  The plan's justification for rejecting `gift.upsert` is that it would cost "sale mất lối vào P4-02". That premise is false: P4-02's manifest `actorRoles` is `['giam_doc_kinh_doanh', 'giam_doc_dao_tao']`, and the runbook §5 lists P4-02 only under the two director roles (lines 131 and 154), never under sale (§5 sale block, lines 97-114).
- **Failure scenario:** A UAT participant playing `sale` sees "Quà tặng" in the menu, opens it, and every create/edit control fails. §4.3 says entry via menu is the rule, so the tester logs a FAIL against a screen they were never an actor for, consuming one of the three "chấp nhận có điều kiện" slots the Go/No-Go ceiling allows.
- **Evidence:**
  - `apps/admin/src/pages/engagement/gifts.tsx:76` (`trpc.gift.list`), `:78` (`trpc.gift.upsert`)
  - `packages/auth/src/index.ts:140` (`gift.upsert` → 2 directors), `:142` (`gift.list` → +sale)
  - `scripts/acceptance-report/flow-manifest.ts:467` — P4-02 `actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao']`
  - `docs/runbook-uat-golive.md:131,154` — P4-02 rows; absent from the sale block at `:97-114`
  - `apps/admin/src/shell/nav-registry.ts:24` and `:57` — the stated convention
- **Suggested fix:** Gate `/admin/engagement/gifts` on `gift.upsert` and keep `rewards.manage` for `/admin/engagement/rewards` (P4-01 does include sale, and the rewards page is a work queue, not a config surface). Correct the risk-table rationale.

---

## Finding 9: The six-secret list omits the secret whose corruption is unrecoverable

- **Severity:** Medium
- **Location:** Phase 2, "Architecture" (the `SINGLE_LINE_SECRETS` list)
- **Flaw:** The list covers Brevo, Entra, Graph and S3 credentials but excludes `BACKUP_ENCRYPTION_PASSPHRASE`, `STAFF_SESSION_SECRET` and `LMS_SESSION_SECRET` — all production-required, all single-line, all consumed as opaque strings. `BACKUP_ENCRYPTION_PASSPHRASE` is passed to `openssl -pass env:` on both the backup and the restore path. A malformed value there is the same class of silent failure the phase exists to eliminate, with a worse blast radius: backups encrypt successfully with a passphrase that does not match the escrowed one, and the corruption is discovered only during a restore that must succeed.
- **Failure scenario:** UAT §3 step 1 takes a backup with a passphrase that silently gained a trailing byte from a scripted `.env.prod` write. `restore-drill.sh` on the drill target decrypts with the same corrupted env value and passes. Months later a real restore from the escrowed passphrase fails, and the go-live backup set is unreadable.
- **Evidence:**
  - `scripts/env-check.sh:36` — `BACKUP_ENCRYPTION_PASSPHRASE` is production-required; `:33` — `STAFF_SESSION_SECRET`
  - `scripts/backup-db.sh:20,56` and `scripts/restore-drill.sh:24,93` — `-pass env:BACKUP_ENCRYPTION_PASSPHRASE`
  - `apps/api/src/boot-checks.ts:128-158` — the existing staff/LMS secret checks compare and defaults-check but never shape-check
  - Phase 2 line 42
- **Suggested fix:** Add the three variables to the list. They are already production-required, so this does not violate the phase's "không thêm biến bắt buộc mới" constraint.

---

## Finding 10: Phase 3's mandated evidence puts a real parent's mailbox into a git-tracked directory, and prod has no parent to send to

- **Severity:** Medium
- **Location:** Phase 3, "Bằng chứng bắt buộc" and Bước 6-7
- **Flaw:** Two coupled problems.
  1. The phase requires a screenshot of a received inbox saved into `plans/260723-0913-…/reports/` — a version-controlled path. Via the parent-OTP route that screenshot contains a real guardian's email address and a login OTP, committed to repo history in a product whose stated posture is that it handles children's personal data. The risk table considers only leakage of the API key value.
  2. The route itself may not be runnable: the plan states `cmc_prod` was measured empty on 2026-07-22 (1 Facility seed, every other table 0), and Phase 3 acknowledges the OTP path needs an existing `AppUser`. So Bước 6 requires creating a real parent identity in production. Phase 3 has no cleanup step, and the runbook's §6 row-count criterion ("đếm row sau = trước") is taken during the UAT session — rows created now either break that reconciliation or leave a live LMS-capable account in the go-live database.
- **Failure scenario:** Operator seeds a parent to make Bước 6 work, screenshots the OTP mail, commits it to `reports/`. The repo now contains a live-window OTP and a real email address; the UAT row count no longer reconciles; and nobody owns deleting the seeded guardian before go-live.
- **Evidence:**
  - Phase 3 lines 27-28 (evidence must land in `reports/`), line 69 (`sso-routes` rejects users without an `AppUser`, so use the parent OTP flow)
  - plan.md line 96-97 and Phase 3 line 89 — `cmc_prod` measured empty
  - `docs/runbook-uat-golive.md:295` — "Bước 7–8 xong: đếm row sau = trước … ⇒ DB sạch cho go-live"
  - `apps/api/src/worker/email-transport.ts:56-57` — `console.log('[brevo] sending id=… to=…')` writes recipient addresses to worker logs, the log the journal tells operators to grep (`docs/journals/260711-build-regression-brevo-otp-fix.md:160`)
- **Suggested fix:** Send to a staff-owned mailbox on the `STAFF_EMAIL_DOMAIN` rather than a guardian's, redact the address and OTP in the screenshot, store the artifact outside the repo (or add the path to `.gitignore` and reference it), and add an explicit cleanup + row-count-baseline step so Bước 6 does not contaminate the §6 reconciliation.

---

## Minor (recorded, not blocking)

**Phase 1 risk row 2** claims the test `returns exactly 5 groups for sale` is "gần như chắc chắn" to break and instructs the implementer to fix it. That test asserts no count — it is four `toContain`/`not.toContain` calls (`apps/admin/src/shell/nav-registry.test.ts:14-20`), and the same is true of the `giao_vien` twin at `:22-27`. Nothing will break. The real state is the inverse and worth stating: **no test guards the module set**, so a module added without `roles` and with a mis-chosen child key can appear in a role's sidebar with no test objecting. The instruction "sửa test cũ cho khớp số nhóm mới" invites editing a passing test for a failure that will not occur.

---

## Verification Results

- **Tier:** Standard (Fact Checker + Contract Verifier)
- **Claims checked:** 26 across 4 phases
- **VERIFIED:** 18 · **FAILED:** 6 · **UNVERIFIED:** 2

### Verified (sample)
| Claim | Result |
|---|---|
| `gift.list` = GĐKD/GĐĐT/sale | VERIFIED `packages/auth/src/index.ts:142` |
| `rewards.manage` = GĐKD/GĐĐT/sale | VERIFIED `packages/auth/src/index.ts:143` |
| `course.manage` = GĐĐT only | VERIFIED `packages/auth/src/index.ts:82` |
| `enrollment.enroll` = GĐKD/GĐĐT/sale | VERIFIED `packages/auth/src/index.ts:69` |
| gift keys at `index.ts:140-143` | VERIFIED |
| `boot-checks.ts` docblock "Reports only variable NAMES, never values" | VERIFIED `apps/api/src/boot-checks.ts:165` |
| `env-check.sh` only lists names | VERIFIED `scripts/env-check.sh:12-42` |
| `leaderboard.tsx:18` is an `EmptyState` coming-soon | VERIFIED `apps/admin/src/pages/engagement/leaderboard.tsx:18` |
| `/finance/new` has a button from `/finance` | VERIFIED `apps/admin/src/pages/finance/receipt-list.tsx:133` |
| acceptance report = 37 built / 1 partial, `actorAudit.findings` = `[]` | VERIFIED `acceptance-report/verification.json` |
| ci.yml acceptance gate is `continue-on-error` with the "earn trust" rationale | VERIFIED `.github/workflows/ci.yml:86-94` (plan cites `:88-92`, substantively correct) |
| `nav-registry.test.ts:127-130` comment on why to use `visibleNavPathsFor` | VERIFIED `:128-131` |
| §5 already has P3-01 and P4-03 rows for 4 roles | VERIFIED `docs/runbook-uat-golive.md:105,111,122,132,145,155,167` |
| manifest P3-02 `actorRoles` excludes `super_admin` | VERIFIED `scripts/acceptance-report/flow-manifest.ts:326` |

### FAILED
| # | Claim | Why it failed |
|---|---|---|
| F1 | Phase 2: the corrupted key "chứa ký tự xuống dòng" | The recorded corruption is a newline-free concatenation — `docs/journals/260711-build-regression-brevo-otp-fix.md:63`. Neither proposed condition matches. |
| F2 | Phase 3: `grep -c '^BREVO_SENDER_EMAIL='` returning 0 is the definitive symptom | The swallowed variable was `GRAPH_TENANT_ID`; that grep returned 1 during the outage — journal `:63` |
| F3 | Phase 1: "`PermissionGate` ở tầng route giữ nguyên làm lớp hai" for all four screens | `apps/admin/src/routes/finance.routes.tsx` has zero `PermissionGate`; only 3 non-test usages exist, all in `admin.routes.tsx:71,84,94` |
| F4 | Phase 1 risk: `returns exactly 5 groups for sale` will break | Test asserts no count — `apps/admin/src/shell/nav-registry.test.ts:14-20` |
| F5 | Phase 1 risk: gating gifts on `gift.upsert` would cost sale its way into P4-02 | P4-02 `actorRoles` = 2 directors — `flow-manifest.ts:467`; §5 lists P4-02 only at `docs/runbook-uat-golive.md:131,154` |
| F6 | D1: `super_admin` is not a P3-02 approver, only an escape hatch | It is the sole approver for track-less owners — `apps/api/src/checkin/router.ts:142-143`, `manual-punch-approval-track.test.ts:212`, `docs/27-workflow-spec-p3.md:66-67` |

### UNVERIFIED
- Phase 3's assertion that the current `.env.prod` on the UAT host is unfixed — out-of-repo state, unverifiable here. Journal `:75` ("NOT yet applied to live VPS") supports the assumption.
- Phase 4's claim that the 21 unreachable-procedure triage is complete (9 + 11 + 1) — the count reconciles arithmetically, but the triage record itself is in a brainstorm report not read for this review.

### Contract enumeration (Phase 1)
Consumers of the symbols Phase 1 modifies — 5 files, none of which appear in Phase 1's Related Code Files beyond the first two:
1. `apps/admin/src/shell/shell.tsx:5,20` — `visibleModulesFor` + `isNavChildVisible`
2. `apps/admin/src/shell/nav-registry.test.ts:2` — `NAV_MODULES`, both helpers
3. `apps/e2e/src/scan-nav-entries.ts:17` — parses `nav-registry.ts` with ts-morph **(missing from plan)**
4. `apps/e2e/src/generate-screen-role-matrix.ts:22` → writes `apps/e2e/screen-role-matrix.json` (committed, `pairCount: 118`) **(missing from plan)**
5. `apps/e2e/tests/screen-role-capture.ui.spec.ts:113,119` — consumes the committed matrix **(missing from plan)**
