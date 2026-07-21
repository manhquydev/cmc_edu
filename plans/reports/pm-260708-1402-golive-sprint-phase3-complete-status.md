# PM Status Report — Go-live Sprint

**Plan:** 260707-2308-golive-sprint-land-sso-env-uat
**Generated:** 2026-07-08 14:02 | **Status:** in-progress

---

## Phase Completion

| Phase | Name | Status | Criteria |
|-------|------|--------|----------|
| 1 | Land-SSO-Stack | ✅ Completed | PR #24 merged `00ca207`; CI green; changelog done |
| 2 | Env-Prod-Cmcv2 | ⏳ Pending | **BLOCKED** — 3 user-provided items missing (see below) |
| 3 | Flow-Audit-Business | ✅ Completed | Commit `8a68ae1`; 0 CRITICAL; Section 2 rewritten |
| 4 | UAT-GoNoGo | ⏳ Pending | Depends on Phase 2 completion |

**Overall:** 2/4 phases complete · Plan status: `in-progress`

---

## Phase 2 Blockers (user must provide)

| # | Item | Format | Phase 2 step |
|---|------|--------|-------------|
| B1 | **WSL2 confirmed on this machine** | `wsl --version` output | Step 0 (exec env) |
| B2 | **Cloudflare R2 S3 keypair** | `BACKUP_S3_ENDPOINT` + `BACKUP_S3_BUCKET` + `BACKUP_S3_ACCESS_KEY` + `BACKUP_S3_SECRET_KEY` | Step 7 (restore drill) |
| B3 | **Entra email for seed super_admin** | real Azure AD email | Step 8 (bootstrap seed) |

> B4 (Azure redirect URI): verify `ERP_SSO_REDIRECT_URI` matches local-sim origin — can be checked at Phase 2 step 6 smoke.

---

## Phase 3 Deliverables (completed)

| Artifact | Location |
|----------|----------|
| Flow audit report (16 findings) | `plans/reports/flow-audit-260708-1338-erp-role-wf-trace-report.md` |
| UAT Section 2 rewrite (5 kịch bản chuỗi liên vai) | `docs/uat-checklist-go-live.md` |
| TL25 P1-03 roster fix | `docs/25-ma-tran-truy-vet-p1.md` (commit 8a68ae1) |
| Journal entry | `docs/journals/260708-m0-close-flow-audit-redteam-validate.md` |

**REDEPLOY verdict:** NOT REQUIRED — Phase 4 may begin immediately after Phase 2 completes.

---

## Phase 4 Pre-conditions (once Phase 2 done)

- [ ] UAT Section 2 PR (`8a68ae1`) already on main — no merge-conflict risk ✓
- [ ] REDEPLOY verdict NOT REQUIRED — no rebuild needed before Run 1 ✓
- [ ] lms-auth-two-tier suite (13 tests currently skipped) must un-skip green before Run 1
- [ ] e2e mode-switching confirmed (Phase 1 done, 31 call sites refactored)
- [ ] G7-nhẹ: second person runs env-check + boot-checks + grep dev-seam, signs off

---

## Findings Ledger (Phase 3)

| ID | Severity | Issue | Action |
|----|----------|-------|--------|
| HIGH-1 | HIGH | cskh: 3 mutations, no UAT scenario | Added to KB1+KB4 kịch bản |
| HIGH-2 | HIGH | ctv_mkt: manualPunch.create (suspicious) | Added to KB4; user to decide if remove |
| HIGH-3 | HIGH | hr: 6 mutations, no UAT scenario | Added to KB4+KB5 kịch bản |
| MED-01 | MEDIUM | TL25 P1-03 stale roster | **Fixed** (commit 8a68ae1) |
| MED-02..13 | MEDIUM | 12 TL25 alias drifts | Documented in report; PR doc M1 |
| MED-14 | MEDIUM | 22/28 e2e specs absent | Deferred M1/M2 |
| MED-15 | MEDIUM | exercise.view orphan permission | Deferred M1 |
| MED-16 | MEDIUM | facilityNetwork.manage orphan + dead UI | Deferred M1 |

---

## Next Steps

1. **User provides B1–B3** (Phase 2 blockers above)
2. **Execute Phase 2 runbook** (WSL2, docker stack, SSO smoke, restore drill, seed)
3. **Phase 4 Run 1** (e2e critical, email live, UAT người thật với Section 2 chuỗi kịch bản)
4. **GO/NO-GO decision** → biên bản

**Unresolved questions:**
- ctv_mkt manualPunch.create: intentional business rule or permission leak? (user decides)
- Email Entra thật cho seed super_admin: user cần cung cấp địa chỉ
- WSL2 available on this Windows 11 machine?
