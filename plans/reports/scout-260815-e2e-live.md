# Scout Report — E2E Live-Domain Test Suite (erp.clawcmc.io.vn / hoc.clawcmc.io.vn)

**Scout date:** 260815 | **Branch:** feat/back-before-design @ 0740c36 | **Mode:** READ-ONLY
**Purpose:** feed P2 (design) of plan plans/260815-1616-uat-live-test-audit/plan.md — build a Playwright suite that
simulates real human usage of the LIVE system (admin ERP on https://erp.clawcmc.io.vn, LMS parent portal on
https://hoc.clawcmc.io.vn), with the UI served at the domain roots and the API same-origin under /trpc.

---

## 1. apps/e2e/playwright.config.ts — structure, baseURL/webServer, PROD-run delta

**Two project types** (single config, testDir: ./tests):

| Project | Test match | Browser | baseURL | When registered |
|---|---|---|---|---|
| api | /(?<!\.ui)\.spec\.ts$/ (all non-UI specs) | none | n/a | always |
| ui-chromium | /\.ui\.spec\.ts$/ | Desktop Chrome | http://localhost:4174 (LMS preview) | only when PLAYWRIGHT_UI=1 |
| erp-admin-mobile-* (4 projects: 320/390/768/1280) | only erp-mobile-viewport-audit.ui.spec.ts | Desktop Chrome | http://localhost:4173 (admin preview) | only when PLAYWRIGHT_UI=1 |

- **webServer** (only under PLAYWRIGHT_UI=1): two preview servers — 'pnpm --filter @cmc/admin build && preview --port 4173' and
  'pnpm --filter @cmc/lms build && preview --port 4174' — each rebuilt fresh with VITE_API_URL='' (relative) +
  VITE_PROXY_API_TARGET=http://127.0.0.1:3999; reuseExistingServer:false. globalSetup runs the API server on fixed
  port 3999 in UI mode (free port otherwise). The Vite proxy forwards /trpc /upload /auth /health to the real API so all
  browser calls stay same-origin (the API has no CORS).
- **globalSetup** (src/global-setup.ts): requires APP_DATABASE_URL (+ DATABASE_URL for teardown), spawns the real
  apps/api/src/server.ts via tsx, waits /health, **asserts the DB is NOT cmc_prod** (assertNotProdDatabase,
  FORBIDDEN_DATABASE_NAME=cmc_prod), bootstraps a throwaway Facility as super_admin, seeds the UCREA curriculum axis,
  sets E2E_BASE_URL/E2E_FACILITY_ID; teardown kills the server and cleanupFacility-deletes everything scoped to
  the run facility.
- **Reporter**: PLAYWRIGHT_UI → ['list', json → acceptance-results/journeys.json] (ingested by scripts/acceptance-report);
  CI → github; else list. Metadata stamps gitSha/gitDirty (override with GIT_SHA env) so the acceptance ledger
  refuses results from a different commit.
- **Runtime**: workers:1, fullyParallel:false, retries: CI?1:0, timeout:30s.

**How a PROD-targeted (live-domain) run differs** — nothing in this config targets a live domain today; a live run needs a
new shape:
- **baseURL**: admin specs → https://erp.clawcmc.io.vn, LMS specs → https://hoc.clawcmc.io.vn (one baseURL per project,
  so either two projects live-admin/live-lms or per-test test.use({baseURL}) — the journeys already use per-test
  overrides). Browser URLs are the DOMAIN ROOT: admin builds with VITE_BASE=/ (docker-compose.prod.yml:161) and nginx
  rewrites / → /admin/ upstream invisibly; LMS similarly under /lms/. So Playwright navigates /login,
  /cockpit, /finance/:id, /crm, /students, /admin/users, /change-password on erp; /login,
  /parent/home, /student/home on hoc.
- **webServer**: NONE (no preview builds; the live stack is already up). **globalSetup**: cannot reuse the existing one —
  it fails closed against cmc_prod (the live DB name) and would spawn a second API + delete a run facility on teardown.
  A live run needs a slim/no globalSetup (optionally a /health reachability check on both origins).
- **Gate flag**: mirror the PLAYWRIGHT_UI pattern with a new PLAYWRIGHT_LIVE=1 so the default CI run is untouched.
- **Auth seams available on live**: (a) real UI login (email/password / email-OTP); (b) signed-cookie injection
  (mintStaffCookie / mintParentToken) which works in production mode only when the test runner has
  STAFF_SESSION_SECRET/LMS_SESSION_SECRET (both exist as keys in .env.prod on the host). Dev headers
  (x-dev-user, x-dev-lms-user) are stripped by nginx (RT-2) and rejected in production.
