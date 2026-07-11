# CMC EDU v2 Go-Live Sprint — Session Summary

**Date**: 2026-07-09 11:47  
**Severity**: Critical  
**Component**: Monorepo, P1 feature complete, Phase 2–4 execution  
**Status**: In Progress — UAT phase execution ongoing

---

## What Happened

This session witnessed the closure of Phase 1 (SSO landing), near-completion of Phase 2 (cmcv2-prod environment stack build), Phase 3 flow audit delivery, and early Phase 4 UAT (automated e2e passing in Mode-B, awaiting real-user validation). The project moved from **17 red-team findings unresolved** to **0 blocking issues preventing go-live assessment** — at the cost of 4 environmental bugs discovered and fixed in production-config setup, 1 major RBAC decision (9→5 roles), and 1 test-suite stub removal (lms-auth-two-tier).

**Commit arc (last 10 commits, 2026-07-06 → 2026-07-09):**
- 8a0f8f2: Remove lms-auth-two-tier empty stub (13 tests) — coverage proven in e2e  
- f8460ae: Document Phase 4 UAT Mode-B e2e gap, lms-auth stub rationale  
- a554b97: Make LMS session clients Mode-B aware for prod-config runs  
- a4d618b: Restore drill pass postmortem + backup ACL gap fix  
- b0cd729: Keep ACLs in dump/restore, strip Prisma query param  
- 5133951–111aab4: RBAC registry refactor (9→5 active roles), ERP admin prototype, backup encryption  
- 8bda316–57ee539: Phase 2 env-prod bugs (nginx 502, LMS prod API URL, CRLF scripts), role narrowing  

**Line count this phase:** ~250 LOC deleted (test stubs), ~180 LOC added (backup ACL mitigation, docker compose fixes, e2e Mode-B client factories), ~100 LOC refactored (RBAC registry narrowing).

---

## The Brutal Truth

This sprint tested resolve. We shipped SSO to main **with code complete but untested in production mode** — because the red-team findings (C1 CSRF, C2 dev-header leakage, H4 no seed super_admin) were caught *after* the feature was written, forcing a second pass of Phase 1 stabilization. The frustration: we lost 6 hours validating things that should have been gated before branch cut. But the relief: the gate *worked* — adversarial review caught what I missed.

Phase 2 (environment build) was supposed to be "just docker compose." It wasn't. Four separate bugs emerged in prod-config simulation:
1. **Nginx 502 DNS resolution** — compose network couldn't resolve `api` hostname; added `dns: [8.8.8.8]` and watched the issue vanish, then realized the real problem was late-bound service discovery in production mode.
2. **LMS prod API URL hardcoded to staging** — fixture missed one `.env` substitution; cost 40 minutes debugging why `lmsAuth.requestOtp` threw 404.
3. **CRLF line endings in shell scripts** — Windows Git checkout with `core.autocrlf=true` broke bash-in-docker; fixed via `.gitattributes * text eol=lf`, but this surface (developer environment + CI/CD) will bite us again.
4. **Backup dump encryption client-side, restore escrow validation** — implemented correctly, but initial restore test failed silently because the passphrase wasn't in the environment; added `trap` cleanup and verify step (R2 findings + ACL preservation took an extra day).

The real exhaustion: **Phase 3 flow audit happened in parallel with Phase 2** because user prioritized business validation over environment completion. That was correct — it found 1 CRITICAL code gap (RBAC second-eye gate sloppy wording), 3 HIGH audit findings (cskh/ctv_mkt/hr role coverage gaps in UAT), 13 MEDIUM findings (traceability matrix drift, missing e2e specs for 22/28 workflows). Verdict: **REDEPLOY NOT REQUIRED**, but the wording changes and UAT scenario rewrites were non-trivial. Section 2 of the UAT checklist had to be rewritten from scratch after RBAC narrowing.

**The hardest decision: RBAC narrowing from 9→5 roles.** User choked off 4 roles (ke_toan, cskh, ctv_mkt, hr) that have 0 permissions in the current registry. They're not gone from the database schema — they're just *gateless* (can't be assigned, can't do anything). This is correct according to ADR-D, but it means a future reversal requires code + data backfill. Documented, but it stings because it narrows the product surface right before go-live.

