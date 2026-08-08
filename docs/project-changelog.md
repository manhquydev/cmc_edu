# CMC EDU v2 — Project Changelog

**Scope:** P1 Identity & Enrollment backend build, security hardening, and remediation  
**Period:** 2026-07-05 to ongoing  
**Status:** Active

---

## [2026-08-08] Prisma 6.19.3 → 7.9.1: driver-adapter migration

**Context:** Prisma 7 removes `datasource.url` from `schema.prisma` and the
`new PrismaClient({ datasources })` constructor override. Migrated `@cmc/db`
to the `@prisma/adapter-pg` driver adapter to unblock the dependabot bump.

**`@cmc/db` (`packages/db/src/index.ts`):**
- `createPrismaClient()` still resolves `APP_DATABASE_URL ?? DATABASE_URL`
  (app role `cmc_app`) and now builds a `PrismaPg` adapter from it — RLS
  (ADR 0042) app-role precedence is unchanged.
- Added `createPrivilegedPrismaClient()` (`DATABASE_URL` only, no fallback)
  and `createPrismaClientWithUrl(connectionString)` to replace the removed
  `datasources` override at the 5 call sites that used it (audit-log
  retention sweep, api/e2e test-harness ledger teardown, standalone scripts).
- All three factories fail loud on a missing URL instead of letting the
  underlying `pg.Pool` silently fall back to libpq `PG*` env vars.
- New `packages/db/prisma.config.ts`: CLI-only config for
  `migrate`/`generate`/`studio` (schema-owner `DATABASE_URL`), loads the
  gitignored `prisma/.env` itself (Prisma 7 stopped auto-loading `.env`).
- `withFacility()`'s `SET LOCAL`/`set_config(..., true)` RLS GUC pattern is
  unchanged and verified working through the adapter.

**Proof:** typecheck 29/29; admin+lms build; `@cmc/api` 2144 tests on a real
synthetic Postgres; RLS smoke (facility scoping both directions + bypass +
fail-closed default). CI `typecheck-and-test` + `ui-e2e` SUCCESS on PR #90
(merged to `develop`) and PR #91 (`develop` → `main` sync). Closes dependabot
#84.

**Docs:** `docs/system-architecture.md` (§4 Database, §`@cmc/db`, §Facility
Isolation), `docs/18-tech-stack-va-chuan-ky-thuat.md`,
`docs/decisions/0042-rls-defense-in-depth.md` (addendum).

---

## [2026-08-08] TypeScript 5.7 → 6.0.3