- **Ledger**: a live run writing to acceptance-results/journeys.json would collide with CI evidence and be refused on
  gitSha mismatch — write to a separate file (e.g. acceptance-results/live-<date>.json) and/or set GIT_SHA.

## 2. apps/e2e/tests/ — journey inventory and structure

- **39 journey specs** in tests/journeys/, named <vietnamese-descriptive-slug>.journey.ui.spec.ts (run by the
  ui-chromium project; each is one manifest-mapped business flow, P1-xx ids in headers).
- Plus non-journey files: API specs *.spec.ts (api project), UI safety-net specs *.ui.spec.ts at root
  (admin-shell.ui.spec.ts, lms-login.ui.spec.ts, screen-role-capture.ui.spec.ts, mobile-viewport audit, deeplink specs).

**Three representative journeys (core business flows):**
1. **journeys/enrollment-second-class.journey.ui.spec.ts** (P1-05, enrollment): full money chain — sale creates a
   receipt on the real /finance/new form (student name, parent phone, parent email, class, fee), giam_doc_kinh_doanh
   finds the receipt by the displayed student name in the /finance queue, approves ("Duyệt & Kích hoạt") → provisioning
   creates the Student + activates the class-A enrollment; then sale looks the student up by name on Xếp lớp and enrolls
   them into a second seeded class; closes with a **DB-readback business invariant** (enrollment statuses reserved/active).
2. **journeys/crm-receipt.journey.ui.spec.ts** (P1-02, receipt via CRM): sale creates an Opportunity (O1_LEAD) on
   /crm, advances it O1→O2→O3→O4_TESTED with three real "Chuyển lên" clicks, clicks the card's "Ghi danh" →
   /finance/new?opportunityId=, fills the receipt form, submits; invariant verified through a manager-role tRPC read
   (finance.receiptList) asserting the persisted netAmount.
3. **journeys/lms-parent-otp-login.journey.ui.spec.ts** (P1-07, LMS parent auth): provisioning via receipt creates the
   ParentAccount; the parent opens the real LMS login, tab "Phụ huynh", requests email OTP, asserts a WRONG code is
   refused (falsification-first), then reads the real code from the queued EmailOutbox row (readOtpCodeByEmail) and
   completes login; asserts the child picker shows the provisioned child.

**Shared structure/patterns to reuse (all in apps/e2e/src/):**
- No custom fixtures file; auth = per-test test.use({baseURL}) + signed-cookie injection:
  mintStaffCookie({userId, roles, facilityId}) + context.addCookies for BOTH 127.0.0.1 and localhost
  (STAFF_COOKIE_NAME=cmc_staff_session, imported from api). UI journeys use per-role browser contexts
  (browser.newContext()) so each role has its own session — no ids passed between roles.
- src/journey/menu-nav.ts: real nav clicks (app-switcher "Mở app switcher" → menuitem module → section-menu child),
  never page.goto to a destination; assertEntryAbsent for permission gates.
- src/journey/find-in-list.ts: polls rendered row text (table tbody tr, [role="row"]) for a predicate — locates
  rows by what a human sees, never by id; assertAbsent companion.
- src/journey/provision-student-via-receipt.ts: the reusable sale→director receipt-approval preamble (parentEmail,
  feeVnd, approverRole options; fee must be 1 + n*100000 due to the min=1 step=100000 spinbutton).
- src/journey/assert-business.ts: assertBusinessInvariant(label, actual, expected) — annotation-tagged so the
  business:verify gate distinguishes number-verified flows from smoke-only.
- src/db.ts: direct-Prisma seams for PO-approved gaps only — seedClassBatch, seedStudent,
  seedActiveEnrollment, seedAppUser, readOtpCodeByEmail (EmailOutbox payload + LoginOtp-hash brute-force fallback),
  sweepParentIdentity (rate-limit/identity cleanup), cleanupFacility (full facility teardown), ensureUcreaCurriculumAxis.
  All connect via APP_DATABASE_URL (cmc_app role; privileged DATABASE_URL for append-only tables).
- src/journey/mint-lms-session.ts: writes a signed LMS session into localStorage['cmc_lms_session'] for journeys
  where login is NOT the business under test.
- src/trpc-client.ts: mode-aware tRPC clients — createE2eStaffClient/LMS variants use x-dev-user in dev,
  signed HMAC cookie/Bearer in production mode (works against live if the runner has the session secrets).

