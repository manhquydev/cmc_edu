# CMC EDU v2 — Project Changelog

**Scope:** P1 Identity & Enrollment backend build, security hardening, and remediation  
**Period:** 2026-07-05 to ongoing  
**Status:** Active

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

**Context:** Routine build-status scout (`pnpm build`/`typecheck`/`test`/`lint`) on `main` @ `b81710a`,
requested to verify project state before UAT/Go-No-Go.

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

## [2026-07-07] G0 — Xanh hoá main: test drift fixes + phase-01b alignment (PR #12)

**Test drift: giao_vien student.lookup (K4)**
- `packages/auth/src/index.ts:71-75` intentionally added `giao_vien` to `student.lookup` roster (attendance name resolution, RLS + facilityId predicate). Unit tests (`@cmc/auth`) and API integration tests (`student/lookup.test.ts`) were still asserting the old FORBIDDEN state.
- Fix: updated to assert allowed; added `cskh` deny guard to preserve K4 scope.
- Files: `packages/auth/src/index.test.ts`, `apps/api/src/student/lookup.test.ts`

**Test drift: kind:'student' two-tier auth (phase-01b)**
- Migration `20260707120000_phase01b_lms_auth_two_tier` added `kind` field to LMS sessions; `requireLmsStudent` now checks `kind !== 'student'` → FORBIDDEN before checking `!studentId` → BAD_REQUEST. All student-facing test callers used the default `kind:'parent'`, causing FORBIDDEN where tests expected success.
- Fix: added `kind:'student'` to all `studentCaller` helpers and inline `buildLmsContext` calls; 'no selected student' negative tests now use `kind:'student'` + no `studentId`.
- Files: `apps/api/src/exercise/open-tier.test.ts`, `rewards/redeem-refund.test.ts`, `submission/grade.test.ts`, `submission/annotate-submit.test.ts`, `submission/teacher-annotation.test.ts`

**domain-time: passWithNoTests**
- Package has no test files; `vitest run` exits 1 on no-match by default. Added `--passWithNoTests` (standard flag; does not suppress failing tests).
- File: `packages/domain-time/package.json`

**Result:** 402/402 tests green (net +1 from lookup test split); typecheck 26/26; build 14/14.

---

## [2026-07-07] Code-review bug fixes (retroactive harness pass, wave 2)

**PDF viewer always returning 400 in grading screen**
- Root cause: `listForGrading` returned only `exerciseId`; `handleExercisePdfGet` requires a `blobRef` starting with `exercise-pdf/` — a bare UUID never passes the check.
- Fix: added `include: { exercise: { select: { basePdfRef: true } } }` to `listForGrading`; grading.tsx now builds PDF URL from `item.basePdfRef` when non-null, else shows a "no PDF" message.
- Files: `apps/api/src/submission/router.ts`, `apps/admin/src/pages/teaching/grading.tsx`

**Fractional grading scores rejected by Zod schema**
- Root cause: `score: z.number().int()` rejected step-0.5 inputs the UI allows.
- Fix: removed `.int()` — `z.number().nonnegative()` accepts fractional scores.
- File: `apps/api/src/submission/router.ts`

**`requireLmsParent` extracted as shared guard function**
- Three procedures had inline kind-check duplicates: `setPhotoConsent`, `enrollment.mine`, `lmsAuth.resetChildPassword`.
- Fix: added `requireLmsParent(ctx): { parentAccountId }` to `trpc.ts` (symmetric with `requireLmsStudent`), replaced all three inline checks.
- Files: `apps/api/src/trpc.ts`, `apps/api/src/session-evidence/router.ts`, `apps/api/src/enrollment/router.ts`, `apps/api/src/lms-auth/router.ts`

**Timing oracle — network round-trip (no-parent branch)**
- Root cause: PBKDF2 equalization fixed CPU time but the no-parent branch issued 1 DB query vs 2 in the no-student branch — leaking phone/email existence via latency.
- Fix: added `await ctx.db.$executeRaw\`SELECT 1\`` in the no-parent branch to match query count.
- File: `apps/api/src/lms-auth/router.ts`

