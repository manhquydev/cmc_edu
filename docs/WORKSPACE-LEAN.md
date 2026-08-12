# Workspace lean — agent entry

Short operating map for agents on CMC EDU v2. Product authority stays in locked docs; this file only answers **where to work** and **what not to invent**.

---

## Where things live

| Path | Use |
|------|-----|
| `plans/<timestamp>-<slug>/` | Durable execution plans (this project **overrides** Harness `docs/plans/active/`) |
| `plans/templates/` | Plan templates |
| `plans/reports/` | Session/cook/scout/advise reports |
| `docs/plans/` | Harness-managed — **do not write** product plans here |
| `docs/` | Design corpus + locked UX/architecture |

**Live authority pointer:** [`plans/reports/INDEX-live-260812.md`](../plans/reports/INDEX-live-260812.md)  
**Residual dual-HITL matrix (scout truth):** [`plans/reports/scout-260812-ui-workspace-residual-matrix.md`](../plans/reports/scout-260812-ui-workspace-residual-matrix.md)  
**UX structure (LOCKED):** [`docs/ux-resource-centric-structure.md`](./ux-resource-centric-structure.md)  
**Console chrome:** [`docs/design-system-console.md`](./design-system-console.md)  
**As-built:** [`docs/system-architecture.md`](./system-architecture.md)  
**Harness request flow:** [`docs/WORKFLOW.md`](./WORKFLOW.md)

---

## Reports naming

```
plans/reports/<kind>-YYMMDD-<slug>.md
```

Examples: `scout-260812-…`, `cook-260812-…`, `brainstorm-advise-260812-…`, `INDEX-live-260812.md`.

Do **not** mass-delete historical `plans/*` or old reports to “clean” the tree.

---

## DO NOT invent Duyệt apps

Resource-centric rule (locked):

- **1 document type → 1 list + form UUID**
- Role → which rows + which form actions
- **Never** a second product/nav leaf named “Duyệt …” per role

Keep by owner lock (do not “fix” away):

- KPI **bulk period** actions on list
- Parents **link-request** list Duyệt/Từ chối

---

## CI gates (done = green)

Required on `main` / merge readiness:

1. `typecheck-and-test`
2. `ui-e2e`

Acceptance numbers: run `pnpm acceptance:report` — docs snapshots are dated photos only.

---

## PR workflow

- Work on a **feature branch** + PR; never commit straight to local `main`.
- No force-push to `main`.
- Do **not** merge without human OK (e.g. PR #110 resource-centric wave).
- Conventional commits; no secrets; no AI attribution noise in commit messages.

---

## Full agent contract

Root [`AGENTS.md`](../AGENTS.md) + Harness block remain canonical for intake/skills/GitNexus. Prefer this file for day-to-day workspace routing; do not rewrite `AGENTS.md` wholesale for lean tips.