## 3. AUTH

**Admin staff login (ERP)** — email/password is THE production path (SSO_ENABLED=false, VITE_SSO_ENABLED=false
verified in .env.prod; Entra SSO + Graph disabled, M365 access lost — docs/system-architecture.md §Auth):
- POST /auth/staff-login (same-origin, no CORS) with {email, password} → sets HttpOnly cookie
  cmc_staff_session (Secure in prod, SameSite=Lax, ~8h TTL; HMAC-SHA256 header.payload.sig with
  STAFF_SESSION_SECRET). PBKDF2-SHA256 verify, lockout 5 fails/15min, generic Vietnamese error ("Thông tin đăng nhập
  không chính xác...") — no enumeration. mustChangePassword:true in the response redirects to /change-password
  (client-hint UX) — a first login with a temp/bootstrap password always forces rotation.
- **Login form selectors** (apps/admin/src/pages/login.tsx): #login-email (label "Email", type=email,
  autoComplete=username), #login-password (label "Mật khẩu", type=password, autoComplete=current-password), submit
  button "Đăng nhập" (.login-page__submit); SSO button "Đăng nhập Microsoft (Entra SSO)" only rendered when
  VITE_SSO_ENABLED=true (hidden on live).
- **Change-password page** (apps/admin/src/pages/change-password.tsx, route /change-password): PasswordInputs
  "Mật khẩu hiện tại" / "Mật khẩu mới" / "Xác nhận mật khẩu mới", min 8 chars; mutates user.changeOwnPassword.

**LMS parent login (hoc.clawcmc.io.vn)** — apps/lms/src/pages/login.tsx, two tabs:
- **"Học sinh" tab (default)**: phone + password → lmsAuth.loginStudent (parent phone + student password; generic
  "Thông tin đăng nhập không đúng."; mustChangePassword → /student/change-password). Selectors: TextField "Số điện thoại
  phụ huynh" (inputMode=tel), PasswordInput "Mật khẩu", Button "Đăng nhập".
- **"Phụ huynh" tab**: email-OTP → lmsAuth.requestOtpEmail then lmsAuth.verifyOtpEmail. Selectors: Button
  "Phụ huynh" (tab), TextField "Email phụ huynh" (autoComplete=email), Button "Gửi mã OTP", TextField "Mã OTP (6 số)"
  (autoComplete=one-time-code, inputMode=numeric, maxLength=6), Button "Xác nhận mã". Session stored in
  localStorage['cmc_lms_session'] (kind parent/student); verifyOtpEmail returns sessionToken (signed Bearer,
  LMS_SESSION_SECRET) + children list.
- The parent tab carries a "[DEV ONLY — blocked-on-comms]" banner in dev builds; on prod, Brevo delivers the email
  (outbox transport 'brevo').

**OTP seam**: TEST_OTP_SEAM — when =1 AND NODE_ENV !== 'production', requestOtp/requestOtpEmail
  return plaintext _testSeamCode. **Forbidden in production** (apps/api/src/boot-checks.ts throws FATAL;
  scripts/env-check.sh too) and NOT set in .env.prod. ⇒ **No OTP seam on live**: the suite must obtain real codes via
  DB readback of the EmailOutbox payload {kind:'otp', code} (exactly what readOtpCodeByEmail does) or by reading
  the Brevo-sent email. App-level limits to respect: 30s per-identifier cooldown, 5 codes/15min per identifier, global
  200 enqueues/hour, code TTL 5min, verify attempt cap 5.

**Env var key names relevant to auth (from .env.prod, NO values printed)**: SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD, SUPER_ADMIN_FACILITY, SUPER_ADMIN_EMPLOYEE_CODE, SUPER_ADMIN_USER_ID,
  STAFF_SESSION_SECRET, LMS_SESSION_SECRET, SSO_ENABLED, VITE_SSO_ENABLED, STAFF_EMAIL_DOMAIN,
  CORS_ORIGINS, ADMIN_APP_ORIGIN, APP_DATABASE_URL, DATABASE_URL, TEST_OTP_SEAM (absent), Brevo/Graph
  transport keys. E2E-side code references: E2E_BASE_URL, E2E_FACILITY_ID, E2E_LMS_SECRET, E2E_STAFF_SECRET,
  E2E_SUPER_ADMIN_EMAIL, E2E_SUPER_ADMIN_PASSWORD (the mint helpers default to LMS_SESSION_SECRET/STAFF_SESSION_SECRET).