**`credentials` option invalid on tRPC v11 `httpBatchLink`**
- Root cause: tRPC v11 removed `credentials` as a top-level option; passing it caused TS2353.
- Fix: use custom fetch wrapper `fetch(url, { ...options, credentials: 'include' })`.
- File: `apps/admin/src/lib/trpc.ts`

---

## [2026-07-07] Security bug fixes (retroactive harness pass)

**HIGH-2: `enqueueReceiptEmail` was writing phone number as email `to` field**
- Root cause: function signature used `parentPhone: string` but `ReceiptRow` carries `parentEmail: string | null`.
- Fix: renamed param to `parentEmail: string | null`, added null-guard early-return (no outbox row when email absent).
- Files: `apps/api/src/finance/router.ts`, `approve.test.ts`, `enqueue-receipt-email-best-effort.test.ts`

**MEDIUM-1: `loginStudent` timing oracle — phone enumeration via latency**
- Root cause: `studentAccounts.length === 0` branch returned immediately without PBKDF2, making it ~70ms faster than wrong-password branch — phone existence leakable via timing.
- Fix: added `verifyPassword(input.password, DUMMY_PASSWORD_HASH)` equalization call before the throw.
- File: `apps/api/src/lms-auth/router.ts`

**Phase-06 gap: `parentAccount.updateEmail` UI was missing**
- Backend procedure existed; no UI called it.
- Fix: added "Cập nhật email" modal to parents page (approved tab, gated by `canDo('parentAccount','updateEmail')`).
- File: `apps/admin/src/pages/parents/index.tsx`

**Revenue report M1/M2: truncation warning + decorative FilterBar removed**
- M1: added yellow alert when `data.total > items.length` (PAGE_SIZE=100 hardcoded).
- M2: removed `RANGE_FILTER` constant and `FilterBar` import — range filter was decorative, query param never used in API call.
- File: `apps/admin/src/pages/finance/revenue-report.tsx`

**Receipt create M3: opportunityId UUID validation**
- Raw `?opportunityId=` query param now validated against UUID regex before use; malformed param silently dropped (server rejects anyway, but prevents arbitrary string in UI alert).
- File: `apps/admin/src/pages/finance/receipt-create.tsx`

---

## [2026-07-07] Phase summary index (Phases 01a–07)

### Phase 01a — Backend deltas
- SO receipt code format (`SO00001`), `canApprove` field on `ReceiptDto` (self-approval guard + over-threshold second-eye), `session.me` nav-gating endpoint.
- Teacher annotation column (`teacherAnnotationLayer`) on Submission; `submission.saveTeacherAnnotation` procedure.

### Phase 01b — LMS auth 2-tier
- Email-OTP login (`requestOtpEmail` / `verifyOtpEmail`) alongside existing phone-OTP; student direct password login (`loginStudent`, PBKDF2, `mustChangePassword` flag).
- Kind discriminator (`kind: 'parent' | 'student'`) in session tokens; `lmsAuth.resetChildPassword` parent-only gate; 15-minute lockout after 5 failed login attempts.

### Phase 02 — UI foundation
- Mantine v7 design system integrated; tRPC React client wired to API; 10 `@cmc/ui` components (Button, Input, Modal, Table, Badge, etc.).
- App shell (sidebar nav + auth guard), staff login screen, facility switcher.

### Phase 03 — Sales screens
- Receipt create/approve screens with `canApprove` hint and over-threshold warning dialog.
- CRM kanban board (O1→O5 drag-and-drop); over-threshold gate surfaced as a blocking modal before approve.

### Phase 04 — Teaching screens
- Class schedule view, session lifecycle controls (confirm/cancel/makeup).
- Attendance marking UI (present/absent/late per student), grading screen with PDF annotation viewer, report-card PDF export.
- Teacher cockpit: today's sessions, pending grading queue.