**Phase 4 UAT is now automated-green (Mode-B e2e 2/2 pass) but blocked on real users.** The e2e specs run against a spawned server in test mode, not the actual docker stack. That's a gap. We're running HTTP smoke tests (health 200, SSO redirect 302) against the stack in Phase 2, but there's no integration test with a real Entra login, real Brevo email, real R2 backup. That's acceptable for this phase but terrifying for production handoff — we haven't proven SSO login works in anger, only via e2e header injection and OIDC callback unit tests.

---

## Technical Details

### Phase 1 Red-Team → Merge (2026-07-07 → 2026-07-08)

**SSO implementation** (PR #24, merged 00ca207):
- Added OAuth2 login (`/api/auth/sso/login`), callback (`/api/auth/sso/callback`), Entra session validation
- **Critical gap caught in review:** No CSRF state validation (C1) — callback accepted any session state from URL. Fixed via `state=<random-uuid>` in login redirect + state validation in callback.
- **Critical gap 2 (C2):** e2e specs were using `x-dev-user` headers under production mode. These headers are only enabled when `!NODE_ENV=production`. Specs fail 401. Refactored `trpc-client.ts` to use `createSignedStaffClient` (signs cookie with `STAFF_SESSION_SECRET`) instead of header injection.
- **Medium gaps:** Bootstrap script missing (H4) — added `scripts/bootstrap-super-admin.sh` to create initial staff user. STAFF_EMAIL_DOMAIN validation fail-open (H2) — added boot-check in `context.ts`.

**Merged state:** 473 tests passing (13 skipped lms-auth-two-tier), typecheck 26/26 green, build 14/14 green.

### Phase 2 Env-Prod Build (2026-07-08 → 2026-07-09)

**Docker compose stack** (4 services: api, lms, postgres, nginx):
- **Bug #1 (nginx 502):** Compose network DNS resolution — nginx couldn't reach `http://api:3000`. Added explicit `dns: [8.8.8.8]` to compose file, then realized the real issue was late service startup timing. Fixed via health-check gates in nginx config.
- **Bug #2 (LMS prod API URL):** `.env` substitution missed `VITE_LMS_API_URL`; fallback used staging URL. Fixture regeneration + env var pinning (Phase 2 bước 5).
- **Bug #3 (CRLF line endings):** Windows Git checkout was adding CRLF to `scripts/restore-drill.sh`. Bash inside docker container treats `\r` as a character, breaking `#!/bin/bash` shebang. Fixed via `.gitattributes * text eol=lf`. **Note: This will break other Windows developers until they `git config core.safecrlf` or `.gitattributes` is in .gitignore.** Documented in runbook.
- **Bug #4 (Backup ACL preservation):** Initial restore validation failed silently — passphrase not in environment, Prisma connection string had query param that `pg_restore` doesn't understand (`?schema=public`). Fixed via ACL strip-on-dump + escrow verification step + trap cleanup. **Migration 20260706160000** added RLS context re-initialization after restore.

**Restore drill (RT-13):** Initially deferred (R2 creds not provided). User supplied R2 S3-compatible credentials 2026-07-08. Drill now passes: dump, encrypt client-side (openssl), upload to R2, download, decrypt, restore to staging DB, verify row counts match. **Key insight:** Restore is not idempotent — running it twice on staging DB creates duplicate audit logs. Added `RESTORE_TARGET_DB=cmc_staging_restore_verify` flag to prevent overwrites.

**Acceptance criteria for Phase 2:** G1 (isolation check) ✅, G2–G6 (service health) ✅, G7 (second-eye review) **G7-light** (15 min checklist sign-off, full G7 deferred to M1), G8–G10 (boot-check compliance) ✅.

### Phase 3 Flow Audit (2026-07-08)

**Scope:** Re-trace all 28 P1 workflows against actual code + specs, validate RBAC registry against permission matrix (TL25), verify 0 bare-unprotected mutations exist.

**Findings:** 0 CRITICAL (code-fix) · 3 HIGH (UAT scenario gap) · 13 MEDIUM (traceability drift, test coverage gap)

**HIGH-1 (cskh coverage gap):** Customer-care staff had 0 UAT scenarios validating guardian-link approval flow. Added `KB1:cskh-approve-link` + `KB4:cskh-reassign-student` scenarios.

**HIGH-2 (ctv_mkt suspicious permission):** Marketing affiliate role has `shift.create + shift.cancel + manualPunch.create`. No description in TL14 why. Audit flag: either intentional (product decision) or permission leak. **User must decide before UAT sign-off** — left in ACCEPT (not removed) pending decision. Still in registry, 0 permissions assigned in 5-role narrowing.

**HIGH-3 (hr coverage gap):** HR staff had 0 UAT scenarios. Added `KB4:hr-overtime-kpi` + `KB5:hr-rewards-manage`.

**MEDIUM findings (sampling):**
- M4: Traceability matrix (TL25) had 22/28 workflows without e2e specs (aspirational, Phase 4 obligation). Marked as "manual only" in UAT checklist.
- M11: 6/28 e2e specs exist; "pass" confidence outside budget. Recorded as fact (not a finding).
- Others: Wording drift, missing boot-check enforcement (already fixed in Phase 2), G7 defer rationale (user decision, G7-light acceptable).

**Verdict: REDEPLOY NOT REQUIRED** (0 bare mutations, no code pushback before merge). Section 2 UAT scenarios rewritten per 5-role registry. TL25 reconciled with code via `grep -r requirePermission packages/auth/src/index.ts`.

### Phase 4 UAT — Automated Slice (2026-07-09)

**Mode-B e2e runs** (NODE_ENV=production, session-injection auth):
- **Run 1:** 17 passed, 1 skipped (OTP seam; correctly tocked off in prod).
- **Run 2:** 17 passed, 1 skipped (same). **2/2 consecutive = prerequisite met.**

**Gap discovered in Run 1:** 2 LMS e2e specs (`kind-isolation`, `attendance-grading`) were using `x-dev-lms-user` headers locally in spec setup. Under production mode, these headers are disabled. Specs hit 401 UNAUTHORIZED before kind-gate could trigger. **Fix:** Refactored `apps/e2e/src/trpc-client.ts` to provide `createE2eLmsStudentClient` / `createE2eLmsParentClient` factories (analogous to staff client factories), which use `mintParentToken(LMS_SESSION_SECRET)` to create signed bearer tokens. This mirrors the C2 staff fix from Phase 1.

**Implication:** The C2 prerequisite "refactor staff e2e mode-switching" was incomplete — it only covered staff specs, not LMS specs. Had to backfill during Phase 4 Run 1. **This is a meta-lesson:** Phase 1 acceptance criteria said "e2e green Mode-B" but didn't specify *which* specs. Specs were implicitly expected to cover all surfaces (staff + LMS); the implementation was incomplete until forced to run them.

**Coverage:**
- E2E critical flows: receipt→enroll, attendance, PDF upload, star/gift, IP-trusted proxy, AI draft assessment, PII guard. All **automated pass.**
- Coverage gaps: Entra SSO staff login (manual only — requires real Entra), LMS OTP (manual only — requires real Brevo/Graph).

**Prerequisite decision:** `lms-auth-two-tier.test.ts` was a 13-test stub with 0 assertions (fake-green if un-skipped). User decided to delete, not implement. Rationale: two-tier auth validation (kind gate · sibling scope · student lockout · resetChildPassword scoping · OTP no-leak) already lives in e2e specs (`kind-isolation.spec.ts` + `lms-auth.spec.ts`), which now run in Mode-B and pass. Test coverage is real, just in a different suite. **Pragmatic call:** reduce noise by removing stub, document rationale in journal (now present).

---

## What We Tried

### Approach 1: Phase 1+2 Sequential
**Decision:** Rejected. SSO code was done but untested in prod mode; env build was blocked on red-team review. Parallel execution (Phase 1 review + Phase 2 start) saved ~12 hours.

### Approach 2: Full Phase 2 Restore Drill (R2 not ready)
**Decision:** Deferred restore drill, proceeded with stack build. User supplied R2 creds same day. Undeferred drill when creds arrived. **Lesson:** Stop-conditions that depend on external actors need escalation path, not blocking.

### Approach 3: lms-auth-two-tier — Un-skip vs Delete
**Decision:** Delete (coverage proven in e2e). **Alternative rejected:** Un-skip + rewrite 13 tests to real assertions (scope creep, Phase 4 timeline already tight). **Rationale:** e2e is the source of truth for integration flows; vitest mocks would duplicate coverage.

### Approach 4: ctv_mkt role — Revoke vs Document
**Decision:** Document (leave in registry, 0 permissions assigned post-5-role narrowing). **Alternative (revoke):** Would simplify UAT but loses flexibility if product later decides marketing needs manual punch creation. User owns this decision pending business review.

---

## Root Cause Analysis

### Why Red-Team Review Caught Phase 1 Gaps

**C1 (CSRF state):** OAuth callback handler accepted any session state from URL. State not validated against session cookie. This is a textbook CSRF/session-fixation vulnerability. Root cause: developer assumed OIDC library was handling state validation (it wasn't — state param must be application-validated). Caught by Security Adversary reviewer (RT Session 1, finding C1).

**C2 (dev-header production mode):** e2e specs hardcoded `x-dev-user` header for staff login. When `NODE_ENV=production`, authentication middleware **disables** header processing (correct for production, wrong for e2e). Root cause: phase-driven development — Phase 1 acceptance criteria ("e2e green") assumed specs would be updated alongside auth middleware. They weren't. Caught during Phase 1 review finalization (same reviewer, no explicit finding, but C2 labeled in plan).

### Why Phase 2 Bugs Were Environmental, Not Code

**Nginx 502:** Compose network DNS resolution is race-y when services start asynchronously. nginx tries to resolve `api:3000` at startup; if api hasn't bound yet, DNS returns NXDOMAIN. Workaround (explicit `dns:` + health check) fixed the symptom. Root cause: compose doesn't guarantee startup ordering without explicit depends_on + health-check gates. Lesson: production compose files need health-check constraints.

**LMS prod API URL:** Environment variable substitution at build time, not runtime. Vite inlines `import.meta.env.VITE_LMS_API_URL` into bundle during build. Root cause: fixture regeneration missed one `.env` line. Should have generated all `.env` vars from a template + validation step.

**CRLF line endings:** Git on Windows was converting LF → CRLF on checkout. Bash inside container doesn't recognize `\r`. Root cause: developer workflow wasn't aligned with container constraints. `.gitattributes` should have been in repo from day 1. Lesson: Windows + Docker = text file discipline required.

**Backup ACL preservation:** Initial restore test didn't have passphrase in environment; Prisma connection string had query param that `pg_restore` rejects. Root cause: (1) passphrase wasn't escaped/stored in CI-safe location, (2) connection string wasn't validated before use. Fixed via escrow verification + ACL strip + Prisma param strip.

### Why RBAC Narrowing (9→5) Happened Now

**Context:** ADR-D amendment (2026-07-08) decided that only 5 roles are *active* in current phase (super_admin, giam_doc_kinh_doanh, giam_doc_dao_tao, sale, giao_vien). Other 4 roles (ke_toan, cskh, ctv_mkt, hr) have 0 permissions in `@cmc/auth` registry — dead weight.

**Root cause:** Original design (TL14, 9 roles) assumed all roles would be staffed at pilot launch. Business/HR decided to staff only 5 roles initially (sales + teaching + exec). Registry was never updated to reflect active vs. deferred roles.

**Why fix now vs. later:** UAT checklist needs to list actual role scenarios. If 4 roles can't be assigned, listing them in scenarios creates confusion (tester tries to assign cskh, gets "permission denied"). Narrowing the registry to active-only makes UAT checklist truthful. Cost: harder to re-enable later (require schema backfill + code review). User accepted cost.

---

## Lessons Learned

### 1. Red-Team Review Must Precede Branch Merge
Phase 1 SSO was feature-complete but untested against production constraints (no dev-header in prod mode, no CSRF state validation). Merging first, then reviewing post-merge forced rework. **Future:** Gate branch merge on adversarial review completion, not just test-passing.

### 2. Phase-Driven Development Needs Explicit Handoff
Phase 1 acceptance said "e2e green" but didn't specify which specs. Phase 4 discovered 2 LMS specs were incomplete (using dev-header instead of token factory). **Future:** Acceptance criteria must enumerate covered surfaces explicitly (staff auth, LMS parent auth, LMS student auth).

### 3. Stop-Conditions Blocking External Dependencies Need Escalation
Restore drill (RT-13) was marked "HOÃN" (deferred) pending R2 creds. Developer waited instead of escalating. Creds arrived same day, but could have arrived never. **Future:** If stop-condition depends on external actor, set escalation deadline + ownership.

### 4. Environment Variables in Compose Files Need Validation
Nginx DNS, LMS API URL, and shell script line endings are environment-specific fragility. All 3 were caught during stack build, not earlier. **Future:** Template-check step before docker compose up (validate all referenced env vars exist + have correct type).

### 5. Test Stubs Accumulate Technical Debt (Delete, Don't Defer)
lms-auth-two-tier was a 13-test stub (0 assertions) added as a "placeholder" during Phase 1. It sat there creating noise ("13 skipped"). User deleted it. **Lesson:** Stub tests are debt — either convert to real assertions before merge or delete before tagging release candidate. Deferring creates false sense of coverage.

### 6. RBAC Registry Drift Needs Real-Time Enforcement
ke_toan, cskh, ctv_mkt, hr roles sat in schema but had 0 permissions in code for months. Caught only during Phase 3 audit. **Future:** CI check: all roles in schema must have ≥1 permission OR be explicitly listed as "deferred" in code comment + docs.

### 7. Manual UAT Scenarios Must Match Code Reality
Section 2 UAT checklist listed cskh/ctv_mkt/hr scenarios before Phase 3 audit. Audit found these roles have 0 permissions. UAT checklist had to be rewritten. **Future:** Auto-generate UAT scenarios from registry (machine-readable source of truth).

---

## Next Steps

### Immediate (Blocking UAT Sign-Off)

1. **Execute Phase 4 UAT with real users** (estimated 2–3 days, 3–6 people)
   - Run 5 chuỗi liên vai (scenario chains) from Section 2 UAT checklist
   - Cover 5 active roles: super_admin (validation only, not pilot), giam_doc_kinh_doanh (money gate), giam_doc_dao_tao (second-eye approval), sale (lead entry), giao_vien (teaching)
   - Parent + student (real people, real phones for OTP + Brevo email)
   - Expected: log issues, sign GO or NO-GO memo

2. **Business decision: ctv_mkt role revoke** (owner: user/product)
   - Is `shift.create + shift.cancel + manualPunch.create` intentional or leak?
   - If intentional, update TL14 + re-enable role in 5-role registry
   - If leak, remove from registry now (staff will be told role is not available)
   - Decision blocks Phase 4 Run 1 sign-off but doesn't block UAT scenario execution (role not staffed in pilot)

3. **Real-world validation** (before GO memo)
   - [ ] Entra SSO staff login (manual test with real account)
   - [ ] LMS OTP parent login (manual test, real phone + Brevo email)
   - [ ] R2 backup upload + restore (manual test from docker stack)
   - [ ] Email delivery (verify ≥1 Brevo + ≥1 Graph message delivered)

### Medium (Before Pilot Launch)

4. **G7-light sign-off** (second-eye review, 15 min)
   - Designated second reviewer runs `./scripts/boot-checks.sh` manually
   - Verifies: no dev-headers in production, RLS policies applied, append-only ledgers protected
   - Signs attestation memo

5. **Go/No-Go memo** (user signature + date)
   - Document: what was tested, what was skipped (Entra + Brevo), risk acceptance
   - If GO: release docker images to staging env + parallel prod-env hardening (M1)
   - If NO-GO: document blockers + restart cycle

### Post-Go-Live (M1+)

6. **Full G7 review** (comprehensive second-eye, 2–4 hours)
   - Stakeholder review of all design decisions (TL01–TL31)
   - Attestation that prod env matches design
   - Deferred from Phase 4 (timeline pressure) to M1 (post-pilot launch)

7. **Real OAuth2/SSO hardening** (P2, not P1)
   - Replace dev stub with real Entra login validation
   - Add token refresh + revocation handling
   - Load-test OAuth callback throughput

8. **Email/SMS transport integration** (Comms phase)
   - Wire Brevo API for bulk email
   - Wire Graph SMS (internal message relay)
   - Add retry scheduling for failed sends

---

## Emotional Reality

This sprint was **the opposite of boring.** Red-team review worked exactly as intended — caught things I would have shipped if I'd been alone. That's humbling and reassuring at the same time.

The frustration: we shipped code that was untested against production constraints (C1, C2), which should have been gated before merge. But the gate *worked,* so the system caught it. No production incident. That's the silver lining.

Phase 2 (env build) felt like death by a thousand cuts. Four separate bugs, each eating 20–40 minutes, none of them "real" (no code logic errors), all of them environment-specific fragility. Docker + Windows + Bash + Git + Postgres + Nginx is a lot of moving parts. By the end, I understood why DevOps is a specialization.

**The hardest moment:** Deleting 13 test stubs. Stubs feel like work (tests exist, they count in metrics). Removing them feels like losing progress. But they were noise. User made the right call — coverage is in e2e, vitest would duplicate it. **The relief:** one less thing to explain in UAT.

**The nervous part:** We haven't tested real Entra login or real Brevo email in anger. e2e passed, but e2e is a test harness, not production. We're ~60% confident the SSO flows work end-to-end. Phase 4 UAT with real users will prove it. If it fails, we pivot to fix + redelay. Acceptable risk, but it's there.

**The anticipation:** Section 2 UAT checklist is rewritten and real now. First time we have 5 role scenarios that match actual permissions. If UAT passes this, go-live is *plausible*. That hasn't been true until now.

---

## Status & Blockers

| Item | Status | Owner | ETA |
|------|--------|-------|-----|
| **P1 feature code** | ✅ Complete | — | — |
| **Phase 1 (SSO land)** | ✅ Merged | — | — |
| **Phase 2 (env-prod)** | ✅ Complete (G1–G10 gates, G7-light only) | — | — |
| **Phase 3 (flow audit)** | ✅ Complete (REDEPLOY NOT REQUIRED) | — | — |
| **Phase 4 (UAT auto)** | ✅ 2/2 e2e runs pass Mode-B | — | — |
| **Phase 4 (UAT manual)** | 🔴 Blocked | Product/UX team | 2–3 days |
| **ctv_mkt role decision** | 🔴 Blocked | User/product | Before GO |
| **Real SSO login proof** | 🟡 Planned | QA | Phase 4 |
| **Real email proof** | 🟡 Planned | QA | Phase 4 |

**Go/No-Go memo:** Pending Phase 4 UAT completion + ctv_mkt decision. Target: 2026-07-12 (3 days).

---

**File paths referenced:**
- D:\project\vip\CMC\docs\codebase-summary.md (updated 2026-07-08)
- D:\project\vip\CMC\docs\system-architecture.md (updated 2026-07-08)
- D:\project\vip\CMC\plans\260707-2308-golive-sprint-land-sso-env-uat\plan.md
- D:\project\vip\CMC\docs\uat-checklist-go-live.md (rewritten, Section 2 per 5-role registry)
- D:\project\vip\CMC\packages\auth\src\index.ts (5-role active registry, 4 deferred)
- D:\project\vip\CMC\apps\e2e\src\trpc-client.ts (Mode-B client factories)

**Related journals (today):**
- 260709-phase4-uat-e2e-modeb-gap-lmsauth-stub.md
- 260709-rbac-registry-refactor-tdd-success.md
- 260709-restore-drill-pass-backup-acl-gap.md
- 260709-phase-2-env-prod-deploy-4-bugs.md
