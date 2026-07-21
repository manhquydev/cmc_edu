# Infra / Deployment Audit — M0 Go-Live Exit Criteria vs Repo Reality

**Date:** 2026-07-17 · **Auditor:** infra-audit-agent · **Scope:** repo artifacts only (no live-infra access)
**Verdict headline:** Go-live is **NOT formally decided** and **cannot be** from the repo — several G-criteria are frozen at 2026-07-09 and the whole thing still assumes a VPS that the repo shows was **never provisioned** (still local-sim).

---

## 1. Deployment reality: still local-sim, NOT a real VPS

**Finding: DEPLOYMENT IS STILL LOCAL-SIM (developer's own Docker on Windows). No evidence of a rented VPS, real domain, or TLS.**

- `docs/project-roadmap.md:84` — "Phụ thuộc ngoài repo" table: **VPS thật (mua/thuê + DNS) → needed for M1 → status "Chưa" (not done)**, as of 2026-07-08. No later doc flips this.
- `docs/project-roadmap.md:57` — M1 (=" Pilot ổn định + VPS thật") status column: **"Chưa"** (not started). "chuyển VPS thật + TLS/DNS thật" is explicitly an M1 goal, i.e. *after* go-live.
- `docs/project-roadmap.md:20-23` (Definition of Final Done #3): "Hạ tầng production thật — VPS thật (**hết local-sim**)…" is listed as an unmet end-state goal, confirming current state is local-sim.
- All operational proof to date is against the local Docker stack `cmcv2-prod` (`docker compose -p cmcv2-prod ps`), e.g. `docs/uat-checklist-go-live.md:16`, `docs/journals/260711-build-regression-brevo-otp-fix.md:12-14`. That stack runs on the dev machine — memory note "cmc-localsim-ops-quirks" corroborates (docker via Git Bash, socat sidecar for port-less postgres).
- `docs/runbook-deploy.md:1-3` describes a "VPS riêng" as a *prerequisite the operator must supply* — it is aspirational runbook text, not a record that a VPS exists. The migration note at `runbook-deploy.md:49-56` even flags that the host-side migration path only works from inside the Docker network — i.e. never exercised on a real separate VPS host.
- The two most recent journals (2026-07-16, PR #34) are **pure code/feature work** (audit middleware, facility mgmt, race fixes) — zero infra/VPS/DNS/TLS content. Grep for VPS/DNS/TLS/certbot across all journals returns only pre-07-12 files.

**Cannot determine from repo alone:** whether *any* server is currently running the stack right now, and if so whether it's the dev laptop or something else. The reviewer must ask the developer directly. Repo strongly implies: dev laptop only.

---

## 2. CI health: free-tier exhaustion is an OPEN, unresolved operational risk

**Finding: CI is effectively DOWN and there is NO evidence of a fix/workaround in the repo.**

- `.github/workflows/ci.yml` normally runs, on PR-to-main and on every push: a **blocking** `typecheck-and-test` job (pnpm install, `prisma migrate deploy`, `pnpm typecheck`, `pnpm test`, payroll coverage ≥90%) against a throwaway Postgres 16 service; and a **non-blocking** `e2e` job (`continue-on-error: true`, `ci.yml:89-91`) — so a flaky/slow e2e never blocks a merge.
- The PR #34 commit (`35cff7d`, 2026-07-17) records "CI unavailable — GitHub Actions free-tier hours exhausted; e2e/typecheck-and-test fail in 2s = runner never started, not real failures." This means the **blocking gate has not actually run** on recent merges — green/red status on #34 (and anything after) is *unverified by CI*, validated only by local runs the developer described.
- **No workaround exists in the repo:** no self-hosted runner config, no billing/plan note, no `docs/` entry, no follow-up commit addressing CI hours. `ci.yml` is unchanged. This is a **live open risk**: until hours reset or a plan is purchased, no PR gets an independent CI check — the project is running on trust-the-local-run.

---

## 3. Real email delivery (Brevo/OTP): STILL OPEN on production

**Finding: the Brevo credential fix is applied LOCALLY ONLY; production email delivery remains unverified / unshipped.**

- `docs/project-changelog.md:74-77` (2026-07-11): fix applied to local `.env.prod`, key validated against Brevo `/v3/account` (200 after IP allowlist). Explicitly: **"Not yet applied to the live VPS"** — needs (1) VPS outbound IP added to Brevo authorised-IPs, (2) `.env.prod` redeploy, (3) log verification.
- `docs/journals/260711-build-regression-brevo-otp-fix.md:156-163` — same three steps listed as "Immediate (Blocking UAT/Go-No-Go)", plus a **security action still outstanding: rotate the Brevo SMTP + API keys** (they were pasted in-session on 2026-07-11).
- **No journal or changelog entry after 2026-07-11 resolves this.** The 07-12 and 07-16 entries never mention Brevo. So as of the repo: real parent-OTP email over Brevo has **never been verified end-to-end in production**, and the exposed keys **may still be un-rotated**.
- Compounding ceiling (`changelog:77`): Brevo account is free plan, **300 sends/day** — fine for a 1-facility pilot, a hard cap at any scale.
- This directly blocks **UAT Kịch bản 1 step 7** ("PH nhận OTP email thật (Brevo)", `uat-checklist-go-live.md:127`), which is a manual UAT flow that cannot pass until production email works.

---

## 4. Formal go-live sign-off: BLANK — no GO decision recorded anywhere

**Finding: Section 5 is literally unfilled; no other doc records a GO decision.**

- `docs/uat-checklist-go-live.md:376-398` — Meeting date `___`, Attendees `___`, **Decision: GO ☐ / NO-GO ☐ (both unchecked)**, blocking-items list empty, "Signed off by ___". Verbatim blank template.
- No changelog/journal/roadmap entry anywhere records an actual go-live meeting or GO verdict. `roadmap:56` still shows **M0 status "Đang chạy" (in progress)**, not done. So this is a genuinely-not-yet-decided state, not a stale-file-that-forgot-to-update.

---

## 5. Backup/restore: one-off drill, now 8 days stale; no recurring evidence

**Finding: restore drill PASSED once on 2026-07-09; no evidence of any repeat since. Scheduled cron exists only on paper.**

- `docs/uat-checklist-go-live.md:341` / `docs/project-changelog.md:237-255` — restore drill PASS **2026-07-09** (R2 `cmc-db-backups`, 49 tables, escrow decrypt OK, backup host ≠ deploy host per RT-13). One event.
- `docs/runbook-deploy.md:263-271` defines a cron (daily backup 02:00 UTC, monthly restore drill) **"on VPS host"** — but since there is no VPS (§1), this cron is **not running anywhere**. It's a runbook aspiration.
- No journal after 07-09 shows a re-run. As of the 2026-07-17 review the last (and only) drill is **8 days old** and was performed on the local-sim stack, not production hardware. For a go-live decision, "restore works" currently rests on a single 8-day-old local test.
- Open dependency reinforcing this: `roadmap:81` R2/S3 remote creds row = **"Chưa có — user cấp sau"** (not yet provided) as of 2026-07-08 — though the 07-09 drill implies some R2 access was obtained. Worth confirming the R2 bucket used is remote/real, not local MinIO (docker-compose.prod.yml:141-161 warns MinIO does NOT satisfy RT-13).

---

## 6. G1–G10 criteria: doc-claim vs repo-verifiable vs status

| # | Criterion | Doc claims (checklist §4) | Verifiable from repo | Status |
|---|---|---|---|---|
| **G1** | E2E critical green ≥2 consecutive | ✅ 2026-07-09 Run1+2 PASS 17/1skip, Mode-B **staging** | e2e ran on throwaway `cmc_staging` via tsx server, **not** the docker stack (`uat:62-64`); green confirmed in changelog:263. Valid but scoped to staging config, 8 days old. | **Accurate but narrow** — proves app logic, not prod images/nginx/VPS. |
| **G2** | 6 Section-2 sign-off rows signed | *(blank)* | Sign-off table `uat:274-284` entirely unsigned; requires real human UAT + working Entra SSO + Brevo OTP. | **Open** (blocked by §3 email). |
| **G3** | Cutover probe → 401 (RT-2) | *(blank)* | Probe table `uat:318-331` empty; requires a running prod stack at a real domain to curl. | **Open / unverifiable-from-repo.** |
| **G4** | 0 CRITICAL/HIGH open findings | ✅ 2026-07-09 (0 CRIT, 3 HIGH = UAT gaps) | changelog:286-301 confirms the 07-09 audit. **BUT** superseded by later work: PR #34 code-review found a **Critical plaintext-OTP-leak** (fixed pre-merge, `journals/260716-super-admin…:30-41`) and Phase 9 found **9 real gaps incl. H-severity** (`journals/260716-happy-path-gaps…`). Those were fixed, but the "✅ 2026-07-09" tick predates them. | **Stale** — the 07-09 clean-bill is 3 feature-drops old; needs a re-audit tick. |
| **G5** | Restore drill PASS (host≠host) | ✅ 2026-07-09 | See §5 — real but one-off, 8 days old, local-sim. | **Accurate, but currency questionable** for a go-live gate. |
| **G6** | Isolation check PASS | ✅ 2026-07-09 | `uat:349-351` shows the probe table row blank, yet G6 marked ✅ at `uat:366`. Minor internal inconsistency; `scripts/isolation-check.sh` exists per runbook. | **Likely accurate, lightly self-inconsistent.** |
| **G7** | 2nd-person env-check + boot-checks + grep dev-seams (G7-nhẹ) | *(blank)* — full G7 deferred to M1 | Requires a second human to run `env-check.sh` against real `.env.prod`. Not doable from repo. | **Open / unverifiable-from-repo.** |
| **G8** | `ALLOW_DEV_AUTH` absent from `.env.prod` | ✅ 2026-07-09 | `.env.prod` is gitignored (correctly) — auditor **cannot** re-verify. Claim rests on 07-09 grep. | **Unverifiable-from-repo** (must re-grep live file). |
| **G9** | `TEST_OTP_SEAM` absent from `.env.prod` | ✅ 2026-07-09 | Same as G8. | **Unverifiable-from-repo.** |
| **G10** | `STAFF_SESSION_SECRET ≠ LMS_SESSION_SECRET` | ✅ 2026-07-09 | Boot-check `assertStaffLmsSecretsDistinct()` enforces this at runtime (changelog:352); but the actual `.env.prod` values are gitignored. | **Enforced by code; value-level unverifiable-from-repo.** |

**Pattern:** every automated/repo-checkable gate (G1, G4, G5) is **green but frozen at 2026-07-09** and predates three later feature merges (07-12 HR, 07-12 premium screens, 07-16 super-admin + Phase-9). Every human/live gate (G2, G3, G7) is **blank**. Every `.env.prod` gate (G8–G10) is **unverifiable from repo by design** (secret file gitignored — correct posture, but means the reviewer must trust the 07-09 grep or re-run it live).

---

## 7. Bottom line for the acceptance reviewer

1. **No formal GO exists** — the decision record is blank (§4). M0 is still "in progress."
2. **The go-live target is a VPS that was never bought** — everything demonstrated so far is on a developer's local Docker simulation (§1). "Production" in these docs means local-sim.
3. **Three concrete blockers are still open in the repo:** production Brevo email unverified + keys possibly un-rotated (§3); CI can't run so recent merges are un-gated (§2); restore drill is a single 8-day-old local test (§5).
4. **The green checkmarks (G1/G4/G5) are real but old** — dated 2026-07-09, before three feature drops (incl. one that introduced a Critical OTP leak later caught in review). They should not be read as "the current build is certified."

---

## Unresolved questions (need answers from outside the repo)

1. Is *any* server currently serving the stack, and is it a real VPS or the dev laptop? (Repo says: no VPS provisioned.)
2. Have the Brevo API/SMTP keys exposed on 2026-07-11 been rotated yet? (Security-relevant, repo shows no confirmation.)
3. Has GitHub Actions billing been resolved / a self-hosted runner added, or is CI still dark?
4. Was the 2026-07-09 restore drill's R2 bucket a genuinely remote store (RT-13 requires host≠host), or local MinIO?
5. Given G1/G4/G5 predate the 07-12 and 07-16 merges, does the team intend to re-run the automated gates on current `main` before any GO?
