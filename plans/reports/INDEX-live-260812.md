# Live authority index — 2026-08-12

**Role:** Pointer only. Historical `plans/*` and old reports stay; do **not** mass-delete.

---

## Locked authority (read before UI/structure work)

| Doc | Role |
|-----|------|
| [`docs/ux-resource-centric-structure.md`](../../docs/ux-resource-centric-structure.md) | **LOCKED** resource-centric UX (1 doc type → 1 list + form UUID; no “Duyệt *” products) |
| [`docs/design-system-console.md`](../../docs/design-system-console.md) | Console chrome / tokens (no free TEKY teal makeup) |
| [`docs/06-kien-truc-url-routing.md`](../../docs/06-kien-truc-url-routing.md) | URL grammar (TL06) |
| [`docs/system-architecture.md`](../../docs/system-architecture.md) | As-built architecture |
| [`docs/WORKSPACE-LEAN.md`](../../docs/WORKSPACE-LEAN.md) | Agent workspace entry (plans path, reports, CI, PR) |
| [`docs/README.md`](../../docs/README.md) | Design corpus index (TL00–TL31) |

Coord session brief: [`brainstorm-advise-260812-herdr-ui-workspace-coord.md`](./brainstorm-advise-260812-herdr-ui-workspace-coord.md)

---

## PR #110 (wave status)

| Field | Value |
|-------|--------|
| PR | [#110](https://github.com/manhquydev/cmc_edu/pull/110) — resource-centric form depth + console densify |
| Branch | `feat/lms-foundation-unit-range-spike` |
| State (2026-08-12 scout) | **OPEN** · **MERGEABLE** · required CI green (`typecheck-and-test`, `ui-e2e`) |
| Merge | **Human OK only** — agents do not merge |

**Landed in wave (summary):** form-depth (shifts, KPI, aftersale, receipt refund/cancel, parents directory, sessions share); demote dual-HITL on aftersale + KPI lists; console densify; ui-ratchet 0; API unit-axis / CI harness harden.

---

## Residual dual-HITL matrix (pointer)

Source of truth for residual inventory (orchestrator table):

→ [`brainstorm-advise-260812-herdr-ui-workspace-coord.md`](./brainstorm-advise-260812-herdr-ui-workspace-coord.md) § *Residual dual-HITL / inbox*

Expected full scout (when PI lands): `plans/reports/scout-260812-ui-workspace-residual-matrix.md`

| Surface | Verdict (live) | Next |
|---------|----------------|------|
| aftersale list | **DONE** demote | — |
| KPI list + bulk period | **DONE** demote; bulk **KEEP** | — |
| shifts | **OK** index + form Duyệt | optional FilterBar later |
| parents link-request | **KEEP** list Duyệt (owner lock) | — |
| check-in `manualPunch` | **GAP** row Duyệt dialog; no UUID form | form-depth or keep dialog-as-form (product) |
| engagement rewards | **GAP** (scout-only below) | next wave — **not** this slice |
| `resolve-after-sale-case-dialog` | **DEAD?** | verify imports / remove if unused |

### Scout-only: engagement rewards

- List: `apps/admin/src/pages/engagement/rewards.tsx` — row **Duyệt** / **Từ chối** / Giao quà; mutations on list.
- Route: `engagement/rewards` only — **no** `/:uuid` form URL.
- Pattern matches dual-HITL residual; demote/form-depth is **next wave**, not ui-lean this slice.

---

## Residual next steps (ordered)

1. Residual cook (ui-console): dead aftersale dialog path · shifts TEKY `#00a09d` → Console tokens · optional check-in punch form-depth if product allows.
2. Rewards demote/form UUID — **next wave** (after form route + authority).
3. Merge #110 only with human approval; then residual PR if needed.
4. Keep historical `plans/<timestamp>-*/` and old reports; refresh this INDEX date when residual matrix moves.