**Impersonation is NOT available on live**: the admin RoleSwitcher (shell/role-switcher.tsx, localStorage
  cmc_dev_user) returns null when import.meta.env.PROD; the LMS DevHeaderWriter is DEV-gated; nginx strips
  x-dev-user/x-dev-lms-user. ⇒ Every role in a live journey needs its own real AppUser (created by super_admin via
  /admin/users with temp password → forced rotation).

## 4. Existing PROD-targeted tooling

- **apps/e2e/webwright-prod-smoke.mjs** — standalone Node script (chromium via @playwright/test). Targets the
  LOCAL-SIM prod stack at https://localhost (self-signed → ignoreHTTPSErrors:true), with Odoo-era selectors
  (.o_web_client, .console-brand, "Mở app switcher" — the .o_web_client class still exists in
  apps/admin/src/shell/shell.tsx:130). Checks CP1–CP8: /health, admin SPA load, staff login (email/password,
  generic Vietnamese label regexes), staff cookie evidence, console shell, app switcher, CRM pipeline, finance, LMS root.
  Loads credentials from repo-root .env.prod (SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD); handles forced
  password change by rotating to [bootstrap-password]!Ux1. Writes screenshots+log under
  outputs/webwright-prod-smoke/final_runs/run_1/. **Can run against live**: change base to
  https://erp.clawcmc.io.vn (public TLS — ignoreHTTPSErrors unnecessary), keep .env.prod credentials; the
  rotation caveat applies (see §6).
- **apps/e2e/smoke-statusbar.ts** — ops smoke for the design3 detail-page sticky statusbar. BASE='https://localhost/admin';
  uses src/design3/open-seeded-detail.ts helpers: loadProdEnv() (parses .env.prod), loginAsSuperAdmin(page, env)
  (login + forced-rotation handling, same [bootstrap-password]!Ux1 rotation), openSeededDetail(page, 'receipt'|'opportunity')
  (finds a row by visible text on /finance or /crm and clicks into detail), measureDetailStatusbar+assertStickyStatusbar.
  Run: pnpm exec tsx smoke-statusbar.ts from apps/e2e. **Can run against live** with BASE='https://erp.clawcmc.io.vn',
  but it REQUIRES existing receipt + opportunity rows on the target DB — the fresh prod DB has none, so business data
  must be created first (or the smokes fail on the list-empty step).
- Both are read-mostly browser smokes with no DB writes and no prod-DB guard (they never touch the DB) — safe to point at
  live domains; the guard that DOES block live DB usage is in the e2e harness (assertNotProdDatabase), not these scripts.

## 5. apps/e2e/package.json

- @cmc/e2e 0.0.0, private, "type":"module"; scripts: test = playwright test, typecheck = tsc -p tsconfig.json --noEmit.
- deps: @cmc/auth, @cmc/db, @cmc/domain-identity, @cmc/domain-time (workspace:*).
- devDeps: @cmc/domain-finance (workspace:*), **@playwright/test ^1.62.1**, @trpc/client/@trpc/server ^11,
  @types/node ^22, ts-morph ^24, tsx ^4.23.5, typescript ^6.
- Root-level related scripts: acceptance:report (tsx scripts/acceptance-report/verify.ts), business:verify
  (tsx scripts/business-verify/verify.ts); test (turbo, excludes @cmc/e2e).
- tsconfig: extends root base, noEmit, lib ES2022+DOM, includes src/tests/playwright.config.ts.

## 6. Seed data on the fresh prod DB

- **DB**: cmc_prod (Postgres 16 in the cmcv2-prod compose network; **no host port mapping** — the DB is not reachable
  from the test runner's host directly; readback requires docker compose exec postgres psql ... or a throwaway
  container on cmcv2-prod-net, or a one-off tunnel).
- **packages/db/prisma/seed.mjs** (deploy runbook §1.8, prisma db seed): creates 2 Facilities (dev + synthetic
  sentinel), the 96-unit UCREA/BRIGHT_IG/BLACK_HOLE curriculum catalog, and the shift catalog (Kinh doanh + Giáo viên)
  for the dev facility. **Creates NO AppUser.**
- **scripts/seed-super-admin.ts** (runbook §1.9): idempotent bootstrap of the one super_admin AppUser — email =
  SUPER_ADMIN_EMAIL value (per task: admin@cmcvn.edu.vn), facility by SUPER_ADMIN_FACILITY, employeeCode
  SA-001, roles ['super_admin'], isActive, passwordHash from SUPER_ADMIN_PASSWORD with
  mustChangePassword=true — **applied only when the row has no password yet** (a rerun never reverts a rotated
  password). Login then works: email/password; first login forces /change-password rotation.