**Context:** Dependabot bump (#83) tightened TS6's default lib/types; packages
using Node/web globals (`process`, `fetch`, `console`, `node:*`) lost implicit
types.

**Fix (config-only, no runtime change):** added `@types/node ^22.10.0` +
`"types": ["node"]` to the 6 packages that needed it — `db`, `links`, `llm`,
`mcp-server`, `storage`, `ui`.

**Proof:** `pnpm typecheck` 29/29; admin+lms build; `@cmc/ui` 143/143;
`@cmc/db` tests pass. CI `typecheck-and-test` + `ui-e2e` SUCCESS on PR #88.
Closes dependabot #83.

**Docs:** `docs/codebase-summary.md`, `docs/18-tech-stack-va-chuan-ky-thuat.md`.

---

## [2026-08-07] CMC Console design-system rebrand (admin)

**Context:** Rebrand admin ERP UI language from Odoo-named identifiers to
**CMC Console**; retire legacy class mirrors; close design3 visual-smoke gap
with agent-driven synth-DB smoke (real staff-login).

**Product / UI package:**
- Tokens `--odoo-*` → `--console-*`; classes `.o-*` → `.console-*` (keep
  `.o_web_client` DOM mirror); `OdooNavbar` → `ConsoleNavbar`.
- Paths: `odoo.css` → `console.css`, `packages/ui/src/console/`.
- Deleted dead `premium.css` (LMS emits only `lms-*` in `apps/lms/src/app.css`).
- Retired `ck-*` / `tpl-*` emitters; 13 `sh-*` kept for public SideNav/AppFrame.
- Sticky list thead on DataTable; Odoo pin attribution → `7de220c…`.

**Proof:** unit/e2e gates on branch `feature/cmc-console-design-system-rebrand`;
visual smoke report 8/0 fail (+2 fixture WARNs). Plan:
`plans/260807-1453-cmc-console-design-system-rebrand-hardening/`.

**Docs:** sole authority `docs/design-system-console.md`; map
`design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md`.

---

## [2026-08-07] G1 FilterBar + API list search (design3 admin)

**Context:** After design3 shell promote, list filters were partial (~12/23
ListPage) and several APIs only accepted page/pageSize. PR #75 on `develop`
closes the FilterBar hygiene + optional search wave; required CI green at
`fdc2c93`.

**Product / API:**
- `FilterBar` in ControlBar with `hasClear` for default-domain selects; audit
  date range validation before query.
- Optional `search` (Prisma `contains`, facility/RLS preserved) on major lists:
  users, facilities, courses, classBatch, pickList, listForGrading, and related
  surfaces.
- Admin list FilterBar adoption ~**20/23** (holdouts: leaderboard,
  class-placement, refund).

**Proof:** `typecheck-and-test` + `ui-e2e` SUCCESS on PR #75. E2e journeys
ADM-04 and P1-06 aligned to reactive FilterBar. Ship report:
`plans/reports/ship-20260807-filterbar-search.md`. Full Odoo Search OS still
parked.

**Still open:** `pnpm acceptance:report` re-measure; human visual smoke; merge
to `main` when desired.

---

## [2026-08-02] Day-one authoring: course create UI + CurriculumUnit ensure (local-sim)

**Context:** Timeline MCP e2e (org bootstrap → class → receipt → attendance)
showed enrollment/attendance APIs work, but pure-UI day-one ops stalled on
authoring gaps: `/admin/courses` was list-only while `course.create` existed;
local-sim never ran prisma seed so `CurriculumUnit` was empty and exercise/
grading UI unusable; bare `/classes` hit Coming Soon.

**Product:** GĐĐT can create courses from Admin → Khoá học (`+ Tạo khoá`).
`scripts/ensure-curriculum-units.ts` (gated allow-flag, idempotent) plants the
minimal UCREA unit set; `seed-local-sim-demo.ts` invokes it best-effort. Admin
redirects `/classes` → `/admin/classes`. Sale `receiptList` SoD and CRM Ghi
danh destination left unchanged (by design).

**Evidence:** `apps/admin` course create unit tests; plan
`plans/260802-1500-day-one-authoring-ui-gaps/`.

---

## [2026-07-26] Staff email/password thay Entra SSO (mất quyền M365) + hợp nhất toàn bộ về `main`

**Context:** dự án mất quyền tenant M365 ⇒ Entra SSO và Graph email phải tắt được bằng cấu hình,
email 100% Brevo, staff đăng nhập email/password. Plan:
`plans/260726-1558-GH-38-m365-off-email-password-auth/`.

**Auth (PR #37, merge `0b933bf`):** `AppUser` thêm passwordHash (PBKDF2 dùng chung helper LMS),
`mustChangePassword`, lockout 5 lần/15′; partial unique index `lower(email) WHERE email <> ''`
(migration `20260726000000_app_user_password_auth`, pre-check trùng fail-loud). `POST /auth/staff-login`
mount vô điều kiện, phát cùng cookie `cmc_staff_session` như đường SSO; `/auth/logout` ra ngoài flag.
`user.changeOwnPassword` / `user.resetPassword` (super_admin) + UI login/đổi mật khẩu/reset trong trang
Users. nginx siết `= /auth/staff-login` vào zone auth 5r/m. Email: không đổi code — mọi luồng vốn đã
Brevo; Graph giữ nguyên ở trạng thái không cấu hình.

**Review trail:** code-review nội bộ Request-changes → đã đóng hết Critical/Important trong `aafdecb`
(chặn serialize passwordHash về client bằng `APP_USER_SELECT`; lockout cho changeOwnPassword + fix bug
throw-trong-transaction rollback mất increment; seed không ghi đè mật khẩu đã xoay; `ADMIN_APP_ORIGIN`
bắt buộc vô điều kiện). **Known issue để lại có hồ sơ:** sso-routes lookup AppUser thiếu bypass RLS —
bật lại SSO sẽ từ chối mọi user nếu chưa sửa (ghi ở `docs/system-architecture.md`).

**Hợp nhất nhánh:** PR #35 (sổ nghiệm thu, 56 commit) merge trước, PR #37 sau — đều merge commit để giữ
nguyên các SHA bằng chứng mà sổ nghiệm thu tham chiếu. Remote/local chỉ còn `main`; CI hậu merge xanh
3/3 job. **Flake CI ghi nhận tại issue #36:** `kpi.refresh` double-fire — nghi race thật ở nhánh
recovery P2002 (`apps/api/src/kpi/auto-score.ts:370`), fail cả trên commit docs-only, local 5/5 pass.

## [2026-07-26] Nghiệm thu journey 31/38 luồng (chạm trần) + khôi phục CI (lần đầu chạy `ui-e2e`)

**Context:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/` — mục tiêu: mọi luồng nghiệp vụ
có trạng thái do MÁY chứng nhận, không phải tự khai. Bất biến của plan: **chỉ đo, KHÔNG sửa app**.

**Nghiệm thu (sổ máy-chứng):**
- **31/38 luồng đã chứng minh chạy** tại commit `324bd12` (cấu trúc: 37 built / 1 partial / 0 missing;
  actor-audit 0 phát hiện). Tổng **31 journey UI spec / 43 spec file**, chạy trong project `ui-chromium`.
  Đây là **TRẦN của phương pháp journey** — 7 luồng còn lại không có UI để lái ⇒ **38/38 luồng đều có
  trạng thái máy-chứng, 0 luồng chưa phân loại**.
- Mỗi journey lái **trình duyệt thật → build production admin/lms → tRPC → Postgres có RLS**, không mock.
  Kỷ luật: falsification load-bearing (kiểm chứng test chuyển ĐỎ khi bỏ hành động cốt lõi) + 4× xanh liên tiếp.
- Bắt được false-green thật: P3-05 "chốt lương" trước đây chỉ chứng minh danh sách nhân viên hiển thị,
  chưa hề chạm `payslip.finalize` — journey mới lái đủ `assemble → finalize`.
- **7 luồng còn lại** đều `no-ui-path` (P1-08, P2-01/02/03/05, P3-10/11): không có UI nên journey không
  lái được — muốn phủ phải XÂY UI trước, việc đó thuộc plan sửa, không thuộc plan đo này.
- Luồng bổ sung trong ngày: P4-04 (test đầu vào), P3-06+P3-08 (KPI nộp→xác nhận→tất toán), P1-06 (liên kết
  PH–con), và journey **xuyên app** đầu tiên: GV công bố ảnh buổi học (ERP) → PH xem trên LMS, với cổng
  đồng ý ảnh được chứng minh có răng (chưa đồng ý ⇒ tóm tắt qua được nhưng ảnh bị giữ lại).

**CI khôi phục:**
- Từ 2026-07-17 đến 2026-07-26 mọi run fail sau 3–4 giây với **0 step chạy** — nguyên nhân là **hết
  Actions minutes, KHÔNG phải lỗi workflow**. Chuyển repo sang public → chạy lại ngay, không sửa dòng YAML nào.
- Job `ui-e2e` **chạy lần đầu tiên trong lịch sử dự án**; 2 run xanh liên tiếp `30184942661` (@`478495b`)
  và `30185169572` (@`22bbead`), sinh artifact `gitDirty:false` — nguồn chính danh đầu tiên của sổ nghiệm thu.
- Runtime đo thật: `ui-e2e` 6.1′, `typecheck-and-test` 3.8′, `e2e` (API) 2.0′ (dự phóng cũ 9′–53′) ⇒
  giữ cadence full-suite mỗi push.
- Test đơn vị/tích hợp trên CI cùng commit: `@cmc/api` 104 file/988 test, `@cmc/admin` 39 file/396 test,
  `@cmc/ui` 12/45, `@cmc/domain-payroll` 2/38, `@cmc/domain-time` 1/31, `@cmc/domain-finance` 5/17.

**Giới hạn phải nói rõ (không được đọc thành "đã xong"):**
- Journey ở **mức smoke**: chứng minh luồng *chạy thông* và guard chặn đúng chỗ; **KHÔNG** chứng minh
  *đúng số học nghiệp vụ* (công thức KPI, tiền phạt, proration). Mỗi journey đi 1 đường hạnh phúc + 1 negative.
- **UAT người thật (M0) vẫn CHƯA chạy** — sổ máy-chứng là điều kiện *cần*, không phải *đủ*, để ký nghiệm thu.
- Chưa có test tải/hiệu năng/bảo mật chủ động; dữ liệu chạy là tổng hợp, không giống production.
- **Repo đang PUBLIC** để lấy Actions miễn phí (đã kiểm: không secret nào bị commit). Mã nghiệp vụ đang
  công khai; chuyển lại private không thu hồi được bản đã fork. Cần quyết: bật lại billing + private,
  hoặc self-hosted runner.

**Còn treo (bàn giao plan sửa, red-team RT-15):** OTP plaintext-at-rest trong `EmailOutbox.payload` không RLS;
secrets dev-default committed; `parseLmsToken` phía client không verify chữ ký.

---

## [2026-07-19] Log system remediation Hướng A+ — T8 LLM egress audit, PII denylist sweep, docs sync, Docker log rotation

**Context:** `plans/260719-1145-log-system-remediation-a-plus/` (brainstorm scope A+, 2 red-team rounds,
15+8 findings applied, 0 Critical/High remaining). 6 cheap-to-fix gaps closed after log-system audit
confirmed the AuditLog core (REVOKE-immutability, middleware auto-audit, 12mo retention) already
meets/exceeds design.

- **T8 LLM-egress audit (threat-model T8, docs/13:80/114):** `assessment.draftComment`'s single LLM
  call site now writes exactly 1 `assessment.draftComment.llm` AuditLog row per attempt — `model`,
  `promptVersion`, `resultHash`+`resultLength` (no raw prompt/result — minimization docs/08 §7),
  correlated via `assessmentId`+`outcome` (`created`/`failed`). Written in a `finally` around the tx so
  it survives a post-LLM mutation failure; best-effort (audit-write failure never breaks the draft).
  `@cmc/llm`: `PROMPT_VERSION` + hash-lock test on `SYSTEM_PROMPT`; stub LLM now throws
  `LLM_STUB_PROD_FORBIDDEN` lazily at call-time in production (never at client-construction, which would
  crash API boot) — mapped to `TRPCError PRECONDITION_FAILED` at the call site.
- **Sensitive-field sweep (proactive, anti-recurrence of the OTP-denylist incident):** 2-pass sweep of
  every tRPC mutation input schema (30 router files) against the audit denylist — 0 new sensitive fields
  found; report at `plans/reports/pii-sweep-260719-audit-denylist-input-schema-report.md`.
  `sanitizeAuditData` made recursive (objects + arrays) — previously shallow, so a sensitive field
  nested inside an array input (e.g. `shift.submit`'s `entries`) would have passed through unstripped.
- **Docs sync:** `project-changelog.md`'s 2026-07-06 entry corrected (`AuditLog` never had RLS — wave-1
  migration actually covered Contact/Opportunity/Receipt/RefundRecord/Student/Enrollment);
  `system-architecture.md` dropped an inaccurate "+ JSON logging" claim; doc 14 now lists
  `audit.list` = super_admin-only; `HARNESS_BACKLOG.md` gained 2 items (MCP tool-call audit design-in,
  log-shipping-before-go-live).
- **Docker log rotation:** `docker-compose.prod.yml` — every service (including the `minio` profile-gated
  one) now has `json-file` logging capped at `max-size: 10m, max-file: 3` (~30MB/service) via a shared
  `x-logging` anchor, closing the unbounded-disk-fill risk from an error-looping container. Config-only —
  not deployed (project has not gone live).

**Gates:** `pnpm typecheck` 26/26 · `pnpm --filter @cmc/llm test` 15/15 · `pnpm --filter @cmc/api test`
897/897 · `docker compose -f docker-compose.prod.yml config --quiet` pass · `gitnexus_detect_changes`
scope matched exactly the 4 phases' declared files (11 changed, 0 stray diffs, LOW risk).

---

## [2026-07-12] HR remediation (shift/KPI/payroll) phases 1-6 — salary-tier model, KPI auto-score lifecycle, session-done engine, e2e verify loop

**Context:** `plans/260711-1752-hr-kpi-shift-attendance-remediation/` (docs/22 ADR 0044, docs/20 §2-4b).
**BREAKING (no shim):** `kpi.submit`/`kpi.approve`(standalone)/`kpi.getForUser` REMOVED → replaced by
`kpi.refresh/submitSlip/confirm/override/bulkApprove/list/myScore` (`approved` only via `bulkApprove`).
`compensation.upsertRate` REMOVED → `salaryTier.create/update` + `compensation.assignTier`.

**New:** salary-tier model `totalNet = base(tier) + %côngca × %chỉ-số × đơnGiá − phạt` (`SalaryTier`
catalog, `CompensationPolicy`, GĐ outside system); shift `rejected`+reason, ROLE-gated approval
(`ShiftGroup.type`, not `managerId`); session-done engine (`creditFactor` 24h/48h/0, auto-cancel+makeup);
new admin nav `/hr/{salary-tiers,payroll,kpi,shifts,checkin,my}` (docs/14 §5).

**Phase 6:** `apps/e2e/tests/{shift,kpi}-lifecycle.spec.ts` + `apps/e2e/src/db.ts` seed helpers;
rebuilt `@cmc/auth`'s stale `dist/` (pre-existing bug, permission rows missing from compiled output).
Gates: e2e 19 passed +1 skip · api 695 passed · admin 229 passed · `pnpm build` 14/14.

---

## [2026-07-12] Premium ERP screen build-out merged to main — 21/21 non-blocked screens on premium templates

**Context:** 8-phase TDD completion; all 21 admin ERP screens (non-blocked per phase-00–phase-07) migrated from legacy components to premium design-language templates + composites + LineIcon monochrome set. Phase-08 (3 màn stub: leaderboard/network-ip/shift-config) remains BLOCKED pending backend + product spec.
**Build-out scope:**
- **Screens:** engagement (gifts, **rewards feature REAL — staff redemption queue**), admin (facilities, users RBAC, **network-ip/shift-config still coming-soon**), crm (pipeline Kanban→dashboard), finance (receipt-create, reconciliation, revenue-report), attendance (check-in-out, shifts), hr (kpi, payroll), teaching (schedule, attendance, exercises, report-cards, session-evidence, pdf-annotator card wrapper)
- **Premium adoption:** ListPage + DetailPage + FormPage + MetricCard + Panel + TaskRow + FunnelBar + LineIcon (Feather + 5 new: globe/clock/trophy/gift/star, data-icon attr) + premium CSS tokens
- **Test harness:** vitest + jsdom + testing-library, 189 admin tests (25 file) PASSING — first test-harness for admin component layer
- **Exemplar parity:** 12 exemplar screens (cockpit, finance/receipt-{list,detail}, students/{index,detail}, parents/index, classes/{index,detail}, courses/index, crm/opportunity-detail, enrollment/class-placement, teaching/grading) ĐÃ premium, unchanged
- **Dead code cleanup:** `finance/index.tsx` (unrouted orphan pre-build-out) deleted post-merge
- **Red-team validation:** payload audit + money-sensitive byte-identical, no API changes, all gates pass

**Gates:** pnpm --filter @cmc/admin test 189 pass · pnpm --filter @cmc/ui test 45 pass · pnpm typecheck 26/26 · pnpm build 14/14 · pnpm lint clean. Backlog (ghi rõ chưa làm): rewards pagination (cap 50), payroll confirm-dialog, 12 exemplar emoji pre-existing cleanup.

---

## [2026-07-11] Build regression found (Astryx `@cmc/lms`/`@cmc/admin`) + Brevo OTP root-cause fixed

**Context:** Routine build-status scout (`pnpm build`/`typecheck`/`test`/`lint`) on `main` @ `b81710a`, requested to verify project state before UAT/Go-No-Go.
**Build regression (unresolved, needs owner):**
- `pnpm build`/`pnpm typecheck` FAIL at `@cmc/lms` — ~30x `TS2307 Cannot find module '@astryxdesign/core/*'`
  (`packages/ui/src/primitives.ts` and most `packages/ui/src/components/*.tsx` import deep subpaths the
  installed `@astryxdesign/core@0.1.4` doesn't expose). `pnpm test` FAILS at `@cmc/admin`
  (`src/pages/cockpit-counter.test.ts`) with the same root cause at runtime via Vite — proves the defect is
  real for admin too, even though admin's `tsc --noEmit` passes clean (unexplained — flagged as open question).
  `pnpm lint` separately broken: `eslint` binary unresolved despite being a root devDependency.
- No `pnpm-lock.yaml`/`packages/ui`/app `package.json` changes since the Astryx merge (#28, #29) — the
  "typecheck + build clean" verification recorded in `docs/codebase-summary.md`/`system-architecture.md`/
  `project-roadmap.md` (2026-07-10) most likely ran in a separate git worktree
  (`D:\project\vip\worktrees\CMC-feat-astryx-migration`, visible in replayed turbo cache log paths) with a
  different `node_modules` state, not representative of a clean `main` checkout.
- `apps/lms` and `apps/admin` build from separate Dockerfiles (`Dockerfile.lms`/`Dockerfile.admin`). The
  2026-07-11 `cmcv2-prod` redeploy record in `docs/uat-checklist-go-live.md` only confirms **admin SPA 200**
  — LMS was never explicitly checked, so its live state on the VPS is unverified given this reproduces
  deterministically here.
- Full evidence: `plans/reports/build-status-260711-0141-astryx-typecheck-runtime-break-report.md`.

**Brevo OTP 401 — root cause found + local fix applied:**
- The 2026-07-10 journal's "`BREVO_API_KEY` returns `401 Key not found`" blocker was not a bad key — the
  local `.env.prod`'s `BREVO_API_KEY` line was missing a trailing newline and had swallowed the next line's
  `GRAPH_TENANT_ID=...` assignment, corrupting the actual key value sent to Brevo's API.
- Fixed locally (`.env.prod`, not committed — gitignored secret file): split the line, no other values
  changed. New key value verified against Brevo's `/v3/account` (read-only) — returns HTTP 200 once the
  calling IP is allowlisted (Brevo has "Authorised IPs" security enabled on this account).
- **Not yet applied to the live VPS** — needs: (1) VPS outbound IP added to Brevo's authorised-IPs list,
  (2) `.env.prod` redeploy (`docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps api worker`),
  (3) log verification.
- Side note: Brevo account is on the free plan, 300 sends/day cap — fine for pilot, a real ceiling at scale.

**Action needed before Go/No-Go:** re-verify `apps/lms` build on a clean checkout / on the VPS directly; do
not trust "build clean" claims dated 2026-07-10 without re-running.

---

## [2026-07-17] Super-admin completion — facility management, network CRUD, audit log (PR #34)

**Context:** Phase-03 (premium-erp-screen-buildout) final admin screens delivered.

**New:** Facility CRUD (create/update/list), FacilityNetwork IP-range management + self-detect, global audit-log viewer (generic middleware + reporter UI). OTP-leak plugged (M3 from post-impl H3).

**Verification:** typecheck 26/26 · api 889/889 · admin 258/258 · `pnpm build` 14/14 all green (CI unavailable due to GHA free-tier exhaustion, verified locally against cmc_edu test DB).

## [2026-07-16] Post-implementation review gaps — teacher scoping, worker wiring, OTP timeout (Commits 2af7b9d, bc44689)

**Context:** Code review of happy-path completeness (Phase 9 post-implementation cycle).

**Fixes:** 
- H1: submission.saveTeacherAnnotation now scoped by class ownership
- H2+M3: wire reconcileCancelledButProvisioned into worker (was dead code)
- MH1: submission.listForGrading scoped by class ownership (was leaking other classes)
- M1/M2: assessment.listBySession, sessionEvidence.getBySession now scoped by teacher class; classSession.cancel recomputes FinalGrade
- M5: sweepStaleOtpPayloads no longer scrubs in-flight OTP before reap timeout (fixes content-free email bug)

**Verification:** 826 api tests (93 files) + 239 admin tests (32 files) + domain tests all pass · e2e 20/20 attendance-lifecycle.spec.ts.

## [2026-07-15] Fix: close 43 happy-path gaps — race conditions, guards, data integrity (Commit 9c1522c); ADR 0043 attendance (Commit dc6a4db)

**Context:** Two parallel fixes: (a) race-condition/guard closure from peer review, (b) attendance model refresh per ADR 0043.

**(a) Happy-path gap closure (9c1522c):**
- C1: receipt-cancel vs provisioning SELECT FOR UPDATE + reconciliation backstop
- C2: manual punch approval track warnings (return warnings: string[])
- Teacher class-scoping authorization (assertTeacherOwnsClass guard)
- Lifecycle guards: block writes on cancelled sessions, withdrawn students
- Atomic operations: submission.grade compare-and-swap, ReconciliationFlag partial unique index
- Data integrity: duplicate-student confirmation on receipt create, student-scoped receipt kind, FinalGrade auto-refresh on attendance correction, exercise open-state re-check on submit, Tier B time-gate, slot/makeup-date validation, meeting double-book warning, refund-price-drift fix
- 2 new migrations (C1_reconciliation_flag_cancelled_kind, H5_reconciliation_flag_open_unique)

**(b) Attendance pair model (dc6a4db, ADR 0043):**
- Bỏ assignPunchesToShifts (±2h/ca ghép) → computeDayAttendance (mỗi ngày cặp vào/ra); payroll + KPI now use shared resolveDayCredit
- Offsite: TimePunch + auto-ManualAttendanceTicket (duyệt theo GĐ track, not managerId)
- Bỏ manualPunch.create; add manualPunch.resubmit; cooldown 10 giây; bỏ shortSpan flag
- shift.createTemplate validates endTime > startTime (blocks overnight-shift bugs)
- Docs synced (TL10/11/14/19/20/22/25/27, ADR 0043 marked implemented)

**Verification:** 759/759 api tests · 20/20 e2e attendance-lifecycle · 26/26 typecheck.

**Correction (same day, later investigation):** the "admin passes, only lms fails" split recorded above is
WRONG. Running `tsc -p tsconfig.json --noEmit` directly inside `apps/admin` (bypassing turbo) reproduces the
identical `TS2307` cascade. Root cause: the original `pnpm typecheck` run's task accounting was misleading —
26 typecheck tasks total, 21 "successful" + 1 explicitly failed (`@cmc/lms`) = 22, leaving 4 tasks (including
`@cmc/admin`) that were still in-flight when turbo stopped scheduling after lms's failure; their in-progress
"cache miss, executing" banner was misread as a completed clean pass. **Confirmed via isolated
`turbo run typecheck --filter=@cmc/admin --force`: `@cmc/ui#build` (admin's `^build` dependency) fails first
with the same TS2307s, so admin's own typecheck never even runs in a full pipeline — it's blocked, not
green.** This is a full regression across both apps, not an lms-only issue. Also ruled out: the
`feat/premium-design-language` worktree (`D:\project\vip\worktrees\CMC-feat-astryx-migration`) pins the same
`@astryxdesign/core@0.1.4` — not a version difference; its earlier "clean" verification is still unexplained
(possibly a different resolved package-content fetch at install time) and not worth chasing further without
registry-level access.

**RESOLVED (same day, final root cause):** the entire "regression" above was a stale local `node_modules`
on this dev machine, not a real bug in `@astryxdesign/core` or the Astryx migration code. Confirmed by:
(1) `docker compose -p cmcv2-prod ps` showed the `lms` container genuinely UP and serving `200` on `/lms/` —
its image was built inside `Dockerfile.lms` via a clean `pnpm install --frozen-lockfile` in a fresh
`node:22-alpine` container, which should hit the identical TS2307 wall if the bug were real; (2) ran
`pnpm install --frozen-lockfile` locally → 147 packages changed, including `eslint` being installed for the
first time (explains the separate `pnpm lint` "binary not found" failure too — same root cause); (3) re-ran
`pnpm build`/`pnpm typecheck`/`pnpm lint` after the fresh install → all fully green (14/14 build, 26/26
typecheck, lint clean). Lesson: this dev machine's `node_modules` had silently drifted out of sync with
`pnpm-lock.yaml` and nothing caught it until a routine build-status scout. All three "unresolved questions"
from earlier are now closed: no code fix needed for `@astryxdesign/core`; LMS's live container is confirmed
genuinely running Astryx code, not stale; the admin/lms tsc "asymmetry" was an artifact of the same stale
install plus a turbo task-accounting misread, not a real tsc blind spot. Preventive follow-up worth
considering: a CI or pre-push check that fails on a `node_modules`/lockfile mismatch.

## [2026-07-10] Premium design-language layer promoted to @cmc/ui (Phase 5)

**Context:** Admin cockpit pilot (Phase 1–2) validated a LOCKED design-language layer: light mode only, 
monochrome outline icons, one accent, warm canvas, Notion-subtle elevation, Inter typography. Phase 5 
promotes this layer into `@cmc/ui` as reusable surface for both admin + lms.

**Deliverables:**
- `tokens.premium` object (typed, mirrors `tokens.css` v2 premium block) — warm canvas #F7F6F3, 
  surface raised/sunken, blur-nav, shadows, typography scale, pill radius
- `LineIcon` component + `IconName` union (monochrome Feather outline, replaced all emoji)
- Premium composites: `MetricCard` (metric card with tone), `Panel` (elevation container), `TaskRow` 
  (compacted list item), `FunnelBar` (one-line chart)
- App frame: `AppFrame` + `SideNav` (sticky blurred topbar + left tree nav, router-free via onNavigate callback) 
  + types `NavModule`, `NavEntry`
- Page templates: `ListPage`, `DetailPage`, `FormPage` (thin slot-based composition)
- **@cmc/ui/premium.css** single import at app root (`.sh-*`, `.tpl-*`, `.premium-` CSS classes)
- **Inter Variable** (@fontsource-variable/inter) primary typeface in both apps
- **40+ vitest component tests** (vitest + @testing-library/react + jsdom) encode design invariants 
  (frame layout, nav tree, active states, blur effects, component rendering)
- Admin shell/cockpit/finance migrated onto premium components (parity preserved)

**Principles (LOCKED):** Light mode only · Monochrome outline icons · One accent #0071E3 · Warm canvas 
#F7F6F3 · Restraint + whitespace · Typography hierarchy · Notion reference. LMS shares base tokens + 
icons; warm mobile frame deferred to Phase 6.

**Docs:** Updated TL12 §4.5 (premium components overview), TL18 §1 (Inter + test harness), codebase-summary 
(expanded @cmc/ui, test counts).

## [2026-07-10] Reconcile migration↔schema.prisma drift (pre-P3-dump hygiene)

**Context:** The M1 P4 review flagged that the committed migration history had silently
diverged from `schema.prisma` (the source of truth). Left unfixed, the next
`prisma migrate dev` would re-bundle it into an unrelated migration (as happened in P4),
and the P3 cutover dump would ship a schema that doesn't match the declared model. This
captures the divergence in one deliberate, reviewed migration
(`20260710220000_reconcile_schema_drift`).

**Drift categories (verified via `prisma migrate diff` on a fresh migrations-built DB):**
- **id / updatedAt DB defaults dropped (18 tables)** — migrations set `DEFAULT CURRENT_TIMESTAMP` /
  uuid defaults; `schema.prisma` generates these app-side (`@default(uuid())` / `@updatedAt`),
  which Prisma does not back with DB defaults. Behaviourally inert — Prisma always supplies the value.
- **FK `ON UPDATE NO ACTION → CASCADE` (7 FKs)** — hand-written migrations omitted `ON UPDATE`;
  Prisma emits `ON UPDATE CASCADE`. Inert — every referenced key is an immutable UUID PK.
- **`QualitativeAssessment.confidence` `REAL → DOUBLE PRECISION`** — safe widening (schema declares `Float`).
- **`QualitativeAssessment.classSessionId` FK `ON DELETE RESTRICT → SET NULL`** — the only real
  behavioural change; matches the already-merged optional-relation declaration
  (`classSessionId String?` → Prisma default `onDelete: SetNull`). Dormant in practice: no prod
  path deletes a `ClassSession`, and test teardown already deletes assessments first.

**Verification:** migration applies cleanly on a fresh full-history deploy; `migrate status` = up to date;
`migrate diff` residual = empty; `schema.prisma` unchanged so the generated Prisma client is identical
(typecheck/build unaffected). Full suite validated in CI.

## [2026-07-10] M1 P4 hardening: sweep write-amplification fix, EmailOutbox index+retention, RLS fixture

**Context:** M1 pilot-stability plan (`plans/260710-0228-m1-pilot-stability-real-vps`) Phase 4 — closes
3 tech-debt items surfaced by the 2026-07-10 red-team review, independent of the VPS/infra phases.

- **Sweep NULL-trap fix (H1):** `sweepStaleOtpPayloads` matched any row with `payload.kind=='otp'`
  regardless of scrub state, so every relay cycle re-`UPDATE`d the entire history of already-scrubbed
  OTP rows (unbounded WAL/DB growth). Fixed with a whole-object `NOT: { payload: { equals:
  SCRUBBED_OTP_PAYLOAD } } }` filter — a path-scoped check (`NOT path:['scrubbed'] equals true`) would
  have been a NULL-trap instead (missing key on unscrubbed rows → 3-valued UNKNOWN → row silently never
  scrubbed, the exact vulnerability this sweep exists to close).
- **EmailOutbox index + retention:** added `@@index([status, createdAt])` (drain query was seq-scanning)
  and `pruneTerminalOutbox()` — deletes `sent`/`dead` rows older than `EMAIL_OUTBOX_RETENTION_DAYS`
  (default 30d, env-configurable), called each `relayEmailOutbox` cycle; result gained a `pruned` field
  (additive, no breaking change — the only production caller discards the whole result today).
- **receipt-get.test.ts fixture fix:** pre-existing RLS 42501 failure from a naked `db.receipt.create`
  bypassing `withFacility`; wrapped in `testDbBypass` (the standard arrange-helper for direct writes to
  RLS-protected tables).
- **Migration hygiene finding:** the first `prisma migrate dev` auto-generated migration for the index
  silently swept in ~121 lines of unrelated pre-existing drift (7 FK on-delete/on-update action
  mismatches, 18 tables' `id`/`updatedAt` `DROP DEFAULT`, `QualitativeAssessment.confidence` REAL→DOUBLE
  PRECISION type correction) between the historical migration files and `schema.prisma` — caught by
  code review before landing. Stripped to a hand-authored migration containing only the `CREATE INDEX`
  statement. The underlying drift is real but pre-existing and out of this phase's scope — **follow-up
  needed**: a dedicated, reviewed migration to reconcile it, before it risks landing silently again on
  a future `prisma migrate dev` run.
- Gates: typecheck 26/26 · build 14/14 · unit suite 524/527 (3 fail = `assessment/draft-confirm.test.ts`
  LLM/PII tests, confirmed pre-existing on unmodified `main`, unrelated) · e2e Mode-B 17 passed/1 skipped
  (`TEST_OTP_SEAM`, expected off in prod).

## [2026-07-10] LMS gap closure: OTP email delivery + parent visibility + test backfill

**Context:** Scout 260709-2350 found `requestOtpEmail` never delivered any email (no transport called)
— parents could not log into the LMS in production. PO also chartered the LMS role experience (docs/17
§6): parents see homework results + attendance, never receipt/money data.

**Phase 1 — OTP email delivery (auth-adjacent):**
- `requestOtpEmail` now enqueues a real `EmailOutbox` row (transport `brevo`) when a `ParentAccount`
  owns the target email; response stays `{ok:true}` either way (no-leak preserved)
- Global fail-closed cap on `kind='otp'` enqueue volume per hour (email-bomb / Brevo-quota defense)
- Relay worker: OTP payload scrubbed on both `sent` and `dead` terminal states, plus an age-based
  sweep (`sweepStaleOtpPayloads`) for rows stuck past the OTP's own 5-minute login TTL — sweep runs
  AFTER the drain loop each cycle (a same-cycle-before-drain ordering bug, caught in code review, would
  have sent empty-content emails for stale rows)
- ADR-E(b) (docs/16): plaintext-in-outbox trade-off formally documented and accepted

**Phase 2 — Parent visibility (submission/attendance):**
- New `submission.listForChild` / `attendance.listForChild` (parent-only, `requireLmsParent`) — same
  `getApprovedChildren` + `auditChildDataAccess` boundary as every other LMS read
- LMS UI: new "Bài tập & điểm" page; per-session evidence view now merges attendance status
  ("Nghỉ học" / "Đi muộn")
- ADR-E(a) (docs/16): parent-mediated student password is now a documented decision, not "P0-debt"

**Phase 3 — Test backfill (6 modules):** `appointment`, `reconciliation`, `course`, `room`,
`parentAccount`, `class/schedule-router` (schedule.generateSessions already had deep coverage —
verified, not re-duplicated). Added a fail-closed DB-safety guard (`cmc_prod` name check) in both
`apps/e2e/src/global-setup.ts` and `apps/api/src/test/db.ts`.

**Phase 4 — Docs:** docs/17 §6 (LMS role experience table), docs/16 ADR-E, UAT KB1 step 8 amended
(receipt viewing → homework results + attendance), docs/14 §5 LMS-surface note.

**Gates:** typecheck ✅ (api, lms, e2e) · full api suite 524/525 (1 pre-existing unrelated failure in
`finance/receipt-get.test.ts`, confirmed unrelated — reproduces standalone, untouched by this diff) ·
lms build ✅.

**Known gap:** live-verify confirmed the full pipeline (enqueue → worker → Brevo call → correct
failure handling, no code leaked) but the local-sim stack's `BREVO_API_KEY` returned `401 Key not
found` — matches the 260709 sprint journal's noted gap ("LMS OTP: manual only, never verified in
anger"). Real end-to-end email delivery is still unverified; needs a valid Brevo credential before
UAT KB1 step 7 can be signed off.

---

## [2026-07-09] Backup hardening — R2 encrypted upload + restore drill pass

**Context:** Phase 2 infrastructure hardening; backup restore (RT-13) pre-condition for M0 GO/NO-GO.

**Encrypted backup to R2:**
- `cmc-db-backups` bucket (R2 Cloudflare), 30-day lifecycle rule, public access disabled
- AES-256-CBC encryption via `openssl enc -aes-256-cbc -pbkdf2` with symmetric passphrase
  `BACKUP_ENCRYPTION_PASSPHRASE` (NOT `age` — corrected 2026-07-09; DR must follow
  `docs/runbook-deploy.md` §1.7 / `scripts/backup-db.sh`)
- Escrow: passphrase copy in team password manager (user action pending confirmation)
- All 49 tables included in dump; `--no-acl` removed so cmc_app GRANTs survive restore (`b0cd729`)

**Restore drill passed (2026-07-09):**
- Backup host ≠ deploy host (RT-13 safety validation)
- `pg_restore` clean exit; Prisma `?schema=` query param stripped before pg_dump (`b0cd729`)
- 49 tables verified post-restore; RLS smoke query via cmc_app PASS
- Escrow decrypt validated: passphrase alone decrypts backup → valid PostgreSQL custom dump

**Gates:** G5 ✅ (restore drill passing)

---

## [2026-07-09] Phase 4 UAT automated slice — e2e 17/18 pass, lms-auth-two-tier deleted

**Context:** Phase 4 go-live UAT automation. Automated e2e gates (G1, G5, G8, G9, G10) proven; manual gates (G2–G4, G6, G7) tracked in UAT checklist.

**e2e Run 1 + Run 2 (Mode-B, NODE_ENV=production):**
- 17 passed, 1 skipped (TEST_OTP_SEAM — correct; seam disabled in prod)
- Consecutive runs: both passed ✅
- DB: throwaway `cmc_staging` (≠ cmc_prod)
- Session injection via signed cookies (staff: `mintStaffCookie`, LMS: `mintParentToken`)

**lms-auth-two-tier stub deletion:**
- File `apps/api/src/lms-auth/lms-auth-two-tier.test.ts` was 13 empty stubs (0 assertions)
- Deletion rationale: coverage proven in e2e `kind-isolation.spec.ts` + `lms-auth.spec.ts`
- Two-tier gates (kind checking, sibling scope, student lockout, resetChildPassword scoping) verified under Mode-B prod config

**Blocker gap fixed (2026-07-09 during Run 1):**
- 2 LMS specs (`kind-isolation`, `attendance-grading`) used dev-header helper (`x-dev-lms-user`)
- Mode-B disabled dev-headers → UNAUTHORIZED before kind-gate (4 tests red)
- Fixed: migrated to factory mode-aware clients (`createE2eLmsStudentClient`, `createE2eLmsParentClient`)
- Matches staff pattern in `apps/e2e/src/trpc-client.ts`

**Gates passed:** G1 ✅, G5 ✅, G8 ✅, G9 ✅, G10 ✅

**Remaining gates (manual):** G2 (real-user UAT), G3 (cutover probe), G4 (audit), G6 (security review), G7 (env sign-off)

---

## [2026-07-09] Phase 3 flow audit — 0 CRITICAL, 3 HIGH (UAT coverage gaps, not code defects)

**Verdict:** REDEPLOY_NOT_REQUIRED — no blocking code findings.

**Finding summary:**
- **0 CRITICAL:** No code execution defects
- **3 HIGH:** UAT coverage gaps (not code bugs)
  - Real-user auth flow untested in anger (covered: dev stub, e2e Mode-B; gap: live Entra + parent OTP via Brevo)
  - E2E doesn't cover all 5 UAT scenarios from Section 2 (staff + real LMS users)
  - ctv_mkt role status ambiguous per HIGH-2 (resolved 2026-07-09: marked dormant, business decision pending)
- **13 MEDIUM:** Traceability drift (docs vs code, mitigated by TL14 + TL16 amendment)

**Remediation:**
- ctv_mkt dormant per ADR-D amendment (2026-07-09 commit)
- UAT Section 2 scenarios to be executed manually (real staff + parent/student actors)
- Follow-up audit: post-UAT (2026-07-10 target)

---

## [2026-07-09] Phase 2 env-prod hardening — Nginx DNS, LMS API URL, CRLF, ACL backup

**Nginx DNS-cache 502:**
- Root cause: upstream resolver caching stale IPs under rapid facility scale-out
- Fix: added explicit `resolver` directive with TTL in nginx prod config
- Result: no more 502s on facility creation

**LMS prod API URL:**
- Fix: `NEXT_PUBLIC_API_URL` env var pointing to correct API host in prod environment
- Impact: parent login OTP requests now reach correct endpoint

**CRLF line endings:**
- Added `.gitattributes text=auto eol=lf` rules for shell scripts
- Prevents CRLF-induced deploy failures (Windows dev → Linux deploy mismatch)

**Backup ACL preservation:**
- PostgreSQL dump now preserves ACLs (`pg_dump --clean` with role restore)
- Prisma connection string `?schema=` parameter stripped before `pg_restore` to avoid schema mismatch
- Restore tested successfully (2026-07-09 drill)

**Phase 2 acceptance:** Phase 2 UAT scenarios (docker compose stack + SSO smoke) prerequisites met; ready for Task #8 execution

---

## [2026-07-09] Role scope alignment Nac 2 — ADR-D amendment (5 active roles)

**Branch:** `main` — single PR, 4 phases.

- `@cmc/auth`: added `ACTIVE_ROLES` (5) / `ActiveRole` type; `PERMISSIONS` narrowed to `ActiveRole[]`; dormant roles (ke_toan/cskh/ctv_mkt/hr) removed from all permission arrays; `can()` widening cast for type safety; `ROLES` (9) preserved for enum drift-test.
- `user.updateRoles`: zod schema now rejects dormant roles (BAD_REQUEST); last-super-admin guard added (FORBIDDEN when removing the only active super_admin).
- Admin UI (users.tsx): `ROLE_OPTIONS` derived from `ACTIVE_ROLES`; modal filters dormant roles on open (prevents deadlock for legacy users).
- `context.ts` session schema: kept 9-role (prevents staff lockout from legacy tokens).
- e2e `finance-approval.spec.ts`: fixture changed from ke_toan to GĐKD for second-eye coverage.
- TDD: 447 tests in `@cmc/auth` — full permission matrix + deferred-denial + invariant.
- Docs: ADR-D amendment in TL16, TL14 §1/§5 updated, roadmap invariant updated.

---

## [2026-07-08] Phase 1 — Staff Entra SSO land + CSRF fix + RBAC hardening (PR #24, MERGED)

**Branch:** `feat/staff-sso-golive` — 5 commits, CI green (typecheck-and-test ×2, e2e ×2), merged to main `00ca207`, branch deleted. Task #10 completed. Roadmap vision M0–M4 chốt cùng ngày: `docs/project-roadmap.md`.

**CSRF protection (CRITICAL-C1 closed)**
- `sso-routes.ts`: `/auth/login` generates `randomBytes(16)` state, HMAC-SHA256-signs it with `STAFF_SESSION_SECRET`, stores in HttpOnly `oauth_state` cookie (TTL 300s, SameSite=Lax). `/auth/callback` validates signature + constant-time state comparison before proceeding to token exchange. Old incorrect comment removed.
- Test: `sso-routes.test.ts` — 5 CSRF callback tests covering state_missing/state_invalid/state_mismatch/valid paths.

**Boot-checks hardening (H2 + G10 closed)**
- `assertStaffLmsSecretsDistinct()` (G10): refuses prod boot when `STAFF_SESSION_SECRET === LMS_SESSION_SECRET`.
- `assertRequiredEnvForProd` SSO block: `STAFF_EMAIL_DOMAIN` now required when `SSO_ENABLED=true` (fail-closed); previously only `console.warn`.
- Both called in `server.ts` synchronous boot sequence.

**e2e mode-switching (CRITICAL-C2 closed)**
- `createE2eStaffClient` in `trpc-client.ts`: Mode-A (x-dev-user header) in non-prod, Mode-B (signed cookie via `mintStaffCookie`) in `NODE_ENV=production`.
- All 31 call sites in 6 spec files migrated from deprecated `createStaffClient`. Phase-3 prod-config e2e gate is now achievable.

**Super_admin seed script (H4 closed)**
- `scripts/seed-super-admin.ts`: idempotent upsert Facility + `AppUser{roles:[super_admin]}` for pilot bootstrap (resolves bootstrap-paradox — only super_admin can assign roles via `user.manage`).

**DB migration**
- `20260707200000_staff_role_enum_and_assignment`: adds 9-value `Role` enum (ADR-D) + `AppUser.roles Role[]`.
- Pre-flight query required before deploy: `SELECT email, count(*) FROM "AppUser" GROUP BY email HAVING count(*)>1` must return 0 rows.

**Role-drift test**
- `user/role-drift.test.ts`: asserts Postgres `Role` enum exactly matches `@cmc/auth ROLES` (9 values). Fails immediately on drift.

**Adversarial auth review result:** APPROVE_WITH_CONCERNS — all 25 security checklist items PASS; 5 non-blocking concerns (phantom login test, multi-pod sticky-session note, silent MSAL warning).

**Gates:** typecheck 26/26 · tests 473 passed/13 skipped · build 26/26

**Drift fixes:** `260707-2128` phase-03/04 → `superseded`; `260707-1830` plan → `superseded`.

**Remaining open (unblocked after merge):**
- Task #8: Phase 2 (WSL2 + docker compose stack + SSO smoke)
- Task #9: Phase 3 (UAT e2e 2× + go/no-go)
- lms-auth-two-tier 13 skipped tests → un-skip before Phase 3 Run 1

---

Older entries (before 2026-07-08) → `docs/project-changelog-history.md`.