### Phase 05 — Ops / HR
- IP-based clock-in/out (`checkInOut`), shift registration and approval workflow, revenue reconciliation worker and flag-review UI.
- Payroll: compensation rates, payslip generation (gross → net), KPI score submit/confirm/approve/override pipeline.

### Phase 06 — Generic admin coverage
- 15 admin routes across user, room, course, facility CRUD; `parentAccount.updateEmail` backfill for LMS email-OTP login.
- Super-admin facility management screen.

### Phase 07 — LMS app (parent + student portal)
- Parent login (phone-OTP + email-OTP), profile picker, enrollment list, session-evidence feed with photo-consent toggle.
- Student login (password + `mustChangePassword` redirect), PDF exercise viewer, submission draft/submit, star balance + gift redemption flow.
- Consent settings screen; push-notification consent stub.

---

## [2026-07-06] P1 Backend Complete & Merged

### Commits

**Merge:** `32147df` — Merge PR #1 (feat/p1-identity-enrollment → main)  
**Branch:** `feat/p1-identity-enrollment` (5 commits, 4 remediation waves)

### What Shipped

**P1 Workflow Coverage (WF-P1-01 through WF-P1-07):**
- ✅ CRM pipeline (lead → O1..O5 opportunity stages)  
- ✅ Money gate (draft receipt → approved, idempotent provisioning, atomic claim)  
- ✅ Identity provisioning (student + guardian account creation)  
- ✅ Enrollment lifecycle (reserved → active, blockLms action)  
- ✅ Guardian linking (request + approval)  
- ✅ LMS auth (OTP login, enrollment list read)  

**Core Routers (7 total):**
- `crm` — 5 procedures (opportunityCreate, opportunityAdvance, opportunityMarkLost, opportunityLookup, opportunityList)  
- `finance` — 5 procedures (receiptCreate, receiptApprove, receiptCancel, refundCreate, receiptList)  
- `enrollment` — 3 procedures (enroll, blockLms, mine)  
- `guardian` — 4 procedures (requestLink, approveLink, pendingLinks, getApprovedChildren)  
- `lmsAuth` — 2 procedures (requestOtp, verifyOtp)  
- `student` — 1 stub (lookup)  
- `facility` — 1 procedure (create)

**Data Model:**
- 13 core tables + 4 support tables (Prisma schema `schema.prisma`)  
- 5 migrations applied (initial + 4 remediation waves)  
- RLS policies on 6 tables (Opportunity, Student, Enrollment, Receipt, RefundRecord, AuditLog)  
- Append-only enforcement on ledger tables (RefundRecord, AuditLog)

**Domain Packages:**
- `@cmc/auth` — RBAC registry (7 roles, 20+ permission mappings)  
- `@cmc/domain-finance` — receipt code, refund cap, phone dedup  
- `@cmc/domain-identity` — phone normalization  
- `@cmc/db` — Prisma client + RLS helpers

**Test Coverage:**
- 137 tests across 24 test files  
- 95%+ statement coverage  
- 80%+ branch coverage (critical paths higher)  
- All test suites green

**Worker Infrastructure:**
- Reconcile orphaned receipts (mid-provision crash recovery)  
- Email relay (concurrent-safe claiming, delivery stub)

---

## [2026-07-06] Deep Review + Remediation Waves

### Session Context
4 code-review agents + 1 orchestrator identified **12 critical/high/medium findings**, then executed **5 targeted remediation waves** (A–C + deep review finalization). All fixes merged into single PR #1.

### Critical Findings (K1, K2, K3, K5) — Fixed

**K1: Guardian not created by provisioning**  
- **Impact:** Parents who paid had zero enrollment visibility (hidden from `enrollment.mine`)  
- **Root Cause:** `provisionFromReceipt` created StudentAccount but never Guardian  
- **Fix (Wave 2):** Added Guardian creation post-StudentAccount  
- **Commit:** `df2cc77`  
- **Tests:** guardian-provisioning.test.ts (5 test cases)  

