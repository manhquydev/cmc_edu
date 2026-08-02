# 2026-08-02 — Tier 1 Guardrails + UI E2E Restoration

**Session:** Security hardening + ui-e2e regression fix  
**PRs Merged:** #39, #45, #46, #47  
**Branch Protection:** main now requires `typecheck-and-test`  
**UI E2E Status:** ui-chromium 40/40 specs green in CI (first genuine green run)

---

## Summary

Four linked security/reliability PRs landed to main today, establishing Tier 1 guardrails (GitHub native + pre-commit enforcement + dependency patching) and restoring ui-e2e to green after a regression introduced in commit 01f6e4c. All changes e2e-only (no production code modified in #45, #46); toolchain majors (#47) required zero config changes.

---

## What Changed

### PR #39: Tier 1 Guardrails (Security Foundation)

**Added:**
- **GitHub native secret scanning + push protection** (.gitleaks.toml configured; 0 real secrets found, 2 test-fixture false-positives allowlisted)
- **Dependabot config** (.github/dependabot.yml; auto-pull minor/patch, manual for majors)
- **Husky pre-commit hook + lint-staged** (eslint scoped, enforces @cmc/ui one-door import rule)
- **pnpm overrides** patching fast-uri + brace-expansion HIGH advisories (used transitively; no direct upgrade path available)
- **Branch protection on main** requiring `typecheck-and-test` check (enforced today; ui-e2e stays continue-on-error pending 20-run stabilization gate)

**Rationale:** GitHub native tooling (secret scan + push protection) + Dependabot + pre-commit form the foundation of a secure CI pipeline. These three layers are independent, complement native GitHub security dashboard, and require zero custom infrastructure.

---

### PR #46: UI E2E Regression Fix (40/40 Green in CI)

**Root Cause:** Commit 01f6e4c (admin/API contracts correction) tightened three contracts that journeys had not yet caught up to:
1. Staff role field (`Vai trò`) made required on user create dialog
2. Parent email field made required on receipt create form (LMS OTP login credential)
3. Shift config nav entry moved from Quản trị (super_admin) to Nhân sự (shift.manage role)

**Fixes Applied:**
- Updated three journey specs to navigate the correct nav paths post-move
- Filled required parent email in receipt-create journeys (generated @example.com, one per journey)
- Updated user-create helper to pick a role at creation time; updated role-assignment journey to proof the mutation, not the creation
- Fixed strict-mode locator ambiguity in dialog controls (scoped getByLabel queries to open create dialog only; 3 Dialog components mounted simultaneously = 3 matches otherwise)
- Disambiguated receipt detail reads (sale lacks finance.receiptGet; assert banner for sale, use approver's detail nav for UUID read)

**Result:** ui-chromium project 40/40 specs passing in CI at commit c9af5f1 — the first genuinely-green ui-e2e run (prior runs were all local, labeled informational only; CI run has gitDirty:false, real HEAD SHA).

**Coverage Preserved:** Code review confirmed coverage stayed complete, not softened. One independent reviewer approved.

---

### PR #45: Tier 2 (Cut): IaC Scanning + Action SHA Pinning

**Added:**
- **Trivy config/misconfig scan** (report-only, continue-on-error) over Dockerfile/compose/nginx; deliberately not blocking yet (no owner assigned to triage findings)
- **GitHub Actions SHA-pinned** in ci.yml (no @v4 refs; all using explicit commit SHAs: actions/checkout@11d..., actions/setup-node@49..., etc.)

**Rationale:** Dependency-CVE scanning is Dependabot's domain (already reads pnpm-lock.yaml). Secret scanning is GitHub native. IaC/misconfig is the uncovered class. SHA pinning prevents action supply-chain drift and is standard SLSA L3 practice.

**Intentional Non-Blocking:** Trivy config is report-only because:
- No single owner has claimed findings triage responsibility yet
- False-positive rate in IaC tooling varies wildly by rule and context
- First run will generate a baseline to evaluate signal quality

---

### PR #47: Toolchain Majors (vite 6→8, vitest 2→4)

**Changes:**
- vite 6 → 8.2.0 (apps/admin, apps/lms)
- @vitejs/plugin-react 4 → 6.0.5
- vitest 2 → 4.1.10 (all workspace members: apps/api, apps/admin, packages/auth, domain-finance, domain-grading, domain-identity, domain-payroll, domain-time, llm, storage, ui)
- @vitest/coverage-v8 updated in lockstep

**Config Changes:** Zero. None of the deprecated options from vitest 3/4 series (deps.inline, environmentMatchGlobs, test.workspace) were used in the codebase.

**Supersedes:** Dependabot PRs #38, #42, #43, #44 (manual consolidation into a single coordinated bump).

---

### CodeQL Default Setup (GitHub Native, Automated)

**Enabled:** JavaScript/TypeScript + Actions scanning  
**First Scan Result (2026-08-02):** 20 alerts triaged

**Breakdown:**
- **6 HIGH** — all false-positive or by-design:
  - HMAC token signing (JWT signing via PBKDF2) misidentified as password hashing
  - HttpOnly Set-Cookie with SameSite misidentified as plaintext-at-rest (transport attribute ≠ storage)
  - Loopback-gated dev script (staff password seed) not reachable from internet
- **4 MEDIUM** — real workflow-permission gaps (jobs declare no explicit permissions blocks; GitHub default is too permissive for some contexts); being addressed in concurrent hardening phase (not blocking)
- **10 LOW** — noise (unused variables, obvious tautologies, etc.)

---

## What Was NOT Changed (Deliberately Out of Scope)

**P0 Local-Sim Hardening** (concurrent, in-flight, not merged):
- Non-root Docker entrypoint
- Loopback-only binding for dev services
- CI permission tightening
- These belong to a separate session and are noted as "being addressed separately" in the known-issues table

---

## Impact on Workflows

**Branch Protection (main):**
- `typecheck-and-test` is now a required check (enforced today)
- ui-e2e runs on push but remains continue-on-error; will promote to required once >= 20 runs prove stabilization
- All PRs to main now must pass typecheck + test before merge

**CI Green State:**
- All three blocking jobs (typecheck-and-test, e2e, ui-e2e) are passing at HEAD (c9af5f1)
- Pre-commit lint enforces eslint scoped to files touched; no lint debt on the tree

**Security Posture:**
- GitHub secret scanning + push protection covers secrets in real-time
- Dependabot auto-opens PRs for security patches; major versions require manual review
- All GitHub Actions pinned to commit SHAs (no @v4 version drifts)

---

## Acceptance Ledger Note

**Important:** This session touches ui-e2e regression fixes but does NOT rewrite the acceptance count. The 31/38 journey UI flows proven at commit 324bd12 (2026-07-26) remains the current snapshot. Today's fix (c9af5f1) proves the same 31/38 + 9 regression specs green; the count is stable, not an increase. The 7 no-ui-path flows are ceiling constraints (not UI coverage gaps, but design dependencies). The measured acceptance report (`pnpm acceptance:report`) is the system of record; this doc captures a dated snapshot only.

---

## Known Issues Recorded

1. **SSO (Entra) disabled** — M365 tenant access lost; email/password active as fallback; known issue on reactivation path (sso-routes.ts:220 needs RLS bypass before SSO can run)
2. **CodeQL workflow-permission gaps** — 4 MEDIUM findings on job permission declarations; not security-critical, being addressed separately
3. **ui-e2e promotion criteria** — pending >= 20 runs / >= 14 days stability gate (clock started 2026-07-26; today's run is ~run 30 overall but only ~day 7 of the 14-day window)

---

## Files Changed

- `.github/dependabot.yml` (new)
- `.gitleaks.toml` (new)
- `.husky/pre-commit` (new)
- `.github/workflows/ci.yml` (updated: branch protection note, ui-e2e M1 resolution, all actions SHA-pinned)
- `package.json` (pnpm overrides for HIGH advisories, husky postinstall)
- `pnpm-lock.yaml` (deps: fast-uri, brace-expansion patches; vitest/vite/plugin-react majors)
- `apps/e2e/tests/journeys/*.journey.ui.spec.ts` (4 spec files: nav path fixes, email fills, role picks, locator scoping)
- `docs/system-architecture.md` (new CI & Security section, updated Known Issues)
- `docs/codebase-summary.md` (new 2026-08-02 update banner)

---

## Next Steps

1. **UI E2E Stabilization:** Monitor ui-e2e for flakes over the next 14 days; clock is ~day 7 of the 20-run/14-day promotion window
2. **CodeQL Triage:** Assign owner for 4 MEDIUM workflow-permission findings; integrate into a concurrent hardening phase or prioritize before next major release
3. **Trivy Findings:** Review Trivy config report once baseline is established; decide if/when to promote to blocking

---

**Status:** DONE  
**Concerns:** None blocking; 4 MEDIUM CodeQL findings are real but not in scope for this session (noted as "being addressed separately")
