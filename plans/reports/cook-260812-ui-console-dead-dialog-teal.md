# Cook report — ui-console slice A (dead dialog + TEKY teal)

**Date:** 2026-08-12  
**Worker:** Grok `ui-console`  
**Branch:** `feat/lms-foundation-unit-range-spike` (PR #110 tip was `8a19673`)  
**Mode:** `ak:cook --auto --tdd`  
**Authority:** `docs/ux-resource-centric-structure.md`, `docs/design-system-console.md`,  
`plans/reports/brainstorm-advise-260812-herdr-ui-workspace-coord.md`

---

## Brainstorm contract (slice)

| Field | Content |
|-------|---------|
| **Outcome** | Dead dual-HITL aftersale list dialog gone **or** proven still required; shifts compose free TEKY teal replaced with CMC Console tokens. |
| **Constraints** | File ownership only (dialog + shifts + related tests). No parents link-request Duyệt demote. No API contract changes. No PR merge. |
| **Non-goals** | Redesign Odoo WS chrome, form-depth for check-in punch, rewards HITL, workspace lean docs (ui-lean). |
| **Acceptance** | Evidence for dialog keep/delete; teal hexes gone; focused vitest green; `pnpm test:ui-frames` + `ui-ratchet` green; conventional commit pushed. |

---

## Scout summary

| Item | Evidence | Verdict |
|------|----------|---------|
| `resolve-after-sale-case-dialog.tsx` | Grep: **only** imported by `apps/admin/src/pages/crm/aftersale-detail.tsx` (form UUID). Zero list (`aftersale.tsx`) imports. | **LIVE — keep** |
| GitNexus context | Index still links `AfterSalePage` → dialog (stale vs working tree). | Prefer filesystem truth |
| Shifts `WS_CSS` | `--ws-teal: #00a09d`, `--ws-teal-dark: #017e84` (TEKY free makeup) | **Tokenize** |
| CMC tokens | `packages/ui/src/tokens.css`: `--cmc-brand`, `--cmc-brand-hover` (Console interactive accent) | Map accent only |

**Not blocked by ui-lean** (docs/index ownership elsewhere). Dialog not dead → **do not delete**.

---

## Work performed

### 1) Aftersale resolve dialog — STOP keep (not dead)

Form-depth demote already removed list HITL; resolve remains the form action surface via dialog on `aftersale-detail`. Deleting would break form “Giải quyết”.

| Action | Result |
|--------|--------|
| Delete dialog | **Skipped** (still referenced) |
| Remove imports | N/A |

Residual matrix update: mark dialog **form-owned, not dead**.

### 2) Shifts compose TEKY teal → CMC tokens (TDD)

| Step | Detail |
|------|--------|
| RED | `shifts-ws-css-tokens.test.ts` failed on `#00a09d` / `#017e84` and missing `var(--cmc-brand*)` |
| GREEN | Root aliases only: `--ws-teal: var(--cmc-brand)`; `--ws-teal-dark: var(--cmc-brand-hover)` |
| Scope | No class/structure redesign; remaining `#dee2e6` etc. left as local sheet neutrals |

**Files touched**

- `apps/admin/src/pages/attendance/shifts.tsx` — WS_CSS accent aliases + comment
- `apps/admin/src/pages/attendance/shifts-ws-css-tokens.test.ts` — source lock (new)

**GitNexus impact (pre-edit):** `SubmitTab` upstream **LOW** (style constant only; behavior unchanged).

---

## Validation

| Check | Result |
|-------|--------|
| `vitest` shifts-ws-css-tokens + shifts + shifts-detail | **21/21 pass** |
| `pnpm test:ui-frames` | **3/3 pass** |
| `node scripts/ui-ratchet.mjs` | **0 violations** |
| Parents link-request | Untouched |
| API contracts | Untouched |

---

## Residual / handoff

1. **Dialog keep is correct** for resource-centric form HITL; optional later: inline resolve on detail without dialog (product), not “dead code cleanup”.
2. Shifts list still has **Hàng chờ** tab + open-row (OK index); optional FilterBar single list later.
3. Check-in `manualPunch` row Duyệt and engagement rewards remain residual dual-HITL (out of this ownership).
4. Neutral hexes inside `WS_CSS` (borders/grays) still free; only TEKY teal was in scope.

---

## Status

**DONE_WITH_CONCERNS** — teal cook landed; dialog not removable (still form-used).  
**Concerns:** GitNexus index stale for aftersale callers until re-analyze.