**K2: Money orphan on mid-provision crash**  
- **Status:** Partial (reconciler + idempotent design; scheduler deferred)  
- **Root Cause:** Receipt approved atomically; provisioning in separate try/catch; no retry mechanism  
- **Mitigation:** 
  - Reconcile worker detects missing Guardian/StudentAccount/Enrollment  
  - Reruns `provisionFromReceipt` (idempotent design ensures safety)  
  - No active scheduler yet (manual trigger or future background job)  
- **Trade-off:** Money is safe; enrollment recovery requires ops intervention  

**K3: No receiptList/pending-link queue**  
- **Impact:** Approvers couldn't find receipts to approve; guardians couldn't find pending requests  
- **Fix (Wave C):** 
  - Added `finance.receiptList(page?, pageSize?, status?)` — paginated, filterable  
  - Added `guardian.pendingLinks()` — guardian requests awaiting approval  
- **Tests:** receipt-list.test.ts, pending-links.test.ts  

**K5: Ledger tables not append-only**  
- **Impact:** Audit trail mutable; possible finance fraud via UPDATE/DELETE  
- **Fix (Wave A):** 
  - Migration `20260706150000` — `REVOKE UPDATE, DELETE` on RefundRecord + AuditLog  
  - Enforced at Postgres ACL level (not just application logic)  
- **Tests:** append-only-privilege.test.ts  

### High Findings (R1–R5) — Fixed or Documented

**R1: Orphan detection query too narrow**  
- **Fix (Wave C):** Broadened CTE in reconciler to check Guardian/StudentAccount/Enrollment existence per resolved studentId  
- **Test:** reconcile-orphaned-receipts.test.ts "mid-provision failure" case  

**R2: Facility bootstrap deadlock**  
- **Fix (Wave A):** Added `super_admin` bypass in `requireValidFacility` (before existence lookup)  
- **Assumption:** Allows bootstrap of first facility without pre-existing Facility record  
- **Tests:** facility.test.ts (bootstrap + non-super_admin rejection)  

**R3: Email relay double-send race**  
- **Fix (Wave C):** Atomic claim via `updateMany` with new `sending` status  
- **Test:** relay-email-outbox.test.ts "concurrent drains" case  

**R5: Email enqueue mislabels provisioning failure**  
- **Fix (Wave 2):** Extracted `enqueueReceiptEmailBestEffort`; moved outside provisioning try/catch  
- **Tests:** enqueue-receipt-email-best-effort.test.ts  

**R4: Unbounded failed-audit spam**  
- **Status:** Documented, left unfixed (task scope: OPTIONAL)  
- **Note:** Receipts missing `classBatchId` fail every reconcile cycle; noted in code comments

---

## [2026-07-06] Verification & Gating

**Final Build State:**
```bash
✅ pnpm typecheck           — 12/12 tasks successful
✅ pnpm test                — 137/137 tests pass
✅ pnpm build               — 7/7 tasks successful
✅ prisma migrate deploy    — all 5 migrations applied
✅ Git status               — clean (no uncommitted changes)
```

**Coverage thresholds (per domain):**
- **finance:** 97.88% statements / 89.36% branches (gate: 90/80)  
- **provisioning:** 95.9% statements / 77.77% branches (gate: 90/75)  
- **All files:** 95.11% statements / 83.18% branches (gate: 90/80)

**Pre-merge Audits Passed:**
1. ✅ API contract audit (all 7 routers verified)  
2. ✅ Data model audit (schema matches ERD, RLS complete)  
3. ✅ Money/finance audit (receipt logic, refund cap, atomic claim)  
4. ✅ RBAC/RLS security audit (facility isolation, role registry)  
5. ✅ Data integrity audit (append-only, no orphan students)  
6. ✅ Flow continuity audit (full workflows end-to-end)  
7. ✅ Deep-review (orphan detection, integrity, flow completeness)

---

## [2026-07-06] Known Deferrals (Not Built in P1)

