# Live authority index — 2026-08-12

**Role:** Pointer only. Historical `plans/*` and old reports stay; do **not** mass-delete.  
**Residual UI truth:** prefer this INDEX + post-merge scouts over older coord tables.  
**Scout (consolidated develop):** [`scout-260813-1326-ship-to-develop.md`](./scout-260813-1326-ship-to-develop.md) · earlier: [`scout-260812-1054-develop-consolidated-state.md`](./scout-260812-1054-develop-consolidated-state.md)  
**ADR vs as-built map:** [`analysis-260812-1013-adr-journal-vs-business.md`](./analysis-260812-1013-adr-journal-vs-business.md)  
**Earlier residual matrix (pre-S1 form-depth):** [`scout-260812-ui-workspace-residual-matrix.md`](./scout-260812-ui-workspace-residual-matrix.md)

---

## Locked authority (read before UI/structure work)

| Doc | Role |
|-----|------|
| [`docs/ux-resource-centric-structure.md`](../../docs/ux-resource-centric-structure.md) | **LOCKED** resource-centric UX (1 doc type → 1 list + form UUID; no “Duyệt *” products) |
| [`docs/design-system-console.md`](../../docs/design-system-console.md) | Console chrome / tokens (no free TEKY teal makeup) |
| [`docs/06-kien-truc-url-routing.md`](../../docs/06-kien-truc-url-routing.md) | URL grammar (TL06) |
| [`docs/system-architecture.md`](../../docs/system-architecture.md) | As-built architecture (truth-synced 2026-08-12) |
| [`docs/WORKSPACE-LEAN.md`](../../docs/WORKSPACE-LEAN.md) | Agent workspace entry (plans path, reports, CI, PR) |
| [`docs/README.md`](../../docs/README.md) | Design corpus index (TL00–TL31) |
| Live nav IA | `apps/admin/src/shell/nav-registry.ts` (TL16 ADR-C 5-group table = history) |

Session brief (pre-scout): [`brainstorm-advise-260812-herdr-ui-workspace-coord.md`](./brainstorm-advise-260812-herdr-ui-workspace-coord.md)  
Retire candidates (read-only): [`proposal-260812-docs-retire-list.md`](./proposal-260812-docs-retire-list.md)

**Design system (2026-08-13):** audit Console/LMS **10/20**; cook A–D **đã vào develop** (#124–#125, #127–#129, #132–#135). Collision 17 tên biến **giữ cố ý**, pin bằng test (không xóa). TL12 pointer trên `docs/README.md` đã gỡ ở #125. Plan: [`260813-0120-design-system-hardening/plan.md`](../260813-0120-design-system-hardening/plan.md) · synthesis: [`audit-260813-0052-ds-impeccable-synthesis.md`](./audit-260813-0052-ds-impeccable-synthesis.md).

**Meter + teaching loop (#136, `develop@2e6aef3`):** `pnpm verify:system`; GĐĐT break-glass Phát bài + grant/cắt range; gallery bốn họ. P2-05 student path vẫn `no-ui-path`. Plan: [`260813-1211-hoan-thien-san-pham-meter-va-diem-nghen/plan.md`](../260813-1211-hoan-thien-san-pham-meter-va-diem-nghen/plan.md).

---

## Wave commits (resource-centric + hardening)

| Commit | What |
|--------|------|
| `4267eb5` | docs(workspace): lean agent entry + live authority index (ui-lean) |
| `2947d6a` | fix(admin): map shifts WS_CSS teal → CMC brand tokens |
| `8ce3a24` | docs(plans): residual UI dual-HITL matrix from scout-pi |
| `d52caa4` | feat(hr): form-depth for manual punch ticket approval (**S1 check-in DONE**) |
| `9ddef3f` | fix(admin): ResultPanel props on manual punch ticket form |
| `df4ded0` | fix(e2e): exact Duyệt on check-in form (avoid statusbar steps) |
| `da3b8a8` | feat(engagement): resource-centric form depth for rewards approval (**S2 DONE**) |
| `8d84de0` | docs(workspace): refresh live index after rewards demote (S2) |
| P1a / `64c8448` (+ #112) | test(api): grade atomic-lock deflake |
| P1c / `53fa7d0` (+ #113) | chore(acceptance): classify tRPC orphans + enable orphan ratchet |
| P2 / `19608e1` (+ #114) | test(e2e): P1-08 refund/cancel journey (mark flow proven) |

Base integration tip when this INDEX was truth-synced: `develop@71dc552` (merge #114).

---

## Branch / PR governance

| Field | Value |
|-------|--------|
| Integration | **`develop`** (and **`main`**) — **branch-protected** |
| Required CI | **`typecheck-and-test` + `ui-e2e`** (both block merge) |
| Wave PR #110 | **MERGED** into develop (form-depth + LMS foundation unit-range) |
| Merge to main / promotion | **Human OK only** — agents do not merge |

**Landed (summary):** form-depth (shifts, KPI, aftersale, receipt refund/cancel, parents, sessions, rewards, **check-in tickets**); dual-HITL demote on aftersale/KPI/rewards/check-in lists; Console densify; TEKY teal gone; workspace lean docs; grade deflake; orphan ratchet; P1-08 journey proven.

**Acceptance photo (measured):** **36/42** proven after P1-08 journey — re-run `pnpm acceptance:report` + CI artifact for live number (docs are snapshots only).

---

## Residual dual-HITL matrix (live on develop)

| Surface | Verdict (live) | Next |
|---------|----------------|------|
| aftersale list | **DONE** demote | — |
| KPI list + bulk period | **DONE** demote rows; bulk **KEEP** | — |
| shifts | **OK** index + form Duyệt | optional FilterBar later |
| parents link-request | **KEEP** list Duyệt (owner lock) | — |
| `resolve-after-sale-case-dialog` | **KEEP** form-owned | stale comments only |
| check-in `manualPunch` | **DONE** demote — list `Mở phiếu` → `/hr/checkin/:ticketId` + `manualPunch.get` (`d52caa4`) | — |
| engagement rewards | **DONE** demote — form `/admin/engagement/rewards/:rewardId` + `rewards.get` (`da3b8a8`) | — |
| teaching exercises | **DONE** demote — list index-only `Mở phiếu`; HITL on `exercise-detail.tsx` (#123) | — |

### Notes

- Check-in list is index-only; form owns Duyệt/Từ chối (`check-in-ticket-detail.tsx`, route `hr/checkin/:ticketId`).
- Rewards list index-only; form owns lifecycle.
- Exercises list index-only; form owns Công bố/Đóng (`exercise-detail.tsx`).
- Dual-HITL **KEEP** (owner lock): parents link-request list; KPI bulk period.
- TEKY `#00a09d` gone after `2947d6a`.

---

## Residual next steps

1. P2-05 student open/submit still `no-ui-path` after #136 — remaining cook in `260813-1211` phase 02.
2. Class lifecycle / family identity: `260813-0813` A2–B1 (A1 landed #131).
3. Promote develop → main only with human OK after green required checks.
4. Keep historical `plans/*`; never mass-delete.
