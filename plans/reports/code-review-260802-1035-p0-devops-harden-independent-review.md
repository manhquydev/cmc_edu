---
title: "Independent code review: P0 devops harden (non-root, loopback, CI permissions)"
date: 2026-08-02
time: "10:35"
type: report
skill: ak-code-review
verdict: REQUEST_CHANGES
scopes: [docker-runtime, compose-network, ci-permissions]
---

# Independent code review — P0 DevOps harden

**Reviewed:** uncommitted pending diff (not self-praise from implementer session).  
**Plan:** `plans/260802-1026-p0-local-sim-harden-non-root-loopback-ci-permissions/`  
**Diff surface:** `Dockerfile.api`, `Dockerfile.worker`, `docker-entrypoint-node.sh`, `compose.local-sim.yml`, `ci.yml`

**Method:** Stage 1 spec compliance → parallel scoped `code-reviewer` (Docker runtime + Compose/CI) → fresh live verification this session (not recycled implementer claims).

---

## Overall verdict: **REQUEST_CHANGES**

| Scope | Verdict | Notes |
|-------|---------|-------|
| Spec compliance | **PASS with caveats** | Goals met in spirit; acceptance text oversold “container non-root”; plan marked completed too early |
| Docker runtime / privilege | **REQUEST_CHANGES** | Fail-open `chown \|\| true`, recursive chown, verification story wrong |
| Compose loopback + CI permissions | **APPROVE_WITH_NITS** | Correct and effective; residual nginx LAN surface; README drift |

**Do not treat “P0 done / production hardened” as true.** Process non-root + loopback DB/API are real improvements. Ship-clean needs fail-closed chown and honest acceptance language.

---

## Stage 1 — Spec compliance

| # | Requirement (plan) | Status | Fresh evidence |
|---|-------------------|--------|----------------|
| 1 | api/worker **main process** non-root UID 1000 | **PASS** | `docker top` → node PID; `/proc/1/status` Uid=1000; `entrypoint … id` → uid=1000(node) |
| 2 | local-sim 5432/3000 on **127.0.0.1 only** | **PASS** | `ss -lntp`: `127.0.0.1:5432`, `127.0.0.1:3000`; compose ports match |
| 3 | CI top-level `contents: read`; artifact jobs elevate | **PASS (YAML)** | `ci.yml` lines present; **no CI run** re-proved upload still works |
| 4 | Pure prod no postgres host ports | **PASS** | `docker-compose.prod.yml` only nginx 80/443 |
| 5 | Blob dir writable as node | **PASS live** | `exec -u node touch $BLOB_STORAGE_DIR/.write-test…` OK (`/data/blobs`) |
| 6 | Health green | **PASS api; worker via container** | `curl 127.0.0.1:3000/health` ok; worker **not** on host 3001 |

**Caveats (not MISSING, but overclaim):**

- “Non-root **container**” ≠ true: config User empty, `docker exec` default **root**, HEALTHCHECK as root.
- Bare `exec whoami` → root is **expected**; phase-02 still listed that as success criteria (wrong).
- CI least-privilege: static review only; not proven by a green Actions run after change.

**Unjustified extras:** none material.

---

## Stage 2 — Scoped quality findings

### Critical
None.

### Important (must fix before honest “done”)

#### I-D1 — `chown … \|\| true` fail-open

**Evidence:** `infra/docker/docker-entrypoint-node.sh:11,13`  
**Impact:** If chown fails, process still becomes node; `/health` can stay green; first blob write fails later. Contradicts “blob remains writable” guarantee.  
**Fix:** remove `|| true`; fail closed after `mkdir` + non-recursive `chown`.

#### I-D2 — `chown -R` on volume tree

**Evidence:** same entrypoint lines  
**Impact:** unnecessary for fresh dir; recursive chown of volume content is a container footgun (symlinks / large trees / dual api+worker chown on restart).  
**Fix:** `chown node:node "$blob_dir"` only (no `-R`).