- **Everything else must be created through the UI** by that super_admin: runbook-uat-golive.md confirms the fresh
  cmc_prod was empty (1 Facility, 0 AppUser, 0 Student/ParentAccount/Receipt) before bootstrap and that seed.mjs
  creates no staff; only super_admin can create staff (user.manage), temp passwords via user.resetPassword
  (→ mustChangePassword). The local-sim demo accounts (gdkd/gddt/sale/gv@cmcvn.edu.vn) exist ONLY on the local-sim stack
  (scripts/seed-local-sim-demo.ts, https://erp.localhost), NOT on the live DB.
- **Gap to plan for**: no admin UI creates a Course/ClassBatch (PO-approved seed exception in the suite; grep-verified).
  On live, journeys that need classes must call course.create/classBatch.create over tRPC with a real
  super_admin session (signed cookie) — the pattern already used by lms-login.ui.spec.ts's
  seedStudentForProvisioning (works in production mode via createE2eStaffClient + STAFF_SESSION_SECRET).
- **Conclusion**: the super-admin alone is enough to log in (after one rotation) and create business data, and to create
  per-role staff accounts via /admin/users — sufficient to build a human-usage campaign; class/course seeding needs the
  tRPC fallback above.

---

## Design constraints surfaced (feed into P2)

1. **Prod-DB guard blocks the existing harness**: assertNotProdDatabase forbids the literal DB name cmc_prod (the
   live DB). The e2e globalSetup, db.ts readback helpers and cleanupFacility teardown CANNOT be pointed at live
   without an explicit, deliberate override — and teardown would destroy real data. Live suite should be a separate
   project with its own (no-op or health-check-only) globalSetup and no facility teardown; clean only what the run
   created (log created entities; plan already accepts UAT data accumulation).
2. **OTP on live**: no TEST_OTP_SEAM; real codes via EmailOutbox DB readback (docker exec cmc_app) or the Brevo email.
   Pace OTP requests: 30s cooldown, 5/15min per identifier, global 200/hour, nginx auth zone 5r/m burst 2 on
   /trpc/lmsAuth.*.
3. **Staff-login rate limit**: nginx /auth/staff-login = 5r/m per IP (burst 10); a campaign from one egress IP must
   pace logins and use per-role sessions once established (8h cookie TTL).
4. **Super-admin credential state**: if the live super-admin password was already rotated, SUPER_ADMIN_PASSWORD in
   .env.prod no longer logs in (seed-super-admin does not revert existing hashes). The suite needs the CURRENT
   password, or ops must reset it (delete/clear the AppUser passwordHash and re-seed, or user.resetPassword from
   another super_admin).
5. **No role impersonation on live** (RoleSwitcher PROD-gated, dev headers stripped) ⇒ create one real AppUser per role
   via /admin/users before the campaign.
6. **Live evidence ledger**: keep live runs out of acceptance-results/journeys.json (gitSha refusal + CI collision);
   use a dedicated output file.
7. **smoke-statusbar.ts** needs seeded receipt/opportunity rows on the target DB — create business data first on the
   fresh live DB.
8. **Cookie domains for injection on live**: erp.clawcmc.io.vn / hoc.clawcmc.io.vn (not 127.0.0.1/localhost);
   cookies are Secure in prod so context must run over https.

Status: DONE
Summary: Repo scouted at 0740c36 — full picture of the e2e harness (config/projects/globalSetup/auth seams), 39 journey specs with reusable helpers (menuNav/findInList/provisionStudentViaReceipt/DB readbacks), live auth flows (staff email/password + forced rotation; LMS email-OTP), prod tooling, and fresh-prod seed state (only the bootstrap super_admin; everything else must be created through the UI). Key constraints for the live suite: assertNotProdDatabase blocks the live DB name cmc_prod, no OTP seam in production, no role impersonation on live, and the super-admin password may already be rotated.
Concerns/Blockers: (1) Live suite cannot reuse global-setup/db.ts/cleanupFacility against cmc_prod — needs a separate live project with its own setup and no teardown; DB readback (OTP codes) needs docker-exec access to the unexposed postgres. (2) Super-admin login depends on the current (possibly rotated) password, not .env.prod's bootstrap value. (3) nginx auth rate limits (5r/m staff-login, 5r/m lmsAuth) require pacing a multi-login campaign. (4) Course/ClassBatch have no admin UI — live journeys need tRPC creation with a real super_admin session.