# Live authority index — 2026-08-12

**Role:** Pointer only. Historical `plans/*` and old reports stay; do **not** mass-delete.  
**Residual UI truth:** prefer this INDEX + post-merge scouts over older coord tables.  
**Scout (consolidated develop):** [`scout-260812-1054-develop-consolidated-state.md`](./scout-260812-1054-develop-consolidated-state.md)  
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

**Design system audit 2026-08-13 (4 grok lane + Claude cross-check, impeccable):** Console **10/20**, LMS
**10/20**. P0 gốc = `astryx-theme-cmc.css` ∩ `console.css` trùng **17 tên biến**, kẻ thắng do lồng DOM, mọi
test CSS là `readFileSync` một file nên không bắt được.
Tổng hợp: [`audit-260813-0052-ds-impeccable-synthesis.md`](./audit-260813-0052-ds-impeccable-synthesis.md) ·
Quyết định owner: [`decisions-owner-260813-0120-design-system.md`](./decisions-owner-260813-0120-design-system.md) ·
Plan 6 phase: [`plans/260813-0120-design-system-hardening/plan.md`](../260813-0120-design-system-hardening/plan.md).
Lưu ý khi đọc `docs/design-system-console.md`: nó **đúng** về bản đồ code (28 VERIFIED / 8 DRIFT) nhưng im
lặng về Astryx và 2 cổng CI; `docs/README.md:15,41` vẫn chỉ frontend sang TL12 (ngôn ngữ đã khai tử) — phase 05.

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
| teaching exercises | **GAP #3** — list `Công bố`/`Đóng`; no detail form | **only residual list-HITL UI** |

### Notes

- Check-in list is index-only; form owns Duyệt/Từ chối (`check-in-ticket-detail.tsx`, route `hr/checkin/:ticketId`).
- Rewards list index-only; form owns lifecycle.
- **Only residual dual-HITL product UI:** teaching exercises (`apps/admin/src/pages/teaching/exercises.tsx`).
- TEKY `#00a09d` gone after `2947d6a`.

---

## Residual next steps

1. **GAP #3** exercises form-depth (resource-centric) — remaining list HITL.
2. LMS student/spine journeys still open in acceptance (P2 teaching flows) — product/UI, not INDEX.
3. Promote develop → main only with human OK after green required checks.
4. Keep historical `plans/*`; never mass-delete.
