---
title: "CMC EDU DevOps Audit + Modern Practices Research"
date: 2026-08-02
time: "10:15"
type: report
skills: [ak-devops, ak-research]
status: complete
---

# Research + Audit Report: CMC EDU DevOps System

**Conducted:** 2026-08-02 10:15 (local)  
**Scope:** Audit as-built DevOps (CI/CD, Docker, deploy, backup, security) + research latest practices (2025–2026) → actionable improvement roadmap.  
**Stack under audit:** Docker Compose (`cmcv2-prod`) · Postgres 16 · nginx 1.27 · GitHub Actions · pnpm monorepo · VPS/local-sim.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [As-Built DevOps Map](#as-built-devops-map)
4. [Audit Findings (brutal)](#audit-findings-brutal)
5. [Key Research Findings](#key-research-findings)
6. [Gap Matrix (repo vs modern baseline)](#gap-matrix-repo-vs-modern-baseline)
7. [Implementation Recommendations](#implementation-recommendations)
8. [Prioritized Roadmap](#prioritized-roadmap)
9. [Resources & References](#resources--references)
10. [Unresolved Questions](#unresolved-questions)

---

## Executive Summary

CMC EDU has a **solid mid-tier DevOps foundation for a solo/small-team ERP+LMS**: multi-stage Dockerfiles, healthchecks, nginx reverse proxy with rate limits + security headers, encrypted off-box backups (RT-13), restore-drill script, Dependabot, SHA-pinned Actions, branch protection on `typecheck-and-test`, and a fresh report-only Trivy misconfig job (#45, 2026-08-02).

It is **not production-hardened** by 2025–2026 container/CI standards. Live evidence today:

| Check | Result |
|-------|--------|
| Stack running | Yes — `cmcv2-prod` healthy (api/worker/postgres) |
| API process user | **`root`** |
| API/worker image size | **1.13 GB** each (SPA images ~75 MB OK) |
| Repo visibility | **public** |
| CodeQL / code scanning | **not enabled** (API 404) |
| CD / image registry | **none** (manual `git pull` + compose build) |
| Resource limits | **none** |
| Observability | **none** (json-file log rotation only) |
| Postgres host publish | **live `0.0.0.0:5432`** (local-sim override; prod compose text still claims no host port) |

**Verdict:** Good for local-sim pilot and disciplined manual ops. Not ready to call “production complete.” Biggest ROI is **container privilege reduction + image slim-down + repo privacy/self-hosted runner path + minimal observability**, not Kubernetes or Cloudflare Workers.

**Do not** jump to K8s/GitOps/multi-region. Compose on one host is still correct for this product stage. Harden Compose; automate deploy lightly; observe what breaks.

---

## Research Methodology

- **Sources consulted:** 10+ (5 web searches + official docs deep-reads)
- **Date range of materials:** 2024-02 → 2026-08 (priority last 12 months)
- **Key search terms:** Docker Compose production hardening non-root; GitHub Actions security pin SHA self-hosted; Trivy SBOM image scan; PostgreSQL backup R2 restore drill; lightweight observability Docker VPS
- **Authority preference:** Docker official docs, GitHub Actions security guide, Aqua Trivy, production post-mortems
- **Limit:** max 5 external research queries (skill bound); synthesis cross-checked against live repo + running stack

---

## As-Built DevOps Map

```text
Developer laptop / future VPS
├── docker compose -p cmcv2-prod -f docker-compose.prod.yml
│   ├── nginx:1.27-alpine     :80/:443  TLS, rate-limit, strip X-Dev-*
│   ├── api                   :3000 health  (tRPC)
│   ├── worker                :3001 health  (email + reconcile)
│   ├── admin SPA             static via nginx
│   ├── lms SPA               static via nginx
│   ├── postgres:16-alpine    volume cmcv2-prod-pg-data
│   └── minio (profile)       optional; NOT for RT-13 backups
├── scripts/
│   ├── backup-db.sh          pg_dump → AES-256 → R2/S3
│   ├── restore-drill.sh      monthly DR proof
│   ├── ops-smoke.sh          post-deploy smoke
│   ├── isolation-check.sh    no cmcnew-* collision
│   └── env-check.sh          prod env hygiene
└── GitHub Actions (ci.yml)
    ├── typecheck-and-test    BLOCKING (+ branch protection)
    ├── e2e                   warn-only
    ├── ui-e2e                warn-only, push-only, journey artifact
    └── security-scan         Trivy config report-only
```

**Deploy model:** manual runbook (`docs/runbook-deploy.md`) — pull → build → up → migrate → smoke. No registry, no CD job, no blue/green.

**Secrets model:** `.env.prod` on host (gitignored) + boot-checks refuse insecure defaults. No vault/OIDC deploy secrets.

---

## Audit Findings (brutal)

### Strengths (keep)

1. **Multi-stage Dockerfiles** + pnpm layer cache + `.dockerignore` excludes secrets/docs/plans — aligns with Docker official build practices.
2. **Healthchecks** on api/worker/postgres; compose `depends_on: condition: service_healthy`.
3. **nginx** HSTS, strip impersonation headers (RT-2), Docker DNS re-resolve (learned from real 502 bug), rate zones for auth/SSO/API.
4. **Backup/DR design is serious for team size:** AES-256 + PBKDF2, RT-13 host≠host assert, ACL-preserving dump, escrow instructions, restore-drill script.
5. **CI discipline:** frozen lockfile, real migrate+RLS role setup, SHA-pinned actions, Dependabot groups (npm + actions), promotion criteria documented for ui-e2e (not cargo-cult green).
6. **Branch protection:** `typecheck-and-test` required, strict (PR must be up-to-date).
7. **Ops runbooks** are unusually good (incident table, rollback, disk-full, email outbox reap).
8. **Log rotation** json-file 10m×3 — prevents disk death without log ship yet.

### Critical / High gaps

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| D1 | **CRITICAL** | Containers run as **root** | `docker compose exec api whoami` → `root`; no `USER` in any Dockerfile |
| D2 | **HIGH** | Live Postgres bound **0.0.0.0:5432** | `docker compose ps` PORTS; local-sim publishes DB — prod risk if same compose path used on exposed host |
| D3 | **HIGH** | Repo still **public** while runbook requires private before self-hosted runner | `gh api` visibility=public; `docs/runbook-self-hosted-runner.md` invariant |
| D4 | **HIGH** | API/worker images **1.13 GB** | Full monorepo `node_modules` copied into runtime; not prod-deps-only |
| D5 | **HIGH** | No CodeQL / code scanning | API: “no analysis found”; plan phase-0 still “Blocked (user UI)” |
| D6 | **MEDIUM** | No container resource limits | OOM on one service can thrash host |
| D7 | **MEDIUM** | No CD / immutable image tags | Deploy rebuilds on host; no SHA-tagged artifact, no registry, no rollback by image digest |
| D8 | **MEDIUM** | No observability beyond `docker logs` | No metrics, alerts, uptime probe, structured log ship — backlog already notes this |
| D9 | **MEDIUM** | Trivy = config-only, report-only; no **image** CVE scan of built api/worker | Dependabot covers lockfile; OS/base layer CVEs in runtime image invisible |
| D10 | **MEDIUM** | e2e + ui-e2e still `continue-on-error` | Journey ceiling known; merge gate ≠ UI truth |
| D11 | **LOW** | `minio/minio:latest` floating tag | Profile-gated but still bad habit |
| D12 | **LOW** | nginx `server_name YOUR_DOMAIN` placeholder | Fine for local-sim; block real public deploy |
| D13 | **INFO** | Cron backup/restore on paper only until real VPS + crontab verified | Runbook §5 aspirational if host is still laptop |

### Drift / honesty flags

- Older audit (2026-07-17) said “CI dead / no VPS.” **Partially stale:** CI green today; stack runs local-sim-like; VPS still not proven as separate production host from this session.
- Prod compose comments claim postgres has no host port; **local-sim and live ps show 5432 published** — operators can confuse which file is source of truth.
- Tier-2 plan success criteria still mention Semgrep/CHECKSUMS; **superseded** by cut decision (Trivy misconfig only). Criteria text should be cleaned when next touching that plan.

---

## Key Research Findings

### 1. Technology overview (what “modern DevOps” means for this stack)

For a single-tenant education ERP on Compose:

- **CI** = verify every push (typecheck, unit/integration, optional UI, security).
- **CD** = ship **immutable** image digests to a host with a short script or one workflow; avoid rebuild-on-server as sole path.
- **Runtime security** = non-root, drop caps, no-new-privileges, no host DB ports, resource limits, image CVE scan.
- **Supply chain** = pin Actions to SHA, Dependabot, CodeQL, SBOM optional.
- **DR** = encrypted off-site backup + **scheduled restore drills** + escrowed keys.
- **Observability** = health + metrics + logs + alert on disk/CPU/healthfail — not full APM on day one.

Compose **is** production-valid for small internal/pilot systems; industry consensus is “Compose OK if you harden; not a substitute for K8s multi-host HA.”

### 2. Current state & trends (2025–2026)

| Trend | Implication for CMC |
|-------|---------------------|
| Non-root + read-only FS + cap_drop is table stakes | D1 must fix before any security audit |
| Pin Actions to full commit SHA (GitHub security guide) | **Already done** (#45) — keep Dependabot on actions |
| Self-hosted runners only on **private** repos | D3 is a hard gate for the written runbook |
| Trivy multi-target: image + fs + misconfig + secret + SBOM | Expand beyond config-only when image build lands in CI |
| pg_dump still fine for small DB; pgBackRest/PITR when RPO tightens | Keep current path for pilot; plan WAL/PITR only if multi-facility scale |
| Lightweight metrics (Prometheus node exporter + cAdvisor or even Netdata) for single VPS | Prefer Netdata or Prometheus+node_exporter over full ELK |
| Image digests + registry (GHCR) for rollback | Highest CD ROI without K8s |

### 3. Best practices (actionable)

**Containers (Docker official + 2026 production guides):**

- Multi-stage ✅ · minimal base (`node:22-alpine`) ✅
- `USER` non-root with fixed UID (e.g. 1001)
- Prefer `pnpm deploy` / prod-only install for runtime stage (kill 1.13 GB bloat)
- Rebuild with `--pull` periodically for base OS patches
- Optional later: pin base digest + Dependabot/Docker Scout PR flow
- Compose: `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, memory/CPU limits
- Never publish DB ports on internet-facing hosts

**GitHub Actions (official security hardening):**

- Pin actions to full SHA ✅
- Least privilege `permissions:` on workflow (default contents:read)
- Avoid `pull_request_target` with untrusted checkout
- CodeQL default setup for JS/TS + Actions workflow scanning
- Self-hosted: private repo first; prefer ephemeral/JIT if multi-user; never public + self-hosted
- Promote ui-e2e only with documented stability window (repo already defines ≥20 runs / 14 days)

**Backup/DR:**

- Encrypt at rest + transit; passphrase escrowed off-box ✅ design
- Regular restore drills (not one-off) — industry non-negotiable
- Role existence before restore (cmc_app) — already documented
- Lifecycle rules on R2/S3 ✅ documented

**Observability (small team):**

- App logs → stdout (already)
- Host: disk/CPU/mem alert (simple cron or Netdata)
- Uptime: external HTTP check on `/health` + HTTPS
- Later: OpenTelemetry traces only if latency debugging demands it

### 4. Security considerations

| Risk | If unmitigated | Mitigation |
|------|----------------|------------|
| Root in container | Escape → host root path easier | `USER 1001`, no-new-privileges |
| Public repo + future self-hosted | Fork PR runs on your machine | Private before runner |
| Public 5432 | Ransomware / data exfil | Remove host publish on real VPS; firewall |
| No image CVE scan | Known Alpine/Node CVEs ship unnoticed | `trivy image` on built digests |
| No CodeQL | TS injection / XSS patterns missed | Enable default CodeQL |
| Secrets in workflow logs | Token leak | No deploy secrets until private + OIDC/environment reviewers |

### 5. Performance insights

- SPA images ~75 MB: fine.
- API 1.13 GB: slow pull/deploy, large attack surface, wastes disk. Target **&lt;300 MB** with prod-deps-only runtime stage.
- ui-e2e ~6 min measured: stay on every-push until private minutes crunch; then self-hosted removes billing cliff.
- Parallel CI jobs triple minutes; self-hosted or concurrency groups help.

---

## Gap Matrix (repo vs modern baseline)

| Capability | Modern baseline | CMC today | Gap |
|------------|-----------------|-----------|-----|
| Multi-stage build | Required | Yes | — |
| Non-root runtime | Required | No (root) | D1 |
| Image size hygiene | Prod deps only | 1.13 GB monorepo nm | D4 |
| Healthchecks | Required | Yes | — |
| Resource limits | Required | No | D6 |
| Host port discipline | No DB public | Live 5432 open | D2 |
| TLS + HSTS | Required | Yes (placeholder domain) | D12 |
| CI typecheck/test gate | Required | Yes + branch protection | — |
| UI e2e gate | Desired | Warn-only | D10 |
| Actions SHA pin | Required | Yes | — |
| Dependabot | Required | Yes | — |
| CodeQL / SAST | Required (free) | Off | D5 |
| IaC scan | Desired | Trivy config report-only | D9 partial |
| Image CVE scan | Required | No | D9 |
| SBOM | Optional | No | Optional |
| CD + registry | Desired | Manual rebuild | D7 |
| Encrypted off-box backup | Required | Scripts ready | Need cron proof |
| Restore drill cadence | Required | Script exists | Need schedule proof |
| Metrics/alerts | Required for ops | None | D8 |
| Repo private for secrets/runner | Required for self-host path | Public | D3 |

---

## Implementation Recommendations

### Quick wins (code / config — low risk, high ROI)

#### 1. Non-root runtime (D1)

```dockerfile
# infra/docker/Dockerfile.api — runtime stage
RUN addgroup -g 1001 -S cmc && adduser -S -u 1001 -G cmc cmc
# after COPY:
RUN chown -R cmc:cmc /app
USER cmc
```

Mirror on `Dockerfile.worker`. SPA nginx images usually stay as distroless/nginx user already — verify.

Compose optional belt:

```yaml
api:
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  # read_only: true  # only after verifying writable /tmp for Node if needed
```

#### 2. Slim runtime image (D4)

Prefer **pnpm deploy** or `pnpm install --prod --filter @cmc/api...` into a clean runtime layer instead of copying entire monorepo `node_modules`. Success metric: `docker images` api &lt; 300 MB.

#### 3. Resource limits (D6)

```yaml
api:
  mem_limit: 1g
  cpus: 1.5
worker:
  mem_limit: 768m
  cpus: 1.0
postgres:
  mem_limit: 1g
  cpus: 1.0
```

(Compose V2 still honors these; `deploy.resources` only applies in Swarm.)

#### 4. Prod postgres ports (D2)

- Keep **local-sim** host publish for prisma/migrate convenience.
- Ensure **prod** compose has **zero** `ports` on postgres (re-verify file + never override on VPS).
- Host firewall: deny 5432 from WAN.

#### 5. Workflow `permissions` default

```yaml
permissions:
  contents: read
```

Raise only where artifact upload needs `actions: write`.

### Medium effort

#### 6. Build images in CI + `trivy image` (D7/D9)

Nightly or on tag:

1. `docker build` api/worker (and optionally admin/lms)
2. `trivy image --severity HIGH,CRITICAL` report-only → later fail
3. Optional push to `ghcr.io/<owner>/cmc-api:<sha>`

Rollback becomes `image: ghcr.io/...@sha256:...` instead of git checkout hope.

#### 7. Minimal observability (D8)

Phase A (1 hour):

- Uptime Kuma or external curl cron → Discord/email on `/health` fail
- `df -h` + docker disk prune alert cron

Phase B (half day):

- Netdata or Prometheus node_exporter + cAdvisor single compose profile `observability`

#### 8. CodeQL default setup (D5)

Manual: GitHub → Settings → Code security → CodeQL default (JS/TS). Free on public; keep on private for private repos on paid or GH advanced security as applicable. **Do this before inventing Semgrep.**

### Process / ops (human gates)

#### 9. Repo private + self-hosted (D3)

Order is non-negotiable (already in runbook):

1. Private
2. Install runner + label `cmc-local`
3. Switch `runs-on` + postgres host port **55435**
4. Re-verify all CI jobs

#### 10. Backup cron proof

On the real host:

```bash
# after deploy path fixed
sudo crontab -l | grep backup-db
# monthly restore-drill log exists and PASSed within 30 days
```

#### 11. Promote gates only with evidence

- Matrix drift: drop `continue-on-error` when clean for N weeks
- ui-e2e: follow written ≥20 runs / ≥14 days rule already in `ci.yml`

### Common pitfalls (avoid)

| Pitfall | Why |
|---------|-----|
| K8s “because production” | Ops cost &gt;&gt; benefit at 1 facility pilot |
| Self-hosted on public repo | Machine takeover via fork PR |
| Fail CI on all Trivy HIGH day-1 | Noise → people delete the job |
| MinIO as “backup target” | Violates RT-13 |
| Copy full monorepo into runtime | 1.13 GB forever |
| Store only encryption passphrase on the VPS | DR fails when VPS dies |

---

## Prioritized Roadmap

### P0 — this week (security hygiene)

| # | Item | Owner surface | Done when |
|---|------|---------------|-----------|
| 1 | Non-root `USER` in api/worker Dockerfiles | `infra/docker/` | `whoami` ≠ root; health still green |
| 2 | Confirm/fix postgres not published on internet-facing host | compose + firewall | `ss -lntp` no 5432 public |
| 3 | Enable CodeQL default setup | GitHub UI | code scanning tab has analyses |
| 4 | Decision: private repo now or stay public on free Actions | human | written decision in journal/runbook status |

### P1 — next 1–2 weeks

| # | Item | Done when |
|---|------|-----------|
| 5 | Slim api/worker images (prod install / pnpm deploy) | size &lt; 300 MB |
| 6 | Compose resource limits + no-new-privileges | compose updated; stack restarts clean |
| 7 | CI: `permissions: contents: read` + optional image build + trivy image report-only | artifact uploaded |
| 8 | Minimal uptime + disk alert | alert fires on synthetic fail test |
| 9 | If private: self-hosted runner per runbook | CI green on self-hosted |

### P2 — before real go-live / multi-facility

| # | Item | Done when |
|---|------|-----------|
| 10 | GHCR push of SHA-tagged images + deploy-by-digest script | rollback by digest documented |
| 11 | Backup cron + monthly restore drill evidence on real host | log + journal entry |
| 12 | Promote matrix / ui-e2e per existing criteria | `continue-on-error` removed with evidence commit |
| 13 | nginx real `server_name` + real certs (not placeholder) | HTTPS probe green |

### Explicit non-goals (now)

- Kubernetes / Helm / Argo CD
- Multi-region active-active
- Full ELK/Loki stack
- Re-adding Semgrep vendoring (red-team cut stands)
- Jenkins (docs/18 historical debt — superseded by GitHub Actions)

---

## Resources & References

### Official documentation

- Docker building best practices: https://docs.docker.com/build/building/best-practices/
- GitHub Actions security hardening: https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- Trivy: https://trivy.dev/docs/latest/ · https://github.com/aquasecurity/trivy
- PostgreSQL backup/DR patterns (pgBackRest when scale needs PITR): https://pgbackrest.org/

### Project authority (as-built)

- `docs/runbook-deploy.md`
- `docs/runbook-self-hosted-runner.md`
- `docker-compose.prod.yml` · `infra/docker/*` · `.github/workflows/ci.yml`
- `plans/260802-0651-tier-2-vendored-semgrep-trivy-scanners/plan.md` (cut: Trivy misconfig only)
- Prior audit (partially stale): `plans/reports/infra-deployment-audit-260717-1013-m0-exit-criteria-report.md`

### Recommended tutorials / deep dives

- Production Docker compose hardening patterns (non-root, limits, health): 2026 production guides synthesizing Docker Bench practices
- GitHub Security Lab: preventing pwn requests on Actions
- OpenSSF Scorecard for workflow hygiene (optional later)

### Further reading

- Docker Bench for Security (host checklist)
- Cloudflare R2 lifecycle + private bucket (already in runbook)
- OIDC for cloud deploy secrets (only if CD to cloud later)

---

## Appendices

### A. Glossary

| Term | Meaning |
|------|---------|
| RT-13 | Backup target must be off-box (≠ deploy host) |
| RT-2 | Dev impersonation headers must never reach API in prod |
| local-sim | Production-like compose on developer machine |
| SHA pin | Actions referenced by full commit hash, not floating tag |
| SBOM | Software Bill of Materials (dependency inventory) |

### B. Live snapshot (2026-08-02)

```text
Repo: public · default main
Branch protection: typecheck-and-test required (strict)
Recent CI: success (Dependabot + main)
Stack: cmcv2-prod Up ~9h · api/worker/postgres healthy
api whoami: root
Images: api 1.13GB · worker 1.13GB · admin 75.5MB · lms 75MB
Code scanning: none
```

### C. Suggested next cook batch (if approved)

1. `USER cmc` + chown on Dockerfile.api / Dockerfile.worker  
2. `mem_limit` / `cpus` / `security_opt` on compose services  
3. Workflow top-level `permissions: contents: read`  
4. Optional: slim install strategy spike (measure size before/after)

**Do not auto-private the repo or install self-hosted runner without explicit human confirm** (irreversible visibility change + machine trust boundary).

---

## Unresolved Questions

1. Is the running `cmcv2-prod` intended as permanent local-sim only, or will the same host become “production”?
2. Proceed with **repo → private** now (accept temporary CI pause until runner) or stay public on free minutes?
3. Approve cook of P0 items 1–2 + workflow permissions this session?
4. Any real domain/TLS already purchased (unblocks D12)?
5. Backup cron actually installed anywhere, or still aspirational?

---

## Status

```text
Status: DONE
Summary: Full DevOps audit of CMC EDU + 2025–2026 practices research; critical gaps are root containers, fat images, public repo vs self-host path, no CodeQL/observability/CD; Compose-first hardening roadmap delivered (no K8s).
Concerns: Live Postgres host port and root process user are real security debt on the current stack; operational items (private, CodeQL UI, VPS cron) need human action.
```