#### I-D3 — Acceptance / “completed” overclaim

**Evidence:** phase-02 criteria still “`exec whoami` → node”; plan.md status completed.  
**Impact:** operators mis-verify; status theater.  
**Fix:** document `docker top` / `exec -u node`; leave bare exec = root as expected.

#### I-C1 — nginx still `0.0.0.0:80/443` (scope residual, not regression)

**Evidence:** live `ss`; prod compose nginx ports; local-sim does not override.  
**Impact:** “safer prod-on-machine” is **only** for direct 5432/3000. Full app still LAN-reachable via nginx. Plan allowed this; marketing must not blur it.  
**Fix:** later phase or host firewall; do not claim full stack loopback-only.

#### I-DOC — README socat story vs local-sim

**Evidence:** `README.md` “Postgres has no host port mapping by design” — true for pure prod, **misleading for local-sim** (now `127.0.0.1:5432`).  
**Fix:** footnote local-sim vs pure-prod when docs next touched (non-blocking for runtime).

### Minor

| ID | Finding |
|----|---------|
| M1 | local-sim file header still says “published on host” without “loopback only” |
| M2 | Dockerfile api/worker runtime duplication |
| M3 | `actions: write` may be cargo-cult for upload-artifact v4 — keep until CI proves otherwise |
| M4 | IPv6: only `127.0.0.1` bound; `localhost`→`::1` clients may fail — use `127.0.0.1` in docs |
| M5 | Pure prod + `BLOB_STORAGE_DIR=/data/blobs` without volume = ephemeral disk (pre-existing ops footgun) |
| M6 | Worker health on host: **port 3001 not published**; host `127.0.0.1:3001` is **another service** (observed Langfuse HTML). Never verify worker via host:3001 |

---

## Fresh verification log (this review session)

```text
time: 2026-08-02T10:33:02+07:00
api PID1 Uid: 1000 (node)
worker PID1 Uid: 1000 (node)
curl 127.0.0.1:3000/health → status ok
ss: 127.0.0.1:5432, 127.0.0.1:3000 (not 0.0.0.0)
ss: 0.0.0.0:80, 0.0.0.0:443 (nginx residual)
node touch BLOB_STORAGE_DIR → OK (/data/blobs owned node:node)
entrypoint whoami drop → uid=1000(node)
Config.User empty; HEALTHCHECK runs without USER → root probe
```

---

## What the implementer overclaimed

1. Plan **completed** while Important fail-open chown remains and phase checkboxes/docs wrong.
2. “Non-root container” vs “main process non-root” — only the latter is proven.
3. Health green ≠ storage writable under failure modes (`|| true`).
4. “Safer local-sim” without always saying **DB/API host ports only**, not nginx.

## What is actually good (calibrated)

- Loopback bind syntax and effect: correct.
- Prod compose not polluted with DB ports: correct.
- Shared entrypoint + `su-exec` + no `USER` before chown: correct pattern.
- Stock `node` UID 1000 + `apk add su-exec`: fine.
- CI permission pin is real least-privilege vs unrestricted default; public-repo / no self-hosted respected.
- Live blob write as node currently works on this host.

---

## Recommended fix order (if cook next)

1. Entrypoint: drop `|| true` and `-R`; optional post-chown `su-exec node test -w "$blob_dir"`.
2. Fix phase-02 / plan success criteria language; demote plan to `in_progress` until (1) re-verified.
3. One-line local-sim header: loopback only.
4. README local-sim footnote (docs touch).
5. Do not claim P0 “done” until (1)+(2).

---

## Unresolved

- CI run after permissions change not executed (Actions not triggered by uncommitted local edits).
- Whether `actions: write` required for upload-artifact@v4 under contents:read — untested.

---

## Status

```text
Status: DONE_WITH_CONCERNS
Summary: Independent multi-scope review REQUEST_CHANGES — loopback + process UID real; fail-open recursive chown and oversold “done/non-root container” are the honest blockers to calling this ship-clean.
```
