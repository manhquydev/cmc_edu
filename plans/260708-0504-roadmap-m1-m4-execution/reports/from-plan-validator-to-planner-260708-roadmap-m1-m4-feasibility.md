# Feasibility validation — Roadmap M1–M4 execution plan

From: plan-validator · To: planner · Date: 2026-07-08
Scope: critical-questions / feasibility pass (NOT security red-team — runs separately).
Verdict: **DONE_WITH_CONCERNS** — plan is structurally sound and honest about deferral, but 4 BLOCKING
decisions and 3 missed prerequisites must land before M1 can start or its exit be measured.

Verified against repo (not scout-copied):
- `packages/db/prisma/schema.prisma:225 Facility`, `:1060 FacilityNetwork` (per-facility `cidr`), `:922 AuditLog` (`actor` field) — all exist.
- `infra/nginx/nginx.conf:47 server_name YOUR_DOMAIN;  # REPLACE before deploy` — placeholder real (plan cites `:40`, actual `:47`).
- `scripts/backup-db.sh` + `restore-drill.sh` — **no** minio/blob references (grep clean).
- `docker-compose.prod.yml` — healthchecks (`:63,85,131,151`) + `restart: unless-stopped`; no alerting/metrics/log-shipping.
- `docs/runbook-deploy.md` — has rollback (§3), incident response (§4), backup cron (§5). Already VPS-oriented.

---

## (a) BLOCKING decisions needed before M1

**B1 — Monitoring/alerting stack (highest priority).**
M1 exit = "≥2 tuần liên tục 0-CRITICAL" (phase-01 §Success, roadmap M2 table). Repo has ONLY docker
healthchecks + `restart: unless-stopped` + manual `docker compose ps` / `curl /health` / `logs -f`
(runbook §2.3–2.4). There is **no** log aggregation, uptime probe, metric, or alert routing. "Detect
CRITICAL over 2 weeks" therefore = a human eyeballing `docker ps`. Decision needed: what makes the
watch observable (minimum: external uptime probe on `/health` + `/` worker + log-based error alert +
who receives it). Without this, M1 exit is unfalsifiable.

**B2 — Definition of "CRITICAL" + pilot-stable sign-off owner.**
"0-CRITICAL" has no severity taxonomy anywhere in `docs/` (grep: no incident/severity doc). Undefined:
what counts as CRITICAL vs degraded; does the 2-week clock **reset** on any CRITICAL or only pause;
**who** signs "pilot stable" (PO? tech lead?). All three block a measurable M1 gate. phase-01 step 7
says "đếm CRITICAL" but defines neither the unit nor the counter.

**B3 — VPS provider + concrete spec.**
phase-01 §Prerequisites lists "spec (RAM/CPU/disk cho postgres+api+worker+nginx+minio)" as a
stop-condition but gives no sizing. This co-hosts Postgres 16 + api + worker + nginx + MinIO on one
box. Decision needed: provider + concrete floor (suggest ≥4 GB RAM / 2 vCPU / ≥40 GB SSD as a
starting hypothesis to validate, not a deferred blank). Undersizing surfaces mid-pilot as a CRITICAL
and pollutes the very 0-CRITICAL metric M1 depends on.

**B4 — Backup provider: pick ONE of R2 / S3 / Backblaze + retention policy.**
Plan says "R2/S3 remote" generically throughout (plan.md §Dependencies, phase-01 step 4). Endpoint,
credential shape, egress cost, and `BACKUP_S3_ENDPOINT` differ per provider. Runbook §5 hard-codes
14-day daily retention + monthly drill — is that policy **accepted**, or a placeholder? Pick provider
and confirm retention before M1 step 4, else RT-13 drill can't be wired.

---

## (b) Acceptance criteria needing tightening

