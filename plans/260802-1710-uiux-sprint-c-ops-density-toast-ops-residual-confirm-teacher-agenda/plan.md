---
title: "UI/UX Sprint C — ops density, toast ops, residual confirm, teacher agenda"
description: "Polish operational admin UX after A/B + cockpit R1–R2: density, commit feedback, residual confirms, honest teacher schedule links."
status: completed
priority: P1
effort: "0.5–1d"
tags: [ui, ux, admin, toast, confirm, density]
created: 2026-08-02
blockedBy: []
blocks: []
---

# UI/UX Sprint C — ops density, toast, residual confirm, teacher agenda

## Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Ops screens feel denser; money/link/enroll commits show toast; reject-link + enroll need confirm; teacher cockpit links into attendance with preselected class (honest labels). |
| **Constraints** | No shadcn/Tailwind; map to `@cmc/ui` + Astryx; CMC tokens; no payroll ConfirmDialog; no new BI; no new API unless C4 blocked (prefer query deep-link). |
| **Non-goals** | LMS toast; dark mode; overflow menus everywhere; session-today API; PageHeader soft-card redesign; conversion % funnel charts. |
| **Acceptance** | (1) Key ListPages use `density="ops"`. (2) receipt approve + recon dismiss/action + guardian approve/reject + enroll toast on success. (3) guardian reject + enroll behind ConfirmDialog. (4) cockpit class rows → `/teaching/attendance?classBatch=…`; attendance hydrates from URL. (5) unit tests + typecheck green; browser smoke. |

## Research / advise (synthesis)

**Sources:** scout 2026-08-02; `PAGE-FRAMES.md` §7 Next; sprint A/B complete; cockpit WorkInbox/StageFunnel shipped; interaction report toast/confirm gaps.

| Finding | Decision |
|---------|----------|
| `density="ops"` exists, **0** call sites | Apply on high-traffic lists only (finance, users, parents, teaching lists, recon, engagement, admin lists). |
| Toast only on teaching | Extend to finance approve, recon, guardian, enroll, KPI success (cheap). |
| Reject link / enroll no confirm | Add ConfirmDialog; approve already modal. |
| Teacher "hôm nay" is batch window | Honest title + deep-link classBatch; defer real session agenda API. |
| Approach | **B — deepen existing frames** (same as cockpit research). No new shell. |

**Advise:** Ship C1–C4 in one cook pass; C4 without backend is still high ROI for GV 30s loop.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Start / contract lock](./phase-01-start.md) | done when plan accepted |
| 2 | [Ops density ListPage](./phase-02-ops-density-listpage.md) | pending |
| 3 | [Toast on ops commits](./phase-03-toast-on-ops-commits.md) | pending |
| 4 | [Residual confirm matrix](./phase-04-residual-confirm-matrix.md) | pending |
| 5 | [Teacher agenda honesty + deep-link](./phase-05-teacher-agenda-honesty-deep-link.md) | pending |

## Red-team (inline)

| Attack | Verdict |
|--------|---------|
| Toast spam | Only **commit** mutations; not filters/toggles. |
| Confirm fatigue | Only reject + enroll; not attendance toggles. |
| Payroll confirm creep | Explicit non-goal; leave payroll tests. |
| C4 API fan-out | Rejected for sprint; use `?classBatch=` only. |
| Density breaks sticky header | `.tpl-wrap--ops` only reduces padding; keep sticky PageHeader. |

## Validate (critical questions)

1. **Does ops density change layout contracts?** No — same ListPage slots.  
2. **Toast + Banner double feedback?** Prefer toast only where Banner is commit success; keep error Banner. Receipt approve already has ResultPanel — toast OK as secondary transient.  
3. **Attendance dirty leave + URL hydrate?** Hydrate once on mount; dirty still leave-guards.  
4. **Tests?** Extend parents/enroll/receipt where patterns exist; ListPage density unit test.

## Success criteria

- [x] `density="ops"` on ≥8 ListPage call sites (13 pages)
- [x] Toast after receipt approve, recon action/dismiss, guardian approve/reject, enroll, KPI confirm/bulk
- [x] ConfirmDialog on guardian reject + class placement enroll
- [x] Cockpit teacher secondary honest + deep-link; attendance reads `classBatch` (+ optional `session`)
- [x] `pnpm --filter @cmc/ui test` (58) + admin typecheck green; focused admin tests 39 pass
- [x] Browser smoke: `.tpl-wrap--ops` on finance/attendance; cockpit `?classBatch=`; attendance preselect

## Rollback

Revert phase files independently; no migrations.

<!-- slug: uiux-sprint-c-ops-density-toast-ops-residual-confirm-teacher-agenda -->