| Item | Category | Target | Reason |
|------|----------|--------|--------|
| **Student full lookup** (K4) | API | P2 | Parents lack child UUIDs; requires enrollment → name → UUID query |
| **Email transport** (K6) | Infra | Comms phase | Brevo/Graph not wired; relay logic ready |
| **Facility CRUD** (K7) | Admin | Admin phase | Only seed-based; super_admin bootstrap exists but no provisioning UI |
| **Real OAuth/SSO** | Auth | P2+ | Dev stub sufficient; full token processing deferred |
| **Class constraints** (K12) | P2+ | P2 backfill | FK scalars (`classBatchId`, `createdById`, `approvedById`) not enforced yet |
| **Withdrawal/cancel UI** | Frontend | Frontend phase | Backend ready; no UI yet |
| **P2-P4 workflows** | Features | Planned | Class ops, HR/payroll, redemption not started |
| **LMS frontend** | Frontend | Frontend phase | Parent/student portal not built |
| **Agent/MCP** | AI | TBD (TL04, TL13) | AI agent orchestration layer deferred |

---

## [2026-07-06] Debt Inventory

### Resolved This Session

✅ **K1** — Guardian creation missing (FIXED)  
✅ **K3** — No receiptList/pending-links (FIXED)  
✅ **K5** — Ledger not append-only (FIXED)  
✅ **R1** — Orphan detection too narrow (FIXED)  
✅ **R2** — Facility bootstrap deadlock (FIXED)  
✅ **R3** — Email double-send race (FIXED)  
✅ **R5** — Email enqueue false positive (FIXED)  

### Documented, Not Fixed (By Design)

⚠️ **K2** — Money orphan: partial mitigation (reconciler + idempotence; scheduler deferred)  
⚠️ **K4** — Student lookup: deferred to P2 (requires enrollment reverse-lookup)  
⚠️ **K6** — Email transport: deferred to comms phase (logic ready, transport stub)  
⚠️ **K7** — Facility creation: seed-only, CRUD deferred  
⚠️ **K8** — Block LMS missing writer → FIXED (enrollment.blockLms added)  
⚠️ **K9** — Cancel doesn't revoke LMS: deferred (enrollment.withdrawn logic ready)  
⚠️ **K10** — enrollment.enroll inert for new students → deferred (requires K4)  
⚠️ **K11** — opportunityList untested → FIXED (pagination + filter tests added)  
⚠️ **K12** — FK scalars unvalidated → deferred to P2 (accepted as scalars, backfill planned)  

### Low Priority

⚠️ **R4** — Unbounded failed-audit spam: documented, unfixed (optional scope)  

---

## [2026-07-05] Pre-Implementation State

### Initial Scaffolding (US-001, P0)
- ✅ Monorepo bootstrap (pnpm + Turbo)  
- ✅ tRPC + Prisma setup  
- ✅ Health check endpoint  
- ✅ Design tokens package (`@cmc/ui`)  
- ✅ RBAC registry foundation (`@cmc/auth`)  

### Design Corpus Frozen (TL00-TL31)
- 32 Vietnamese design documents completed  
- API contract defined (TL11)  
- Data model finalized (TL10)  
- Workflows specified (TL24, TL26-TL28)  
- Threat model complete (TL30)  

---

## [2026-07-06] Build Metrics Summary

| Metric | Value | Target |
|--------|-------|--------|
| **Tests Passing** | 137/137 | 100% |
| **Statement Coverage** | 95.11% | ≥90% |
| **Branch Coverage** | 83.18% | ≥80% |
| **Routers Implemented** | 7 | 7 (P1 scope) |
| **Procedures Total** | 25 | per TL11 spec |
| **Database Tables** | 17 (13 core + 4 support) | per TL10 |
| **Migrations Applied** | 5 | all P1 |
| **RLS Policies** | 6 tables | per TL01 security |
| **Critical Findings** | 12 found, 7 fixed in session | 0 remaining (K2 partial) |
| **Commits in Session** | 5 major (P1 scaffold → merge) | clean history |

---

## Version & Alignment

