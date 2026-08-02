---
title: "Brainstorm/advise contract — P0 review remediation"
date: 2026-08-02
time: "10:38"
type: report
status: accepted
---

# Contract: P0 review remediation (I-D1 / I-D2 / I-D3 + M1)

## Scout (current)

| Fact | Evidence |
|------|----------|
| Entrypoint still fail-open | `chown -R … \|\| true` in image + host file |
| Process non-root works live | docker top UID mapped node |
| Loopback ports OK | 127.0.0.1:5432/3000 |
| CI permissions already in ci.yml | prior P0 |
| Plan 260802-1026 marked completed too early | review verdict REQUEST_CHANGES |

## Outcome

Entrypoint chown is **fail-closed** and **non-recursive**; acceptance language honest (main PID non-root, bare exec = root); local-sim header says loopback-only. Re-verify live after rebuild.

## Constraints

- Scope = review Important I-D1, I-D2, I-D3 + Minor M1 only
- No nginx loopback (I-C1 stays residual, non-goal)
- No README rewrite full (I-DOC → one line if trivial, else skip)
- Repo stays public
- No self-hosted

## Non-goals

- Slim images, CodeQL, resource limits, cap_drop
- nginx 127.0.0.1 bind
- CI Actions run proof (no commit required for that)

## Acceptance

1. entrypoint: no `|| true`, no `chown -R`
2. optional: after chown, `su-exec node` writability check before app exec when blob_dir set
3. Rebuild api/worker; PID1 Uid=1000; health OK; node can write BLOB dir
4. Plan/phase acceptance text uses `docker top` / `-u node`, not bare whoami
5. local-sim header mentions loopback only

## Approach (single)

Fix entrypoint in place + docs in plan files + compose header. No architecture fork.
