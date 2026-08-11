# Live authority index — 2026-08-12

**Role:** Pointer only. Historical `plans/*` and old reports stay; do **not** mass-delete.  
**Residual truth (scout):** [`scout-260812-ui-workspace-residual-matrix.md`](./scout-260812-ui-workspace-residual-matrix.md) — prefer this over older coord tables.

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

Session brief (pre-scout): [`brainstorm-advise-260812-herdr-ui-workspace-coord.md`](./brainstorm-advise-260812-herdr-ui-workspace-coord.md)  
Retire candidates (read-only): [`proposal-260812-docs-retire-list.md`](./proposal-260812-docs-retire-list.md)

---

## Wave commits (2026-08-12)

| Commit | What |
|--------|------|
| `4267eb5` | docs(workspace): lean agent entry + live authority index (ui-lean slice B) |
| `2947d6a` | fix(admin): map shifts WS_CSS teal → CMC brand tokens (ui-console; TEKY teal gone) |
| `8ce3a24` | docs(plans): residual UI dual-HITL matrix from scout-pi |

---

## PR #110 (wave status)

| Field | Value |
|-------|--------|
| PR | [#110](https://github.com/manhquydev/cmc_edu/pull/110) — resource-centric form depth + console densify |
| Branch | `feat/lms-foundation-unit-range-spike` |
| State (scout @ `2947d6a` / matrix @ `8ce3a24`) | **OPEN** · required CI green when last checked |
| Merge | **Human OK only** — agents do not merge |

**Landed in wave (summary):** form-depth (shifts, KPI, aftersale, receipt refund/cancel, parents directory, sessions share); demote dual-HITL on aftersale + KPI lists; console densify; ui-ratchet 0; shifts teal tokenized; workspace lean index; residual matrix scout.

---

## Residual dual-HITL matrix

**Source of residual truth:** [`scout-260812-ui-workspace-residual-matrix.md`](./scout-260812-ui-workspace-residual-matrix.md) §1–2, §6.

| Surface | Verdict (live) | Next |
|---------|----------------|------|
| aftersale list | **DONE** demote (list opens compose only) | — |
| KPI list + bulk period | **DONE** demote rows; bulk **KEEP** (owner lock) | — |
| shifts | **OK** index + form Duyệt | optional FilterBar later |
| parents link-request | **KEEP** list Duyệt (owner lock) | — |
| `resolve-after-sale-case-dialog` | **KEEP** form-owned (used by `aftersale-detail` only; **not** dead) | stale comments only |
| check-in `manualPunch` | **GAP #1** — row Duyệt/dialog on list; no UUID form | **S1** form-depth (+ `manualPunch.get`) |
| engagement rewards | **GAP #2** — list Duyệt/Giao/Từ chối; no `/:uuid`; no API `get` | **S2** demote after `rewards.get` |
| teaching exercises | **GAP #3** — list `Công bố`/`Đóng`; no detail form | schedule later (not S1/S2) |

### Notes (scout)

- **GAP #1** `apps/admin/src/pages/attendance/check-in-out.tsx` — ApproveTicketsTab + dialogs; route `/hr/checkin` only.
- **GAP #2** `apps/admin/src/pages/engagement/rewards.tsx` — list mutations only; needs API `get` before form URL.
- **GAP #3** `apps/admin/src/pages/teaching/exercises.tsx` — publish/close on list; logged residual, not yet scheduled.
- TEKY `#00a09d` **gone** after `2947d6a`; raw gray neutrals in WS_CSS are micro hygiene only.

---

## Residual next steps (ordered; from scout §6)

1. **S1** ui-console: check-in `manualPunch` form-depth (GAP #1).
2. **S2** ui-console: rewards demote + `rewards.get` + UUID form (GAP #2).
3. **S3** ui-lean: this INDEX refresh + retire proposal (docs-only) — in flight / landing.
4. Later: exercises GAP #3; optional console grammar on payroll / report-cards; human merge #110.
5. Keep historical `plans/<timestamp>-*/` and old reports; never mass-delete.