| Criterion | Location | Problem | Tighten to |
|---|---|---|---|
| "≥2 tuần liên tục 0-CRITICAL" | phase-01 §Success / roadmap M1 | CRITICAL undefined; no detector; clock-reset rule unstated; no owner | Define severity; state reset rule; name sign-off owner; cite the monitoring source that proves "0" (see B1/B2) |
| "stack healthy" | phase-01 §Success | Partly OK — docker healthcheck exists — but "healthy" over 2 wks needs continuous proof, not one `ps` | Bind to B1 probe: "health probe green ≥X% over window" |
| "restore drill pass" | phase-01 step 4 | Concrete (`=== RESTORE DRILL PASSED ===`) but **DB-only** — blob/MinIO not covered (see P3) | Add blob restore assertion or explicitly scope-out with rationale |
| "coverage đủ" / "tương đương after-sale.test.ts" | phase-02 step 2, §Success | No threshold — "đủ"/"equivalent" is subjective | State the specific lifecycle states + RLS-negative + role-gate cases required (enumerate), not a coverage %  |
| "acceptance TL28 pass" | phase-02 §Success | Verifiable only if TL28 WF-P4-01..05 have concrete pass steps — not re-verified here | Confirm TL28 steps are executable checklists before M2 start |
| "eval đạt ngưỡng TL29§5" | phase-03 §Success | Scout says TL29§5 = "viết mới khi tới pha AI" — **the threshold does not exist yet**. Acceptance references an unwritten number | Acceptable as structural, BUT flag: TL29§5 threshold MUST be authored + agreed before M3 exit can be judged. Add as M3 entry-gate, not exit-surprise |
| "override-rate đo được" | phase-03 | "measurable" ≠ a target | Set target band at M3 phase-detail (e.g. override-rate ≤ N%) |
| "isolation audit pass ... sample mỗi domain" | phase-04 §Success | Sample size / which domains undefined | Enumerate domains (finance, HS/grades, attendance, consent-photos) + sample count per domain |
| "tất cả cơ sở CMC live" | phase-04 §Success | Denominator unknown (facility count unchosen) | Blocked on M4 step-1 list; acceptable as structural |

---

## (c) Recommended parallelization (false serialization in the plan)

Plan serializes M0→M1→M2→M3→M4 (plan.md §Dependencies; phase-02 `dependencies:[1]`). Two of these
dependencies are artificial:

**P-A — M2 (P4 UI + tests) does NOT need the VPS.** phase-02 is pure app code: `apps/admin/src/pages/*`
UI + `apps/api/src/appointment` tests + trace-matrix doc. It is gated in CI, developed on dev. The only
real serialization is *deploy-to-pilot* (pushing M2 changes onto the box under 0-CRITICAL watch would
perturb the M1 metric). **Recommendation:** develop + merge M2 in parallel with the M1 2-week watch;
gate only *deployment* of M2 to the pilot until M1 signs off. File ownership is clean (M1 = infra:
`infra/nginx`, `.env.prod`, `docker-compose.prod.yml`, `scripts/`; M2 = `apps/admin`, `apps/api/src/{appointment,after-sale,meeting,rewards}`), so no shared-file conflict. This reclaims the entire 2-week watch as build time.

**P-B — M3 eval harness + eval-plan authoring (TL29§5) is app code / doc work.** Only the eval *run*
needs pilot data (phase-03 correctly notes this). Writing the harness, the metric definitions, and the
TL29§5 threshold can happen during M1/M2 — and *should*, because B2/acceptance shows the threshold is a
prerequisite, not an output. **Recommendation:** author TL29§5 threshold during M1/M2; only defer the
data-dependent run.

**P-C — M4 onboarding runbook authoring** can be drafted anytime (schema already supports multi-facility
— `Facility`/`FacilityNetwork`/`AppUser` scoped, verified). Only *execution* needs the facility list.
Low urgency, but not blocked by M3.

Keep serialized (genuinely dependent): pilot data → M3 eval run; pilot-stable → M4 rollout;
M2 deploy → pilot box.

---

## (d) Prerequisites the plan missed

**P1 — Blob/MinIO store has NO backup (data-loss risk on child-consent photos).**
Verified: `backup-db.sh` + `restore-drill.sh` reference only Postgres — no minio/blob path (grep clean).
The MinIO volume holds session-evidence + guardian consent photos of children (schema T3 §Assessment/
Consent). RT-13 restore drill proves DB recoverability but a VPS loss = permanent loss of consent
evidence. This is a real failure mode, not abstract. **Add to M1:** either blob backup+restore to the
same remote (R2/S3), or an explicit, documented scope-out with the PO accepting the risk. Runbook §4.6
already acknowledges the blob volume exists — the backup gap is asymmetric with that awareness.