**CMC EDU Version:** v2.0.0-p1.1  
**Design Corpus:** TL00-TL31 (frozen; P1 implementation-complete)  
**Database:** Postgres 13+, Prisma 5.x  
**tRPC:** 11.x  
**Node.js:** ≥22 (ESM monorepo)

**Next Release:** P2 (class operations) — design complete, implementation to start

---

## References

- **Build Reports:** `plans/reports/` (24 session reports: audits, remediation, deep reviews)  
- **Design Docs:** `docs/` (TL00-TL31 + ADRs in `decisions/`)  
- **Code:** `apps/api/src/` (routers, provisioning, workers)  
- **Schema:** `packages/db/prisma/schema.prisma` + 5 migrations  
- **Tests:** 24 test files, 137 tests total  

---

**Compiled:** 2026-07-06 by docs-manager  
**Branch:** main (HEAD: 32147df)  
**Status:** P1 implementation complete, all gates passed, ready for P2 planning

## 2026-07-06 — P2-Foundation (class operations) merged to main (PR #2)
- Class-ops data model (Course/Room/ClassBatch/ScheduleSlot/ClassSession) behind RLS; class-code + atomic counter; auto-session generation (idempotent); room double-booking enforced on create AND regenerate; class-span capped.
- P1↔P2 seam closed: receipt/enrollment require a real same-facility ClassBatch (FK + validation).
- G1 merge-gate: 0 Critical/High; M1/M2 fixed, M3/L1/L2 backlogged (#10). 159 api tests pass.

## 2026-07-06 — T1: attendance + session lifecycle + e2e + CI (PR #3)
- attendance.mark/markAll/listBySession (5 gates, upsert+audit, RLS); classSession.cancel/confirm/addMakeup.
- apps/e2e Playwright API-driven skeleton (2 critical paths); GitHub Actions CI (typecheck+test on Postgres service).
- T1 gate: 0 Crit/High; M1+L2 backlogged (#11). 176 api tests + e2e 2/2.

## 2026-07-06 — T2-I: exercise foundation (PR #4)
- @cmc/storage blob seam (local-disk); global CurriculumUnit/Exercise (no-RLS QĐ0021/0022); classSession.assignUnit; exercise create/publish/close; raw-PDF upload route (auth+mime+10MB). 192 api tests + storage 7.

## 2026-07-07 — Phase-08: test-seam OTP + e2e security specs
- **Test-seam OTP**: `lmsAuth.requestOtp` / `requestOtpEmail` return `_testSeamCode` when `TEST_OTP_SEAM=1` AND `NODE_ENV !== 'production'`; runtime double-check is fail-closed (field never populated in production even if env var is accidentally set).
- **4 new e2e specs** (`lms-auth`, `finance-approval`, `kind-isolation`, `attendance-grading`): covers student login + lockout, `canApprove` gate, over-threshold second-eye (ke_toan blocked / GĐDT allowed), LMS kind discriminator (student↔parent), sibling scope fence, attendance mark + grading + star balance.
- **e2e/src/db.ts**: `seedPublishedExercise`, `seedSubmittedSubmission`, `cleanupExercises` helpers added; `cleanupFacility` extended to tear down `StarTransaction`/`FinalGrade`/`Submission` rows before enrollment/student deletes.

---

## 2026-07-07 — Domain decisions (5 product decisions applied to docs)

5 domain decisions confirmed and synced to docs (TL10/TL11/TL12/TL15/TL18/TL19/TL24):

1. **Receipt code SO**: Format đổi từ `PT-000001` sang `SO00183` (`packages/domain-finance/src/receipt-code.ts`).
2. **Auth 2-tier (đảo QĐ0033/WF-P1-07)**: PH login = email+OTP (BLOCKED-ON-COMMS); HS login = SĐT PH + password.
3. **StudentAccount.passwordHash + LmsSubject.kind**: Password fields trên `StudentAccount`; `kind` discriminator.
4. **Không có studentCode**: HS định danh bằng `fullName + SĐT PH`.
5. **Duyệt phiếu vượt ngưỡng = role-elevation**: >20,000,000 VND cần `giam_doc_dao_tao` hoặc `super_admin` (một người, không co-approval). `APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000`.

## 2026-07-07 — P3-I: AppUser, IP attendance, domain-time (US-020/021, PR #7)
- `AppUser` entity; IP-based attendance (TimePunch + FacilityNetwork); `@cmc/domain-time` package (time zone helpers, ICT bucket).

## 2026-07-07 — P3-II: Shifts/payroll/KPI + @cmc/domain-payroll (US-022/023/024, PR #8)
- Shift registration + approval workflow; payroll assembly (Payslip + SalaryRate + CompensationPolicy); KPI scoring; `@cmc/domain-payroll` domain package.

## 2026-07-07 — P4: Gift/rewards, parent-meeting, test-appointment, after-sale (US-025–029, PR #9)
- Star/reward redemption (StarTransaction + Gift + Reward); ParentMeeting scheduling; TestAppointment for học thử; AfterSaleCase tracking + CallMetric.

## 2026-07-07 — P5: Reconciliation worker + flag system + MCP skeleton (US-010, PR #10)
- Reconciliation agent worker (scheduled + event-triggered); flag/dismiss system for anomalies; MCP server skeleton (tool-wrapping tRPC procedures for agent access).

## 2026-07-07 — PD: CI hardening, threat checklist, worker runtime, boot checks (PR #11)
- GitHub Actions CI pipeline hardening; STRIDE threat checklist validation; worker runtime bootstrap; boot-time integrity checks (schema, RLS, append-only enforcement).

## 2026-07-07 — Land 4-PR stack to main (PR #16 merge) + e2e green
- Merged linear stack (pd1⊂pd2⊂env⊂uat) to main via #16 merge-commit; #13/#14/#15 auto-marked merged; child branches deleted. main green (typecheck 26/26, unit+e2e).
- e2e-green fixes: boot-checks queries `pg_class.relrowsecurity` (was non-existent `rowsecurity`); new migration `20260707190000_force_rls_on_rls_tables` FORCE-enables RLS on all RLS tables (API boot-check requires it); e2e teardown moved no-DELETE-grant tables (Attendance/FinalGrade/StarTransaction/Submission/Exercise) to privileged connection; specs decode signed LMS tokens via `decodeLmsClaims`.
- Dev tooling: GitLab Knowledge Graph (gkg) indexed + MCP registered (`.mcp.json`).
- **Known gaps (not yet done):** staff Entra SSO not implemented (msal not installed) — staff ERP login non-functional in production; LLM/S3/Graph-email still stub. Tracked in `plans/260707-1830-golive-coordination-land-stack` (P2/P3).

## 2026-07-07 — P3 integrations: env contract, LLM, boot-check, RT-3, email (PRs #17–#22)
- **Env contract (#18):** `.env.example` documents every var the code reads (grouped); `scripts/env-check.sh` fail-closed guard (CI/shell); `assertRequiredEnvForProd` runtime twin in boot-checks (#20) for the alpine image.
- **LLM real (#19):** `@cmc/llm` calls OpenAI-compatible `/chat/completions` (router.clawcmc, `stream:false`); assertNoPii before network; stub kept offline. Verified live (real VN draft).
- **RT-3 photo authz (#21):** GET /upload/session-photo verifies the caller is entitled to the specific child photo (published evidence for an enrolled approved child + active guardian consent); student confined to own id; 404 on denial. Closes the TODO.
- **Email cả-hai (#22):** shared `renderOutboxEmail` (payload→subject/html/text); `GraphEmailTransport.send` implemented (client-credentials → /sendMail); Brevo fixed to send rendered content; worker registers graph only when GRAPH_* configured.
- **Remaining P3 — Entra SSO (BLOCKED):** AppUser has no roles field + no staff-session infra + placeholder Entra creds. Needs a staff role-assignment model (product/schema decision) before implementation. Tracked as its own task.
