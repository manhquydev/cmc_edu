# Implementation Report — Live-Domain E2E Suite (Playwright)

**Date:** 260815 | **Branch:** feat/back-before-design | **Mode:** implement + typecheck + lint + --list (NO live run)
**Scope:** files created/modified ONLY under apps/e2e/ (+ this report, per task instruction).

---

## 1. Files created / modified

All under apps/e2e/:

| File | Kind | Purpose |
|------|------|---------|
| apps/e2e/playwright.live.config.ts | new | SEPARATE live config: projects live-admin (baseURL https://erp.clawcmc.io.vn) + live-lms (baseURL https://hoc.clawcmc.io.vn); workers=1, fullyParallel=false, retries=0, timeout 90s; NO webServer; globalSetup = health-check only; outputDir test-results-live/; screenshot/video/trace retain-on-failure; **PLAYWRIGHT_LIVE=1 safety gate** (config throws a clear error without it, mirroring the PLAYWRIGHT_UI pattern). playwright.config.ts untouched. |
| apps/e2e/src/live/live-global-setup.ts | new | Health-check preflight only: GET /health on BOTH live origins (nginx routes /health to the API on both vhosts); fails fast with a clear message if either is down. Never touches the DB, never spawns a server, never tears down. |
| apps/e2e/src/live/live-env.ts | new | Dependency-free .env.prod parser (dotenv is not a direct dep of @cmc/e2e and pnpm strict layout forbids transitive import — so no lockfile/root change). Exposes SUPER_ADMIN_*; never prints values. |
| apps/e2e/src/live/live-credentials.ts | new | Gitignored apps/e2e/.live-credentials.json {email, password, changedAt, userId, session} for superAdmin + each staff role. liveSuperAdminCredentials() = saved-first (rotated), env bootstrap fallback — the task "reruns use the saved password". Session cookies persisted for replay. |
| apps/e2e/src/live/live-state.ts | new | Gitignored apps/e2e/.live-run-state.json: cross-spec business data (contactName, parentEmail/phone, receiptCode, class codes, staffUserIds) + append-only created-entities log (coordinator cleanup). rotateRun() gives every campaign a fresh runId → fresh emails → no AppUser collisions on reruns. |
| apps/e2e/src/live/live-auth.ts | new | loginViaUi(page,{email,password}) (#login-email/#login-password/Đăng nhập); forced /change-password rotation (Mật khẩu hiện tại / mới / xác nhận / Đổi mật khẩu); openStaffSession(browser, role) = cookie replay first, fresh UI login + rotation fallback; paceStaffLogin() (20s floor, LIVE_STAFF_LOGIN_PACING_MS); session capture/persist. Passwords never logged. |
| apps/e2e/src/live/live-otp.ts | new | readOtpFromEmailOutbox(emailLike): poll EmailOutbox payload.code via docker exec cmcv2-prod-postgres-1 psql -U postgres -d cmc_prod -tAc (READ-ONLY), fallback to LoginOtp.codeHash sha256 brute-force when the worker scrubs payloads. Container/db/user overridable via LIVE_POSTGRES_* env. |
| apps/e2e/src/live/live-evidence.ts | new | Per-spec collector → plans/reports/uat-live-<ts>/result.json + README.md (NOT acceptance-results/journeys.json). attachErrorCollectors(page) (pageerror/console-error/request-failed), assertNoErrors(page, collector, step) (ERR_ABORTED nav cancellations exempted as benign). |
| apps/e2e/src/live/live-trcp.ts | new | Live tRPC clients (signed cookie from the real login) against https://erp.clawcmc.io.vn/trpc; createLiveClass() = Course+ClassBatch PO-approved tRPC seed (slot weekday = today, window-safe optional times) — the no-UI class-creation exception. |
| apps/e2e/src/live/live-ui.ts | new | openUsersPage + createStaffInDialog: real /admin/users create dialog incl. the required "Vai trò" MultiSelector (dialog-scoped) + "Mật khẩu đầu tiên" temp password. |
| apps/e2e/tests/live/live-spec-utils.ts | new | Shared wiring: attachErrors, finishLiveSpec (afterEach → evidence), recordCreated, assertNoErrors re-export, staff identity generators (userId/email/tempPassword per runId), STAFF_ROLES table, staffFullName. |
| apps/e2e/tests/live/00-setup-roles.spec.ts | new | See §2. |
| apps/e2e/tests/live/01-crm-funnel.spec.ts | new | See §2. |
| apps/e2e/tests/live/02-receipt-approve-enroll.spec.ts | new | See §2. |
| apps/e2e/tests/live/03-class-attendance.spec.ts | new | See §2. |
| apps/e2e/tests/live/04-parent-otp.spec.ts | new | See §2. |
| apps/e2e/tests/live/05-audit-log.spec.ts | new | See §2. |
| apps/e2e/tsconfig.json | modified | include += playwright.live.config.ts (was not in the tsc include list). |
| apps/e2e/.gitignore | modified | += .live-credentials.json, .live-run-state.json, test-results-live/. |

---

## 2. Spec list (all under apps/e2e/tests/live/, evidence-wired)

Run command: PLAYWRIGHT_LIVE=1 pnpm --filter @cmc/e2e test --config=playwright.live.config.ts

| Spec | Project | Role(s) | What it proves (human-style UI unless noted) |
|------|---------|---------|---------------------------------------------|
| 00-setup-roles.spec.ts | live-admin | super_admin | Bootstrap login (forced /change-password on the very first login; persisted to .live-credentials.json), then creates sale / giam_doc_kinh_doanh / giam_doc_dao_tao / giao_vien via the real /admin/users dialog with temp passwords (first login of each role rotates). Records emails/userIds to evidence + state. rotateRun() in beforeAll. |
| 01-crm-funnel.spec.ts | live-admin | sale | menuNav → /crm, create lead (Thêm cơ hội), advance O1→O2→O3→O4 with three real "Chuyển lên" clicks; O4 proven by the card "Ghi danh" button. Records contactName/phone for spec 02. |
| 02-receipt-approve-enroll.spec.ts | live-admin | sale + giam_doc_kinh_doanh | sale finds the O4 card by contact name → "Ghi danh" → /finance/new?opportunityId= → fills receipt (parent email @example.com, class A via tRPC, fee 5000001) → banner code. GĐKD finds the receipt in the /finance QUEUE by student name (findInList, never direct URL) → "Duyệt & Kích hoạt" + confirm → provisioning activates the enrollment. Records parentEmail/phone/receiptCode for spec 04 + evidence. |
| 03-class-attendance.spec.ts | live-admin | giam_doc_dao_tao + giao_vien | P2-01: Course+ClassBatch via live super_admin tRPC (no UI), teacher = the gv account (user.pickList), slot pinned ~1h in the PAST (teacher attendance window in production: [start−30m, end+2h] — always open). ACTIVE enrollment in the new class via the REAL money chain (sale receiptCreate with studentId → GĐKD receiptApprove, tRPC with saved sessions). GĐĐT views the class via nav + findInList by code. P2-02: gv opens Điểm danh, picks class/session through the page own pickers, marks present, saves (badge asserted). |
| 04-parent-otp.spec.ts | live-lms | parent (LMS) | Parent email-OTP login on hoc.clawcmc.io.vn: real code read from EmailOutbox via docker exec psql (no TEST_OTP_SEAM in prod), verify, lands on /parent/home, child chip shows the provisioned child name. **Graceful skip** with a note when 02 did not provision a parent. |
| 05-audit-log.spec.ts | live-admin | super_admin | Opens /admin/audit-log via nav; filter "Loại việc" = user.updateRoles → row visible (spec 00 staff creation is audited); when 02 ran, filter finance.receiptApprove → row visible. Proves the campaign actions are visible to the auditor. |

Every spec: attaches error collectors to every page, calls assertNoErrors after key steps, records pass/fail + errors + created data into the evidence via finishLiveSpec afterEach.

---

## 3. Helper contracts (public surface)

live-auth.ts:
  loginViaUi(page, { email, password }): Promise<'authenticated' | 'must-change-password'>
  rotatePassword(page, { currentPassword, newPassword }): Promise<void>
  openStaffSession(browser, roleKey: 'superAdmin' | 'sale' | 'giam_doc_kinh_doanh' | 'giam_doc_dao_tao' | 'giao_vien'): Promise<RoleSession>
    // RoleSession = { context, page, loggedIn } — cookie replay first; fresh login + rotation fallback
  closeRoleSession(session): Promise<void>
  paceStaffLogin(): Promise<void>   // floor 20s between staff-login POSTs (LIVE_STAFF_LOGIN_PACING_MS)

live-credentials.ts:
  liveSuperAdminCredentials(): { email, password, source: 'saved' | 'env' }   // saved (rotated) wins; .env.prod bootstrap fallback
  readCredentialsFile()/updateCredentialsFile(mutate)  // file: { superAdmin, staff: {role: {email,password,userId,changedAt,session}} }

live-otp.ts:
  readOtpFromEmailOutbox(emailLike, { timeoutMs? }): Promise<string>  // EmailOutbox payload.code; LoginOtp hash fallback

live-evidence.ts:
  attachErrorCollectors(page): ErrorCollector   // pageerror / console error / request failure capture
  assertNoErrors(page, collector, step): Promise<void>  // throws when any captured; ERR_ABORTED exempted
  liveEvidence.recordSpecResult(testInfo, { created }) / mergeCaptures / flush → plans/reports/uat-live-<ts>/{result.json,README.md}

live-trcp.ts:
  liveSuperAdminClient() / liveStaffRoleClient(roleKey)  // signed-cookie tRPC clients @ https://erp.clawcmc.io.vn/trpc
  createLiveClass({ courseName, teacherAppUserId?, slotOverride? })  // Course + ClassBatch (PO-approved tRPC seed)

live-ui.ts:
  openUsersPage(page) / createStaffInDialog(page, { userId, fullName, email, role, position, tempPassword })

live-state.ts:
  readLiveState()/updateLiveState(mutate)/rotateRun()/recordCreated(spec, kind, label, value)/liveRunId()

## 4. Validation results

- **Typecheck**: npx tsc -p tsconfig.json --noEmit from apps/e2e → **PASS, 0 errors**.
- **Lint**: root eslint.config.js has NO config matching apps/e2e files (root lint script covers apps/admin, apps/lms, scripts only; verified "File ignored because no matching configuration was supplied"). **eslint is not configured for @cmc/e2e** — no lint gate applies; typecheck is the gate. Existing e2e files carry // eslint-disable-next-line no-console comments for parity.
- **Config/--list**: PLAYWRIGHT_LIVE=1 npx playwright test --config=playwright.live.config.ts --list → **6 tests in 6 files** resolve (5 in live-admin, 1 in live-lms). Without PLAYWRIGHT_LIVE the config throws the gate error (verified). --list performs no live requests; the health-check globalSetup does not run in list mode.
- **No live endpoints were hit** during implementation; no docker compose; no DB writes; no test logins performed.

## 5. Concerns / notes for the coordinator

### Rate-limit pacing plan (5r/m staff-login, burst 10)
- Campaign login budget: spec 00 superAdmin (1 POST) + spec 01 sale (1) + spec 02 gdkd (1) + spec 03 gddt (1) + spec 03 gv (1) = **5 POSTs**, each behind paceStaffLogin() (≥20s floor) with minutes of UI work between them. Reruns within the 8h cookie TTL make **zero** login POSTs (cookie replay).
- OTP budget: spec 04 issues exactly 1 requestOtpEmail (30s cooldown / 5-per-15min untouched).
- LIVE_STAFF_LOGIN_PACING_MS can tighten/loosen the floor without code changes.

### Change-password flow (most delicate part — unconfirmed at runtime)
- Selectors taken from source: apps/admin/src/pages/change-password.tsx renders PasswordInputs labeled "Mật khẩu hiện tại" / "Mật khẩu mới" / "Xác nhận mật khẩu mới" and button "Đổi mật khẩu" (@cmc/ui PasswordInput wraps Astryx TextInput which forwards label → getByLabel works — same primitive the local suite already drives). loginViaUi observes the URL transition to /change-password (client hint from the staff-login response).
- **Cannot be confirmed from source alone**: whether Astryx TextInput renders a label associated with the input (getByLabel match) on the LIVE build — the local suite createStaffViaAdminUi relies on the same getByLabel pattern for the users dialog, so this is the established convention, but the live build is the deployed bundle. If a label match fails, the coordinator sees a clear failure on the first login; the fix is a selector tweak in live-auth.rotatePassword.
- Rotation crash edge: if the server rotates the password but the run dies before persisting to .live-credentials.json, the bootstrap password stops working; loginViaUi error message tells ops to reset via user.resetPassword / re-seed. seed-super-admin.ts does not revert an existing hash.

### Selectors confirmed from source (high confidence)
- Login form: #login-email, #login-password, button "Đăng nhập" (login.tsx) — id attributes.
- /admin/users dialog: labels 'User ID (auth identity)', 'Họ tên', 'Email', 'Vị trí', 'Mật khẩu đầu tiên', "Vai trò" MultiSelector (dialog-scoped button + role=option), "Tạo"; search placeholder 'Tên, email, mã NV…' (users.tsx) — role-picker interaction copied verbatim from the already-passing create-staff-via-admin-ui.ts.
- CRM: "Thêm cơ hội", 'Họ tên', 'Số điện thoại', "Chuyển lên", "Ghi danh" (pipeline.tsx) — copied from the passing crm-receipt journey.
- Finance: receipt form labels + "Tạo phiếu thu" banner, "Duyệt & Kích hoạt" + alertdialog confirm (receipt-detail.tsx) — copied from the passing enrollment-second-class journey.
- Attendance page pickers: combobox 'Chọn lớp học' / 'Chọn buổi học' + 'Lưu điểm danh' + "Điểm danh đã được lưu" badge (attendance.tsx; combobox pattern copied from session-assessment-roster journey).
- Audit log: filter label 'Loại việc' + row assertion (audit-log.tsx; filter-by-label pattern from audit-log-view journey).

### Selectors NOT confirmable from source / runtime risks
- **Shell/menu hydration on the live domains** (Cloudflare→Caddy→tunnel→nginx; nginx rewrites / → /admin/ upstream). menuNav asserts the app-switcher toggle "Mở app switcher" — if the deployed bundle differs, every spec fails at the first nav. The local harness proves the shell contract and the current branch admin build was redeployed per P4, but the live DOM was not inspected during implementation (forbidden to hit live).
- **Console-error zero-noise assumption**: assertNoErrors treats any console error as a failure except ERR_ABORTED request failures. If the deployed build logs benign warnings as console errors, the coordinator may need to extend the allowlist in live-evidence — the evidence file captures the exact strings.
- **Attendance window**: production enforces [start−30m, end+2h] for teachers (giao_vien not in the override roster). The spec pins the slot ~1h in the past so the window always contains the run moment; if the campaign stalls >2h between class creation and the attendance step, the gv mark fails (GĐĐT could override manually).
- **OTP email delivery**: the parent email uses @example.com (RFC 2606) — Brevo will likely fail delivery, but the EmailOutbox row keeps the code (payload scrubbed only on successful delivery; the LoginOtp hash fallback covers even that).
- **Rerun semantics**: rotateRun() gives each campaign fresh staff emails/userIds (old accounts are cleanup-only, UAT accumulation accepted per plan). The super-admin credential persists across runs (rotated).

## 6. Coordinator runbook (P6) summary

cd apps/e2e
# ensure .env.prod is readable (SUPER_ADMIN_EMAIL/PASSWORD) and docker is available (OTP readback)
PLAYWRIGHT_LIVE=1 pnpm --filter @cmc/e2e test --config=playwright.live.config.ts
# evidence → plans/reports/uat-live-<ts>/result.json + README.md
# credentials → apps/e2e/.live-credentials.json (gitignored), created-data log → apps/e2e/.live-run-state.json (gitignored)

Status: DONE_WITH_CONCERNS
Summary: Live-domain Playwright suite implemented under apps/e2e (separate gated config, 6 evidence-wired specs, auth-with-rotation/OTP-readback/evidence helpers); typecheck passes, --list resolves all 6 tests, eslint has no config for @cmc/e2e. No live traffic was generated.
Concerns/Blockers: Runtime selectors on the deployed live bundle (change-password labels, shell/menu hydration) and live console-error noise cannot be verified without a live run — the coordinator should expect possible selector/allowlist tweaks on first execution; attendance depends on the campaign reaching the attendance step within ~2h of class creation (slot pinned to now−1h to keep the production teacher window open).

