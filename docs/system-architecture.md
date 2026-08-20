# CMC EDU v2 — System Architecture (As-Built)

**Date:** 2026-07-11 (historical snapshot — see note below for current numbers)  
**Phase:** P1–P4 complete and tested (SSO landing · flow audit · Astryx UI Phase 3–4) · UI migration Phase 4 complete (apps/lms 100% Astryx) · Phase 5 (Mantine dep removal) next  
**Build Status (as of 2026-07-11):** Merged to main · 532/532 tests passing (0 skipped) in 64 test files · 26/26 typecheck green · e2e UI 5 passed · API e2e 17 passed. *(2026-07-11: a stale local `node_modules` briefly made this look broken — resolved via `pnpm install --frozen-lockfile`; not a real code regression. See `docs/project-changelog.md` `[2026-07-11]`.)*

> **Updated 2026-07-17 (acceptance-review audit):** test counts above are a historical snapshot, not current. As of 2026-07-17: apps/api 99 files/889 tests, apps/admin 33 files/258 tests, apps/e2e 11 spec files. **(Số liệu 07-17 — đã bị thay thế; số hiện hành ở banner 2026-07-26 bên dưới.)** Router/table/migration/RLS counts elsewhere in this doc were corrected the same day — see `docs/project-changelog.md` `[2026-07-17]`.
>
> **Updated 2026-07-24 (UAT prep — journey e2e):** Phase 4–5 journey infrastructure added 13 new spec files (3 regression + 10 core flows). ~~Current e2e count: ~21+ spec files.~~ — **superseded, xem banner 2026-07-26.**
>
> **Updated 2026-07-26 (nghiệm thu journey + CI khôi phục):** e2e hiện **43 spec file** (31 journey UI), chạy trong project `ui-chromium` trên CI. Sổ nghiệm thu: **31/38 luồng đã chứng minh chạy** tại commit `324bd12`, sinh từ artifact CI (`gitDirty:false`) — **đã chạm trần journey**; 7 luồng còn lại `no-ui-path` ⇒ 38/38 đều có trạng thái máy-chứng. Journey ở mức smoke — chứng minh luồng chạy thông, không chứng minh đúng số học nghiệp vụ; UAT người thật chưa chạy. Chi tiết: `docs/codebase-summary.md`.
>
> **Updated 2026-08-06 (design3 admin shell):** `apps/admin` production chrome is the **CMC Console** UI language (Odoo-inspired) — root `.o_web_client`, top **ConsoleNavbar** + app-switcher, content in `main.console-main`. `AppFrame`/`SideNav` are **not** used on admin; LMS uses `apps/lms/src/app.css` (`lms-*`; `premium.css` deleted). Design authority: `docs/design-system-console.md`. Lab route `/design3` was deleted after promote.
>
> **Updated 2026-08-07 (FilterBar + list search + ui-e2e):** G1 **FilterBar** is the list filter host on ControlBar (debounced text; select `hasClear` for default-domain filters). Optional tRPC **`search`** on major list procedures (users, facilities, courses, classBatch, pickList, grading queue, …). ListPage FilterBar adoption ~**20/23** (holdouts: leaderboard, class-placement, refund). **CI:** `typecheck-and-test` + `ui-e2e` green on `develop` PR #75 (`eaa223a`). **Acceptance re-measure** @ same SHA (CI journey artifact, `gitDirty:false`): **31/38 proven**, 7 `no-ui-path` — no journey regression from FilterBar ship. Evidence: `plans/reports/ship-20260807-filterbar-search.md`, `plans/reports/cook-260807-0902-design3-validation-acceptance.md`. Still open: human visual smoke; 6 untriaged API orphans (pre-existing tool exit 1).
>
> **Updated 2026-08-12 (truth sync — post P1 wave / PR #110 + hardening):** Required CI on **develop and main** (branch-protected): **`typecheck-and-test` + `ui-e2e`** both block merge (since 2026-08-02; not advisory). Acceptance ledger is a **measured snapshot** — live source is always `pnpm acceptance:report` + latest CI `ui-e2e` journey artifact. Snapshot after P1-08 journey + form-depth/LMS-foundation wave: **36/42 flows proven** (was 31/38 in older photos; manifest/journey count evolved). Residual dual-HITL UI: teaching exercises list only (GAP #3). See `plans/reports/scout-260812-1054-develop-consolidated-state.md` and `plans/reports/INDEX-live-260812.md`.
>
> **Updated 2026-08-12 (chiều — PR #117/#118/#119 + đóng băng `cmc-lms`):** Khung chương trình thật **96 unit** (CSV; `CurriculumUnit.level` = chuỗi). Buổi bù đã gỡ. Mở bài = `SessionExercise` đã phát + `onRoster` (dải unit bắt buộc). Hai cờ env `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` **đã xóa khỏi code**. Bài nộp khóa `(sessionExerciseId, studentId)`. Repo chị `cmc-lms` **đóng băng** tại commit **`031d193`** (ngày commit 2026-08-09; chốt 12/08): vẫn sửa lỗi vận hành, **không** thêm tính năng mới; bản chuẩn để port là `031d193`. Không tắt `cmc-lms` — hệ cũ vẫn phục vụ trung tâm cho tới khi hệ mới đủ tốt để thay.

---

## Architecture Overview

CMC EDU v2 is a **monorepo, facility-scoped ERP/LMS** with phase-driven buildout:
- **P1 (complete):** Identity & enrollment pipeline (lead → opportunity → receipt → active enrollment)
- **P2-P4 (built & tested):** Class operations (attendance, exercise, assessment, session evidence, course, room), HR/payroll (shift, payroll, KPI, check-in), and redemption (rewards, meeting, appointment, after-sale)

### C4 Model (TL09)

```
┌─────────────────────────────────────────────────────────────┐
│ External Systems (P2+)                                      │
│ - Brevo (email)  · Graph (SMS)  · Real SSO (OAuth2)        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ CMC EDU Platform (Monorepo)                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Frontend (Vite+React)                               │  │
│  │ - apps/admin: ERP SPA, 30 routes, 100% Astryx       │  │
│  │ - apps/lms: LMS SPA, kind gate (parent/student)    │  │
│  │ - tRPC client; dev-auth via x-dev-user header      │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                      │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │ tRPC API (Node.js)                                  │  │
│  │ - 38 domain routers (crm, finance, enrollment, …)  │  │
│  │ - RBAC middleware (requirePermission)              │  │
│  │ - Facility scope enforcement (scoped context)      │  │
│  │ - RLS context injection (facility_id session var) │  │
│  │ - Worker orchestration (reconcile, email relay)    │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                      │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │ Prisma 7 (driver adapter) + Postgres                │  │
│  │ - 51 models (sales, identity, classes, HR, …)     │  │
│  │ - Row-level security (37 tables)                   │  │
│  │ - Append-only ledger (RefundRecord, AuditLog)      │  │
│  │ - Migrations: 42 folders (P1 through P4 + fixes)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│ [LLM client: BUILT (tested) · MCP transport: SKELETON]     │
└─────────────────────────────────────────────────────────────┘
```

---

## Layers & Responsibilities

### 1. Frontend (Vite+React)
**Status:** Two apps shipped — ERP admin (phases 02–06) + LMS portal (phase 07)

**apps/admin/** — ERP SPA, ~30 routes
- 100% Astryx (@astryxdesign/core@0.1.4) via `@cmc/ui/primitives` single-door barrel (Phase 3 complete)
- **Shell (2026-08-06):** `apps/admin/src/shell/shell.tsx` renders `.o_web_client` + `ConsoleNavbar` (app-switcher, permission-gated section menus, systray) + `main.console-main` outlet. `/login` is outside the shell; `/change-password` is inside with **chrome suppressed** (no navbar/⌘K). CSS: `@cmc/ui/console.css` only (console.css only on admin). See `docs/design-system-console.md`.
- tRPC client gated with `x-dev-user` header (dev auth until Entra SSO)
- Route groups: sales, teaching, hr, finance, admin + generic table coverage
- `can()` RBAC guards per route; `session.me` for over-threshold role check
- ESLint no-restricted-imports rule enforces UI imports from `@cmc/ui` only (apps/admin scope, Phase 4 widens to lms)

**apps/lms/** — LMS SPA, mobile-first
- Parent sessions (`kind:'parent'`): email-OTP login, child picker, session evidence (consent-gated photos), report card, reset child password, consent settings
- Student sessions (`kind:'student'`): phone+password login, `mustChangePassword` gate, exercises (mở khi đã phát `SessionExercise` + `onRoster`; nộp theo `sessionExerciseId`), PDF annotation submit, star balance + gift redemption
- **Kind guards:** `ParentOnly`/`StudentOnly` route wrappers in `kind-guard.tsx` — redirect to `/login` on wrong kind; backend `requireLmsParent`/`requireLmsStudent` re-gates every procedure
- Session: `parseLmsToken` (base64url, unsigned placeholder — P0-debt: add HMAC signing)
- `x-dev-lms-user` header (dev auth, `import.meta.env.DEV`-gated `DevHeaderWriter`)

**UI Design System Migration (Mantine 7 → Astryx) — Phases 1–4 COMPLETE (2026-07-10):**
- **Phase 1 (spike, complete):** Verified Astryx (@astryxdesign/core@0.1.4 beta) against production readiness criteria: precompiled CSS (no bundler plugin required), clean build/typecheck/HMR, zero supply-chain vulnerabilities (audit + signature-verified), CSS bundle favorable vs. Mantine (full system smaller, per-component JS deltas bounded), token override via plain CSS custom properties. **GO decision made.**
- **Phase 2 (complete):** All 10 shared components migrated from Mantine to Astryx (status-badge, empty-state, stat-card, page-header, result-panel, confirm-dialog, cmc-tabs, filter-bar, master-detail, data-table). `cmcTheme` deleted; replaced with `AstryxCmcProvider` (CSS-only scope wrapper, `data-astryx-theme="neutral"`). Brand tokens via CSS custom properties. peerDependencies: removed @mantine/core, added @astryxdesign/core@0.1.4 + @stylexjs/stylex@0.18.3. Both apps/admin and apps/lms: MantineProvider + AstryxCmcProvider coexist (strangler pattern). Workspace clean: typecheck + build + test green. Browser e2e specs: 4 passing, 1 fixme (pre-existing session-context bug), 0 failing.
- **Phase 3 (complete, 2026-07-10):** apps/admin **100% migrated** from Mantine to Astryx — all 34 page/lib files + shell (AppShell frame) rewritten. Single-door barrel `@cmc/ui/primitives` created (thin re-export of Astryx primitives: Text, Stack, HStack, Button, Badge, TextInput, Selector, Dialog, AppShell, SideNav, etc.). Apps import ALL UI from `@cmc/ui` only; `rg "@mantine" apps/admin/src` = 0 real imports. Migration order (risk-first): shell/AppShell (single-point-of-failure) → login → 5 business-area clusters (CRM/finance/teaching/HR+attendance/students). ESLint flat config added (`eslint.config.js`, NO prior lint in repo): enforces `no-restricted-imports` banning `@mantine/*` and `@astryxdesign/*` in `apps/admin/**` (one-door rule), whitelisting `apps/admin/src/main.tsx` (single entry for reset/theme CSS + providers). New devDeps: eslint, typescript-eslint, eslint-formatter-compact. `pnpm lint` script added. Reset flip: `apps/admin/src/main.tsx` now imports `@astryxdesign/core/reset.css` + dropped MantineProvider + `@mantine/core/styles.css` (no zero Mantine components; avoids double-reset conflict). Mantine package deps remain in package.json until Phase 5 (rollback policy) — runtime usage removed only. Sandbox deleted: `apps/admin/src/pages/sandbox/`. Verification: workspace typecheck + build clean; per-cluster gates passed; e2e green (4 passed, 1 fixme); auth-screen blocking: Astryx reset applied cleanly, focus-visible ring brand-colored (#0071E3), disabled buttons natively inert. Code-review: Approve, 0 Critical. Known API-mismatch trade-offs (non-blocking, accepted): semantic-color enums can't take raw hex (use `<span style>`), Button/Badge variant approximations, Dialog focus-trap differs from Modal, NumberInput lost live thousand-separator, TextArea lost autosize — all flagged in-code with `TODO(astryx-review)`.
- **Phase 4 (complete, 2026-07-10):** apps/lms **100% migrated** from Mantine to Astryx — all 13 files (login page + 10 parent/student pages + routes + main.tsx) rewritten. `rg "@mantine" apps/lms/src` = 0 real imports. **New @cmc/ui composites added:** `TextField` (forwards standard HTML input attributes—inputMode, maxLength, autoComplete, pattern—that Astryx TextInput omits but passes via ...rest at runtime) and `PasswordInput` (Astryx lacks native password input; composes TextField + show/hide toggle). Also `ProgressBar` added to primitives barrel. These filled gaps needed by LMS login hardening. **LMS login hardening preserved & e2e-verified:** 2-tab login (parent email-OTP | student phone+password) kept all security attributes across migration (TL12 §9, red-team F11 / AC#5): OTP field autoComplete="one-time-code" + inputMode="numeric" + maxLength=6; password autoComplete="current-password"; phone inputMode="tel"; email type. New non-skippable e2e test asserts these land on real DOM. Generic no-leak error messages preserved. Astryx deps exact-pinned (0.1.4) so ...rest-passthrough behavior can't regress. **Theme-level fixes (LMS mobile QA):** `:focus-visible` brand-outline fallback on form controls (Astryx focus ring rendered transparent under CMC theme—a11y blocker) + `@media (max-width:768px)` 44px min-height touch-target rule for text inputs + buttons (Astryx ~32px < TL12 §7's 44px; mobile-only, desktop admin keeps ERP density). **ESLint one-door rule extended to apps/lms/**. Reset flip: apps/lms/src/main.tsx imports @astryxdesign/core/reset.css + drops MantineProvider; @astryxdesign/core added as lms devDep. **Known documented trade-off:** Astryx TabList renders tabs as plain buttons (no ARIA role=tab/aria-selected)—an a11y regression vs Mantine; beta-Astryx limitation affecting all Astryx tabs, flagged for possible future @cmc/ui ARIA wrapper. Verification: lms typecheck + build clean; lint (admin+lms) clean; UI e2e 5 passed + 1 fixme; API e2e 17 passed. Code-review: Approve (0 Critical; 1 Important fragility already mitigated by exact-pin + non-skippable e2e attr test).
- **Bugs found & fixed (PR #27):** (1) tRPC basePath missing → 404 on browser clients — fixed with conditional prefix-strip. (2) finance/receipt-get.test.ts DB write missing withFacility() — fixed. (3) student/change-password.tsx session timing bug — unfixed, tracked test.fixme(), not Astryx-related.
- **Migration strategy:** Strangler pattern (Mantine + Astryx coexist through Phase 4; Mantine removed Phase 5). Public API preserved.
- **Roadmap:** Phase 5 (remove Mantine package deps entirely + full e2e QA + TL12 docs updates) is final phase remaining.
- **Plan:** `plans/260710-0236-astryx-ui-migration/` (5 phases, tracked development context).

**Auth Integration:**
- Staff (2026-07-26, M365 tenant access lost): **email/password là đường đăng nhập production** — `POST /auth/staff-login` (mount vô điều kiện, `apps/api/src/auth/password-routes.ts`): PBKDF2-SHA256 (tái dùng `lms-auth/password-hash.ts`), lockout 5 lần/15′, thông điệp lỗi generic + dummy-hash chống enumeration, phát cùng cookie `cmc_staff_session` như đường SSO. Cấp mật khẩu: `SUPER_ADMIN_PASSWORD` (seed) hoặc `user.resetPassword` (trang Users, super_admin) → `mustChangePassword` ép đổi ở lần đăng nhập đầu (`/change-password`, enforce phía client — cùng pattern LMS). Schema: partial unique index `lower(email) WHERE email <> ''` trên AppUser.
- Staff (tạm tắt): Entra SSO sau flag `SSO_ENABLED=false` + `VITE_SSO_ENABLED=false` — code giữ nguyên, bật lại chỉ bằng env. **Known issue khi bật lại:** `sso-routes.ts:220` lookup AppUser bằng client thuần (không `withFacility` bypass) — RLS trả 0 dòng ⇒ SSO sẽ từ chối mọi user; phải sửa lookup này (wrap `withFacility(..., {bypass:true})` như password-routes) trước khi bật SSO thật.
- Staff (dev): `x-dev-user` header — không đổi.
- LMS Parent: `lmsAuth.requestOtpEmail` / `verifyOtpEmail` — Brevo IS wired and selected in prod (`BREVO_API_KEY` + `BREVO_SENDER_EMAIL` set on `cmcv2-prod-{api,worker}`), but as of 2026-08-20 the configured prod key is **invalid**: every send dies with `BrevoEmailTransport: HTTP 401 — {"message":"Key not found"}` (EmailOutbox: 13 `dead`, 0 `sent`) ⇒ **parents cannot receive OTP in prod until a valid `BREVO_API_KEY` is set**. Local/dev still uses ConsoleEmailTransport (OTP in server log). Graph/SMS tạm tắt cùng M365.
- LMS Student: `lmsAuth.loginStudent` (PBKDF2-SHA256, mustChangePassword, 5-attempt lockout)

---

### 2. API Layer (tRPC 11)
**Status:** P1 complete, worker stubs

**Routing:**
```
tRPC root router (appRouter)
├── health             [public query]
├── crm                [5 procedures]
├── finance            [5 procedures]
├── enrollment         [3 procedures]
├── guardian           [4 procedures]
├── student            [1 procedure stub]
├── lmsAuth            [2 procedures]
└── facility           [1 procedure stub]
```

**Middleware Stack (per procedure):**
1. **publicProcedure** or **authenticated** — token validation (fail-closed dev stub)  
2. **requirePermission(domain, action)** — RBAC gate via `@cmc/auth` registry  
3. **scoped(ctx)** — extract facilityId (server-controlled, never client input)  
4. **withFacility** — set RLS session variable + transactional context

**Request Flow:**
```
Client → tRPC call
  ↓
tRPC middleware chain
  ├─ token validation
  ├─ permission lookup (@cmc/auth registry)
  ├─ facility scope resolution
  └─ RLS context setup
  ↓
Prisma (with RLS + transaction)
  ├─ SELECT/INSERT/UPDATE/DELETE (filtered by facility_id policy)
  ├─ Append-only enforcement (ledger tables)
  └─ Atomic mutations
  ↓
Response (DTO serialization)
```

---

### 3. Domain Logic (Shared Packages)

#### `@cmc/auth` (RBAC Registry)
**Single source of truth** for role/permission mapping (docs/TL14).

```typescript
// Pattern: each procedure declares required role(s)
requirePermission('crm', 'opportunityCreate')  // checks registry
```

**Roles (9 khai báo, nhưng chỉ 5 hoạt động — ADR-D):**

> ⚠️ **Đính chính 2026-07-23.** Danh sách dưới từng mô tả cả 9 vai như đang dùng được. **Sai.** ADR-D (2026-07-08) chốt chỉ **5 vai hoạt động**: `super_admin`, `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale`, `giao_vien`. Bốn vai còn lại (`ke_toan`, `cskh`, `ctv_mkt`, `hr`) là **giá trị enum trơ** — không quyền nào, không gán cho ai; `packages/auth/src/index.test.ts` có test khẳng định chúng bị từ chối ở **mọi** key. Mô tả năng lực của 4 vai đó bên dưới là **ý định cũ**, không phải hành vi hiện tại.
- `super_admin` — bypass most gates (bootstrap, hardening context)
- `giam_doc_dao_tao` — training director; **only** staff role satisfying ADR-B second-eye gate (along with `super_admin`) — `giam_doc_kinh_doanh` alone does NOT satisfy ≥20M threshold (`finance/router.ts:41`)
- `giam_doc_kinh_doanh` — business director; money gate approver (under threshold); does NOT satisfy `SECOND_EYE_ROLES`
- `sale` — sales staff (lead entry, opportunity, receipt creation)
- `giao_vien` — teacher (attendance, grading, session evidence)
- `ke_toan` — accountant (receipt approve, payroll)
- `cskh` — customer care (guardian link approval, parent email update)
- `ctv_mkt` — marketing affiliate (manual punch creation — **suspicious**, under review per HIGH-2 finding)
- `hr` — HR staff (rewards manage, meetings, KPI, shift management)
- `phu_huynh` — parent (LMS: read enrollment, request link)
- `hoc_sinh` — student (LMS: read self, submit exercises)  

---

#### `@cmc/domain-finance` (Money Logic)
Atomic financial operations, not tied to any table schema directly.

**Exports:**
- `nextReceiptCode(facilityId, counter)` — global receipt code counter (atomic)  
- `computeReceiptKind(studentId, classBatchId)` — detects new vs renewal  
- `duplicatePhoneWarning(db, phone)` — alerts on parent phone reuse (K12)  
- `assertRefundWithinCap(receipts, refund)` — ensures sum(refunds) ≤ receipt.netAmount  
- `RefundCapExceededError` — exception class

**Idempotency Pattern:**
- All functions accept transaction (Prisma.TransactionClient)  
- Check existence before create (safe to replay)

---

#### `@cmc/domain-identity` (Identity Logic)
Minimal (P1) — mostly handles phone normalization.

**Exports:**
- `normalizeLoginPhone(phone)` — Vietnamese phone format (09xxx → 84xxx)

---

#### `@cmc/db` (Database Layer)
Prisma 7 schema + helper functions. Prisma 7 removed `datasource.url` from
`schema.prisma` and the `new PrismaClient({ datasources })` constructor
override; connection selection now happens via a **driver adapter**
(`@prisma/adapter-pg` over `pg`), built explicitly from a connection string.
CLI operations (`migrate`/`generate`/`studio`) are configured separately in
`packages/db/prisma.config.ts` (DATABASE_URL / schema-owner role only; loads
the gitignored `prisma/.env` itself, since Prisma 7 stopped auto-loading
`.env`). This split is CLI-vs-runtime only — it does not change RLS enforcement
(see Facility Isolation below).

**Key Exports (`packages/db/src/index.ts`):**
- `createPrismaClient()` — app-role client (`APP_DATABASE_URL ?? DATABASE_URL`), used by request-serving code; this is the role RLS policies actually restrict
- `createPrivilegedPrismaClient()` — schema-owner-role client (`DATABASE_URL` only, no fallback), for the handful of callers that need it (audit-log retention sweep, test-harness teardown of append-only ledgers)
- `createPrismaClientWithUrl(connectionString)` — for scripts that resolve their own connection string
- All three throw immediately if their URL is unset, rather than letting the underlying `pg.Pool` silently fall back to libpq `PG*` env vars
- `withFacility(db, facilityId, callback)` — wraps transaction + RLS context (unchanged by the Prisma 7 migration)
- RLS policy templates (shared across migrations)

**RLS Setup:**
```sql
CREATE POLICY "facility_isolation" ON table_name
  FOR SELECT USING (facilityId = current_setting('app.facility_id')::uuid)
```

Policies applied across P1–P4 (+ geofence 2026-08): AfterSaleCase, AppUser, Attendance, ClassBatch, ClassBatchCodeCounter, ClassSession, CompensationPolicy, Contact, Course, Enrollment, FacilityGeofence, FacilityNetwork, FinalGrade, Gift, KpiScore, ManualAttendanceTicket, Opportunity, Payslip, QualitativeAssessment, Receipt, ReconciliationFlag, RefundRecord, Reward, Room, SalaryRate, SalaryTier, ScheduleSlot, SessionEvidence, SessionEvidencePhoto, ShiftGroup, ShiftRegistration, ShiftRegistrationEntry, ShiftTemplate, StarTransaction, Student, Submission, TestAppointment, TimePunch.

**HR punch location (ADR 0043 + 0044):** `checkInOut.punch` admits a punch when
open-mode (0 active network and 0 active geofence), or IP matches an active
`FacilityNetwork` CIDR, or GPS is inside an active `FacilityGeofence` (distance
+ accuracy). Labels: `verification` ∈ {network, geo, open, none}. Prod
`TRUSTED_PROXY_CIDRS` must pin nginx static IP (see `docker-compose.prod.yml`);
`ipMatchesCidr` is IPv4-only.

---

### 4. Database (Postgres)
**Status:** P1–P4 schema complete; 42 migrations applied (P1 identity/enrollment through P4 after-sale, plus remediation fixes; measured 2026-08-08)

#### Core Entity Groups

**Sales Pipeline (WF-P1-01):**
- `Contact` — prospect details (name, phone, email)  
- `Opportunity` — lead to O5_ENROLLED (RLS by facilityId)  
- Lifecycle: O1_LEAD → O2_CONTACTED → O3_TEST_SCHEDULED → O4_TESTED → O5_ENROLLED  

**Money Gate (WF-P1-02, WF-P1-03, WF-P1-08):**
- `Receipt` — payment record (draft → approved → cancelled, RLS)  
- `RefundRecord` — append-only ledger (UPDATE/DELETE forbidden)  
- `ReceiptCodeCounter` — global atomic counter (shared across facilities)  
- Invariants: receipt.code globally unique; sum(refunds) ≤ receipt.netAmount  

**Identity & Enrollment (WF-P1-04, WF-P1-05, WF-P1-06, WF-P1-07):**
- `Student` — child identity (lifecycle: active/blocked_lms/withdrawn, RLS)  
- `StudentAccount` — LMS login (created by provisioning)  
- `ParentAccount` — guardian phone identity  
- `Guardian` — parent→child link (approved or pending, created by provisioning)  
- `GuardianLinkRequest` — parent approval workflow  
- `Enrollment` — student→class seat (status: reserved/active/withdrawn, RLS)  

**Compliance:**
- `AuditLog` — immutable action log (append-only via REVOKE, not RLS)  

**Support:**
- `AppUser` — staff/admin identity (no RLS, facility context via session)  
- `Facility` — tenant boundary  
- `EmailOutbox` — queued emails (status: pending/sending/sent/failed)  
- Enums: `OpportunityStage`, `StudentLifecycle`  

---

### 5. Workers (Async Jobs)

#### Reconcile Orphaned Receipts
**File:** `apps/api/src/worker/reconcile-orphaned-receipts.ts`

**Purpose:** Recover from mid-provision crashes (K2 partial mitigation).

**Trigger:** Manual run (scheduled executor not yet built)

**Logic:**
1. Find receipts with `status='approved'` but missing Guardian/StudentAccount/active Enrollment  
2. For each: rerun `provisionFromReceipt` (idempotent)  
3. Log recovery in AuditLog

**Tests:** 5 test cases (crash scenarios, fully-provisioned no-touch, renewal no-touch)

---

#### Email Relay
**File:** `apps/api/src/worker/relay-email-outbox.ts`

**Purpose:** Deliver queued emails from EmailOutbox.

**Status:** Relay logic + real transports implemented (BrevoEmailTransport, GraphEmailTransport); wiring required at boot via BREVO_API_KEY/GRAPH_* env vars.

**Concurrency Safety (R3 remediation):**
- Each worker replica claims rows via `updateMany({ where: { id, status: { in: ['pending','failed'] } }, data: { status: 'sending' } })`  
- Only claimer (count=1) proceeds to send  
- Prevents double-send in distributed setup

**OTP payload hygiene (M1 P4):**
- `sweepStaleOtpPayloads` scrubs plaintext OTP codes from rows past their login TTL, regardless of status — whole-object JSON equality against `SCRUBBED_OTP_PAYLOAD` (not a path-scoped check, which NULL-traps on rows missing the `scrubbed` key)
- `pruneTerminalOutbox` deletes `sent`/`dead` rows older than `EMAIL_OUTBOX_RETENTION_DAYS` (default 30d)
- `EmailOutbox` has `@@index([status, createdAt])` covering the drain query

**Tests:** unit + integration suite in `relay-email-outbox.test.ts` (concurrent drain, idempotency, failed email retry, retry limit, OTP scrub/sweep, terminal-row prune)

---

## Provisioning Workflow (WF-P1-03)

The core of P1 — transforms approved Receipt → active Enrollment.

**Entry Point:** `finance.receiptApprove(receiptId)`

**Atomic Steps (all-or-nothing within transaction):**

1. **Claim Receipt**  
   - Verify `status='draft'`  
   - Set `status='approved'` + `approvedAt=now()`  
   - Atomic with receipt ID (preventing re-approval race)  

2. **Resolve Student**  
   - If `receipt.studentId` (renewal): reuse existing  
   - Else: create new Student (inline, unique per receipt)  

3. **Create StudentAccount** (K1 remediation)  
   - Phone from ParentAccount or request body  
   - One per student (unique constraint)  

4. **Create Guardian** (K1 remediation — **was missing**)  
   - Link `StudentAccount` to `ParentAccount`  
   - Approve linking  

5. **Create/Activate Enrollment**  
   - Set `status='active'`  
   - Unlock `enrollment.mine` read for parent  

6. **Enqueue Email** (R5 remediation)  
   - Outside try/catch (failure doesn't block enrollment)  
   - Records `email.enqueue_failed` if it throws (not `provisioning.retry_pending`)  

**Idempotency:**
- All creates check existence first  
- Replaying on same receipt is safe (Guardian already exists, Enrollment already active)  
- Used by reconciler for recovery

**Tests:**
- 3 test files dedicated to provisioning (guardian, idempotency, renewal)  
- 20+ scenarios covering new student, renewal, failure paths

---

## Security Controls

### Authentication (Dev Stub)
**Status:** Fail-closed, no token processing in P1.

**Mechanism:** `context.ts` checks for authorization header presence, accepts any UUID in dev mode.

**Upgrade Path:** Real OAuth2/SSO integration in P2+ (TL04 deferred).

### Authorization (RBAC Registry)
**Mechanism:** `requirePermission(domain, action)` checks `@cmc/auth` registry before procedure logic.

**Registry Entry Example:**
```typescript
// PERMISSIONS: Record<'module.action', readonly ActiveRole[]>
'crm.opportunityCreate': ['giam_doc_kinh_doanh', 'sale'],
```

> ⚠️ **Đính chính 2026-07-23.** Ví dụ cũ ghi sai cả hình dạng lẫn nội dung: registry là **map key → mảng vai**, không phải mảng object; và `super_admin` **cố ý KHÔNG có mặt trong bất kỳ dòng nào** — nó bypass toàn bộ registry trong `can()` (`packages/auth/src/index.ts`). Vì vậy mọi phép đo phân quyền dùng `super_admin` đều **vô nghĩa**: nó luôn xanh.

**Đọc tách khỏi ghi (2026-07-22).** Ba key thêm trong đợt gỡ lỗi chặn luồng, theo nguyên tắc quyền đọc không kéo theo quyền ghi:

| Key | Vai | Vì sao tách |
|---|---|---|
| `class.read` | GĐKD, GĐĐT, sale, GV | Trước đó đọc danh sách lớp gate bằng `class.create` (chỉ GĐĐT) ⇒ **không vai nghiệp vụ nào thu nổi học phí** vì không chọn được lớp |
| `classRoster.read` | GV, GĐĐT | `classBatch.listStudents` trả **họ tên trẻ em** — hẹp hơn `class.read` có chủ đích, chặn ở tầng API chứ không dựa vào gate trình duyệt |
| `staff.pickList` | GĐKD, GĐĐT | Dropdown nhân sự (chốt lương, bậc lương, gán GV). **Key riêng** để quản trị lớp không bao giờ phụ thuộc quyền lắp bảng lương |

**Single Source:** `packages/auth/src/index.ts` (documented in docs/TL14)

### Facility Isolation (RLS)
**Mechanism:** Database-level row filtering via Postgres RLS policies.

**Pattern:**
```sql
CREATE POLICY "facility_isolation" ON Opportunity
FOR SELECT USING (facilityId = current_setting('app.facility_id')::uuid)
```

**Enforcement Layers:**
1. tRPC middleware sets RLS context (UUID only, never client input)  
2. Prisma injects session variable before query  
3. Postgres enforces policy at row level

**Impact:** Out-of-facility record IDs are invisible (not "403 forbidden" — they're "not found").

**Prisma 7 note (2026-08-08):** the connection Prisma opens for layer 2 now goes
through the `@prisma/adapter-pg` driver adapter (`packages/db/src/index.ts`)
instead of Prisma's built-in `datasources` override — this is a connection-
plumbing change only. The app-role selection (`APP_DATABASE_URL` → `cmc_app`,
never the schema-owner role) and the `withFacility()` `SET LOCAL`/
`set_config(..., true)` per-transaction GUC pattern that RLS depends on are
unchanged; see `docs/decisions/0042-rls-defense-in-depth.md` for the addendum.

### Data Integrity (Append-Only Ledgers)
**Mechanism:** Postgres REVOKE on UPDATE/DELETE for sensitive tables.

**Applied to:**
- `RefundRecord` — immutable refund history (UPDATE/DELETE REVOKED)
- `AuditLog` — immutable compliance log (UPDATE/DELETE REVOKED, separate retention-sweep with privileged connection)

**Migration:** `20260706150000_p1_remediation_wavea_privilege_hardening`

### URL addressing & deep links

Machine-readable builders live in `@cmc/links` (`packages/links`). Product rules:

- **Shareable state is in the URL.** Params answer “what am I looking at?” (entity id, class/session, payroll period/user). Draft text, modal open state, and uploads stay in component state.
- **Entity detail** uses path `:id` builders (`links.opportunity`, `receipt`, `student`, `classBatch`) plus canonical `/go/:entity/:id` (`goPath` / `resolveGo`). Ids must be UUIDs; unknown entity or non-UUID → EmptyState, never open-redirect.
- **Workspaces** use query params + builders (`attendancePath`, `gradingPath` `?submissionId=`, `payrollPath` `?userId=&period=`, `sessionEvidencePath`) — not `/go/`. Schedule already had URL view state independently.
- **returnTo:** unauthenticated deep links capture via `RequireAuth` → `/login?returnTo=…`. Only `safeReturnTo` / `shouldCaptureReturnTo` (`apps/admin/src/lib/safe-return-to.ts`) may accept or restore destinations.
- **Garbage params:** non-UUID id query values are treated as unset (`readUuidParam`); never passed into tRPC inputs.
- **Sensitive identity in URL (HR):** payroll may carry `userId` (AppUser UUID) for shareable payslip deep links. Serving layer must send `Referrer-Policy: same-origin` (`infra/nginx/nginx.conf`, `nginx.local-sim.conf`). Prefer not to add more PII than a UUID to query params. Logs/proxies will see these URLs.
- **Audit note:** `/go/*` is a `needsParam` route and sits outside `screen-role-capture`; real RBAC UI gate is `PermissionGate` on the destination detail route.
- **Known limit:** `mustChangePassword` remains a client hint (see staff login); server-side enforcement is tracked separately (GitHub #58).

---

## Error Handling

**tRPC Error Types:**
- `badRequest` (400) — input validation, business rule violation  
- `forbidden` (403) — permission denied  
- `notFound` (404) — record not found (also masks RLS filters)  
- `conflict` (409) — uniqueness/state machine violation

**Pattern:**
```typescript
if (!opportunity) throw notFound('Opportunity not found.');
if (!canApprove) throw forbidden('Insufficient role for approval.');
```

**Testing:** Dedicated negative test files (`rls-negative.test.ts`, `security/` suite)

---

## Testing Strategy

**Pyramid (TL29):**
- **Unit (20%):** Domain logic, receipt code generation, phone normalization  
- **Integration (60%):** Procedure logic, multi-step workflows (receipt→enrollment), RLS enforcement  
- **End-to-End (20%):** Full user journeys (lead→receipt→active enrollment, cancellation, refund)

**Coverage Thresholds:**
- Statements: ≥90%  
- Branches: ≥80%  
- Special: finance ≥90/80, provisioning ≥90/75

**CI Integration (as-built 2026-08-12; UI drift gates re-confirmed 2026-08-13):** **Required checks that block merge** on `develop` and `main` (branch protection): **`typecheck-and-test`** (typecheck → lint → **UI drift gates** → unit/integration RLS → payroll gate coverage) **and `ui-e2e`**. The UI drift gates inside `typecheck-and-test` are `check:ui-frames` (`--strict`), `check:ui-ratchet` (inline-style baseline, counts `background`/`backgroundColor`), `check:ui-a11y-roles` (revived to blocking 2026-08-13), and `check:doc-authority` (retired-chrome allowlist) — each blocking, none `continue-on-error`. Both required jobs have blocked since **2026-08-02**. Other jobs (`e2e` API, `acceptance:report` tool exit, screen×role drift) may still warn without blocking — see `.github/workflows/` and `AGENTS.md`.

**Test Organization:**
- `*.test.ts` colocated with source  
- `test/db.ts` — shared test database setup  
- `vitest.config.ts` — isolated test environment per test file

---

## Deferred Components (P2+)

| Component | Status | Impact | Target |
|-----------|--------|--------|--------|
| **Real OAuth2/SSO** | Stub (fail-closed) | Auth only; no tenant isolation risk | P2+ |
| **Email/SMS Transport** | ConsoleTransport (dev); Brevo/Graph impl ready | Parents don't receive emails until env wired | Comms phase |
| **LMS Frontend** | **Shipped** (`apps/lms` SPA: parent OTP + student password, exercises, gifts, parent evidence/report) | Not a greenfield; residual: unit-range UX, Brevo OTP ops. Homework open = `SessionExercise` + `onRoster` (PR #118; **không** còn cờ `LMS_*`). Sister repo `cmc-lms` **đóng băng** 2026-08-12 tại `031d193` — chỉ sửa lỗi, không thêm tính năng | Teaching tiếp ở monorepo; port từ mốc đóng băng `cmc-lms` |
| **Admin Dashboard** | Facility management built (PR #34) | Super-admin CRUD + audit log viewer live | Complete (M0) |
| **MCP Server SDK** | Skeleton (stub comment) | Protocol/tool metadata; real transport TBD | Agent phase (TBD) |
| **LLM Client** | Built & tested (packages/llm) | OpenAI-compatible client + PII guard | Complete (M0) |
| **Student Lookup API** | Stub (K4) | Parents can't query which child by UUID | P2 |
| **Class Provisioning** | Scalars only | classBatchId not validated (P2 backfill) | P2 |

---

## Deployment Model (Inferred)

**Type:** Facility-scoped multi-tenant SaaS

**Tenant Isolation:**
- Facility boundary enforced at:
  - RBAC (role membership scoped to facility)  
  - RLS (database row filtering)  
  - Session context (facility_id injected, never trusted from client)

**Scaling:**
- Postgres replication (standard RDS multi-AZ recommended)  
- tRPC server stateless (can horizontally scale)  
- Worker instances independent (reconcile + relay can run in parallel)

**Backup/Disaster Recovery:**
- PostgreSQL PITR (point-in-time recovery)  
- Append-only ledgers (RefundRecord, AuditLog) enable audit trail reconstruction  
- Migration history allows schema replay

---

## CI & Security (as of 2026-08-12)

**Continuous Integration:**
- **Required (block merge) on develop + main:** `typecheck-and-test` **and** `ui-e2e` (both enforced since 2026-08-02 branch protection; re-confirmed 2026-08-12)
- **UI e2e:** full `ui-chromium` project + business money/state gate; journey ledger feeds acceptance photos
  - Acceptance counts in docs are **snapshots** — re-measure with `pnpm acceptance:report` + CI artifact (e.g. post P1 wave photo **36/42** proven)
- **Security Scanning:**
  - **GitHub native:** Secret scanning + push protection enabled; `.gitleaks.toml` configured (0 real secrets, 2 test-fixture false-positives allowlisted)
  - **Dependabot:** `.github/dependabot.yml` configured (auto-pull minor/patch; manual review for majors)
  - **Trivy (IaC):** Report-only config/misconfig scan over Dockerfile/compose/nginx (`.github/workflows/ci.yml` security-scan job); continue-on-error, not blocking
  - **CodeQL:** GitHub default setup enabled (javascript-typescript + actions) — first scan 2026-08-02: 20 alerts triaged (6 HIGH false-positive/by-design, 4 MEDIUM workflow-permission real, 10 LOW)
- **Pre-commit:** Husky + lint-staged; eslint scoped via eslint.config.js (one-door @cmc/ui rule)
- **Branch Protection:** develop **and** main require `typecheck-and-test` + `ui-e2e`
- **Dependency Hardening:**
  - pnpm overrides patch fast-uri + brace-expansion HIGH advisories (no direct upgrade path)
  - GitHub Actions SHA-pinned in ci.yml (no @v4 refs; explicit commit SHAs)
  - Toolchain majors: vite 6→8, @vitejs/plugin-react 4→6, vitest 2→4 (PR #47; zero config changes)

---

## Known Limitations & Workarounds

| Issue | Mitigation | Planned Fix |
|-------|----------|-------------|
| **Email relay untested in prod** (transport stub) | Manual verification; no auto-send in P1 | Wire Brevo/Graph in comms phase |
| **Facility creation blocked (R2)** | Dev seed only; super_admin bootstrap gate exists | Admin CRUD endpoint in admin phase |
| **Student lookup missing (K4)** | Enrollment shows child by studentId; full search deferred | P2 API + UI |
| **No retry scheduler** (K2) | Manual `reconcile-orphaned-receipts` trigger | Background job queue in ops phase |
| **No real auth** | Dev stub accepts any header; RLS enforces tenant | Real OAuth2 in P2+ |
| **classBatchId not validated** | Scalars accepted; FK created in P2 | P2 data backfill + constraint |
| **SSO (Entra) disabled** (M365 access lost) | Email/password staff login active 2026-07-26+; code preserved under env flag `SSO_ENABLED` | Restore M365 access; known issue: SSO reactivation needs RLS bypass at sso-routes.ts:220 |
| **CodeQL workflow-permission gaps** (4 MEDIUM findings) | Not security-critical; being addressed separately | add explicit permissions block to .github/workflows |

---

## Code Organization Principles

**Cohesion:** Code grouped by domain (crm/, finance/, enrollment/), not layer.

**SOLID:**
- **S:** Each router owns one domain; `with Facility` isolates transactions  
- **O:** Domain packages (`@cmc/domain-*`) extend without modifying core  
- **L:** Procedures implement tRPC contract; easy to mock/replace  
- **I:** Shared `requirePermission` middleware; depends only on registry  
- **D:** RBAC registry injected; easier to test with mock registry  

**File Naming:** kebab-case TS files; routers, helpers, tests colocated per domain

**Test Cohabitation:** `foo.test.ts` next to `foo.ts` enables rapid feedback

---

## Development Workflow

**Local Setup:**
```bash
pnpm install                           # install workspace
pnpm --filter @cmc/db prisma generate # Prisma types
pnpm --filter @cmc/db prisma db seed  # seed local Postgres
pnpm dev                               # start tRPC server + watch
```

**Build & Verify:**
```bash
pnpm typecheck                         # TypeScript validation
pnpm test                              # vitest (all domains)
pnpm build                             # Turbo build (all packages)
```

**Database Migrations:**
```bash
pnpm --filter @cmc/db prisma migrate dev --name <description>
pnpm --filter @cmc/db prisma migrate deploy  # in CI/deploy
```

---

## tRPC Client-Server Bug (Fixed, PR #27)

**Issue:** `apps/api/src/server.ts` standalone tRPC handler (`createHTTPHandler`) lacked `basePath` option. Browser clients (apps/admin, apps/lms) build URLs as `${API_URL}/trpc/{procedure}`, but without `basePath`, the server treated the entire path including "trpc/" as the procedure name → 404 on all requests.

**Impact:** Undetected until Phase 2 e2e testing (no browser-based e2e existed before 2026-07-10). Reproduced against running local prod-simulation Docker stack — live bug blocking browser client communication.

**Fix:** PR #27 (not yet merged):
- Added `basePath: '/trpc/'` to `createHTTPHandler` in `apps/api/src/server.ts`  
- Explicit rewrite of bare `/health` → `/trpc/health` (used by Docker healthcheck + e2e health-wait; predates prefix convention)

**Workaround in Phase 2:** Vite dev/preview proxy in apps/admin and apps/lms (proxies /trpc to api server same-origin) masked the bug during local development until real e2e testing exposed it.

---

## Alignment with Design Corpus (TL00-TL31)

This implementation strictly follows the frozen design:

| Design Doc | Aspect | Implemented As |
|------------|--------|-----------------|
| TL01 | Invariants I1–I11 | Database schema + constraint tests |
| TL10 | Data model ERD | `schema.prisma` + Prisma migrations |
| TL11 | API contract | tRPC routers + error types |
| TL14 | RBAC registry | `@cmc/auth` package |
| TL16 | ADR A–D | Procedure implementations + tests |
| TL24 | P1 workflows | 7 routers (CRM, Finance, Enrollment, Guardian, LMS, Student, Facility) |
| TL25 | Traceability | Test coverage matrix aligns with workflow specs |

**Design as Authority:** Changes to procedures must first update design docs (TL24, TL11).

---

## Phase 3 Flow Audit Results (2026-07-08)

**Verdict:** REDEPLOY NOT REQUIRED — 0 bare-unprotected mutations found.

| Metric | Result |
|--------|--------|
| WF traced | 28/28 (22 FULL · 6 PARTIAL UI gap) |
| Findings | 0 CRITICAL · 3 HIGH · 13 MEDIUM |
| e2e spec coverage | 6/28 exist (22 aspirational — Phase 4 obligation) |
| ADR-B second-eye | Confirmed: only `giam_doc_dao_tao` + `super_admin` satisfy gate |

**HIGH findings (non-blocking, addressed in UAT):**
- HIGH-1: cskh had no UAT scenarios → added to KB1+KB4
- HIGH-2: ctv_mkt `manualPunch.create` suspicious — added to KB4; user must decide if remove.
  **Resolved 2026-07-13 (ADR 0043):** `manualPunch.create` key deleted entirely (tickets now only
  auto-generate from `checkInOut.punch`) — the permission this finding flagged no longer exists.
- HIGH-3: hr had no UAT scenarios → added to KB4+KB5

## Phase 4 Pre-conditions

- [x] **lms-auth-two-tier** — 0-assertion stub suite deleted 2026-07-10; coverage moved to e2e (satisfied)
- [ ] Phase 2 (docker stack) must complete: WSL2, R2 S3 keypair, Entra seed email
- [x] ctv_mkt `manualPunch.create` decision — moot, key deleted by ADR 0043 (2026-07-13)
- [ ] REDEPLOY NOT REQUIRED confirmed — no rebuild needed before Phase 4 Run 1

## Next Session Priorities

1. **Phase 2** — complete docker stack setup (WSL2 confirmed, R2 keypair, Entra email)
2. **Phase 4 Run 1** — UAT with real users against 5 kịch bản chuỗi liên vai (Section 2)
3. ~~un-skip lms-auth-two-tier~~ — satisfied 2026-07-10 (suite deleted, coverage moved to e2e)
4. ~~ctv_mkt manualPunch.create~~ — moot, key deleted by ADR 0043 (2026-07-13)

## Resource-depth rollout status (2026-08-19)

- `RecordEvent` is the facility-scoped, append-only user-facing operational timeline; `AuditLog` remains the global compliance ledger and is not a director timeline.
- Merged resource-depth module series: Class (#159), Student (#161), ParentAccount (#162), Receipt (#163), and ParentMeeting (#164). Each merged PR passed the required `typecheck-and-test` and `ui-e2e` checks on its final head.
- Canonical staff surface remains `/hr/staff`; `/admin/users` is a compatibility redirect. Parent, Receipt and ParentMeeting detail URLs are path-based and their activity sections are shareable.
- Remaining gap-only detail exceptions are recorded in `plans/reports/phase-06-module-6-gap-only-audit.md`; Phase 7 source-derived coverage and URL/history gates remain open.

---

**Last Updated:** 2026-08-19 (Phase 6 resource-depth rollout sync; runtime acceptance remains CI-artifact-owned)
**Aligns with:** main branch after PR #164; Phase 7 coverage gate remains open