**P2 — Definition of Final Done point 5 is mapped to NO milestone.**
Roadmap §1 requires **5** conditions; M1–M4 cover points 3,1,2,4 respectively. Point 5 ("vòng học hỏi
đóng — incident/postmortem template dùng thật; mọi thay đổi qua PR + gates; không hotfix tay") has no
home. grep confirms no incident/postmortem template exists in `docs/`. The plan claims to realize the
full Definition of Final Done (plan.md §Acceptance) but omits point 5. **Decision:** fold the incident/
postmortem template + severity taxonomy into M1 (it is the natural owner — the 2-week watch *needs*
CRITICAL definitions and an incident log anyway, resolving B2 simultaneously), or add an explicit M5.

**P3 — VPS cutover rollback path is missing (fix-forward ≠ cutover-revert).**
Runbook §3 covers app-rollback and migration-rollback *on the running stack*. It does NOT cover "the
VPS cutover itself failed — revert to M0 local-sim." phase-01 §Risk lists TLS/DNS/certbot risks but no
revert plan if the box is unusable mid-cutover. Since M0 local-sim stays intact until M1 signs off,
the rollback is cheap to state: keep local-sim running until pilot-stable, DNS TTL low for fast
repoint-back. **Add** a one-paragraph cutover-rollback to phase-01 (DNS repoint + local-sim retention
window) — the runbook is otherwise sufficient for VPS.

Minor: phase-01 cites `nginx.conf:40` for the placeholder; actual is `nginx.conf:47`
(`server_name YOUR_DOMAIN;  # REPLACE before deploy`). Fix the citation.

---

## Feasibility of "just-in-time" M3/M4 deferral — VERDICT: SAFE

The core structural-deferral question ("does M3/M4 force a migration that must be designed into M1/M2
now?") checks out **negative** — deferral is genuinely safe:
- Multi-facility data model already exists: `Facility` (`:225`), per-facility `FacilityNetwork.cidr`
  (`:1060`), `AppUser[]` scoped, RLS `withFacility` + FORCE-RLS boot-check (per phase-04 scout,
  consistent with schema). M4 needs a *runbook*, not a schema migration.
- AI audit-log schema exists: `AuditLog.actor` (`:922`) is a free-form string — `ai:recon` / `ai:*`
  principals need no schema change.
- Per-facility IP config exists: `FacilityNetwork` already models per-facility CIDR.

So M3/M4 detail can legitimately wait. The ONE thing that must NOT wait (pulled forward above): the
TL29§5 eval threshold (B2/acceptance) — it is an M3 *input*, and the plan currently treats it as a
deferred detail. Author it during M1/M2.

---

## Unresolved questions (for planner / PO)

1. Monitoring stack choice for the 2-week watch — accept a minimal external uptime probe + log-error
   alert, or is manual eyeballing acceptable for a single-facility pilot? (drives B1)
2. Is the blob/MinIO store in-scope for backup, or is losing consent photos an accepted pilot risk? (P1)
3. Does Definition of Final Done point 5 become part of M1, or a new M5? (P2)
4. Backup provider: R2, S3, or Backblaze — and is 14-day retention the policy? (B4)
5. Who owns the "pilot stable" sign-off, and does the 2-week clock reset on any CRITICAL? (B2)
6. Approve running M2 build in parallel with the M1 watch (deploy-to-pilot still gated)? (P-A)

Status: DONE_WITH_CONCERNS
Summary: Plan is honest and structurally safe to defer M3/M4 (schema already supports them), but 4 BLOCKING M1 decisions (monitoring, CRITICAL definition+owner, VPS spec, backup provider), a missed blob-backup + Definition-point-5 + cutover-rollback prerequisite, and a false M1→M2 serialization must be resolved before M1 executes.
