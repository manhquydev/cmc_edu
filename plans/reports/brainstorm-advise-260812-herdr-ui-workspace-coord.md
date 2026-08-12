# Brainstorm + Advise — Herdr PI scout + parallel Grok (UI complete + workspace lean)

**Date:** 2026-08-12  
**Mode:** herdr coord · `--advise` · `--parallel` · `--brainstorm` · `--auto` · AgentKit skills (inline; `ak run` kits path optional)  
**Branch tip:** `8a19673` · PR #110 **MERGEABLE** (typecheck + ui-e2e green)

---

## Brainstorm contract

| Field | Content |
|-------|---------|
| **Outcome** | Admin Console is resource-centric end-to-end: one document type → one list + form UUID; residual dual-HITL and TEKY-teal free makeup removed where authority allows; agent working surface (plans/reports/docs entry) is indexable and lean without deleting history. |
| **Constraints** | Authority: `docs/ux-resource-centric-structure.md`, `docs/design-system-console.md`. No new “Duyệt *” products. Keep KPI period bulk + parents link-request list Duyệt. CI required green. Work on feature branch; no force-push main. Herdr: do not close panes we did not create. |
| **Non-goals** | Chatter, TEKY kanban clone, Odoo hash/OWL, big-bang rewrite all modules, merge PR without human OK, delete historical `plans/*` plan dirs. |
| **Acceptance** | (1) Scout matrix report path committed/writable. (2) At least one cook slice landed with unit green + push to PR #110 or follow-up PR. (3) Dead dual-HITL paths (e.g. aftersale list dialog) gone or unused. (4) Residual matrix updated with evidence. |

---

## Verified evidence (orchestrator scout, 2026-08-12)

### Done (PR #110 wave)
- Resource form-depth: shifts, KPI, aftersale, receipt refund/cancel, parents directory, sessions share.
- Demote dual HITL: aftersale + KPI lists → index; form owns lifecycle; bulk KPI kept.
- Console densify + ui-ratchet **0**; frames green; API unit-axis/CI harness hardened.

### Residual dual-HITL / inbox (honest)

| Surface | List | Form | Verdict |
|---------|------|------|---------|
| aftersale | Mở phiếu only | Tiếp nhận / Giải quyết / Đóng | **DONE** demote |
| KPI | open-row + bulk period | Xác nhận / Ghi đè | **DONE** demote |
| shifts | Hàng chờ tab + open-row | Duyệt / Từ chối | **OK** index; optional FilterBar single list later |
| check-in manualPunch | Hàng chờ still **row Duyệt/Từ chối** + dialog | no UUID form | **GAP** — form-depth or keep dialog-as-form (product) |
| parents link-request | Duyệt/Từ chối list | — | **KEEP** by owner lock |
| engagement rewards | list Duyệt/Từ chối | ? | **GAP** candidate shared workspace |
| resolve-after-sale-case-dialog | still in tree | list demoted | **DEAD?** verify imports |

### Console grammar residual
- Most lists: `ListPage density=ops`.
- Shifts compose still embeds **TEKY-like `#00a09d` WS_CSS** (authority: Console tokens, no free teal makeup).
- Opportunity detail densified earlier; re-check WorkflowStatusbar parity vs receipt/KPI.

### Workspace bloat (agent surface)
- `plans/` ~16M, **90+** dated plan dirs, **~317** reports — history OK, but no master index for “what is live authority”.
- Root noise: harness.db, design screenshots, presentation-deck, .harness-backup — do **not** mass-delete; document + optional `.gitignore` only for local noise if already ignored.

---

## Advise (counsel)

### Verdict
**GO** parallel after PR #110 green. Do **not** open a second structure debate — authority is locked. Next value is **residual matrix cook** + **agent workspace index**, not more densify theater.

### Approaches

| # | Approach | Trade-off |
|---|----------|-----------|
| A | Merge #110 only, stop | Leaves residual dual-HITL + teal CSS debt |
| B | **Parallel residual cook** (check-in form OR rewards + dead dialog + teal token pass) + scout report | Best ROI; fits --auto |
| C | Big workspace archive of all old plans | High risk of breaking plan links; YAGNI |

**Recommend B.**

### Ordered workstreams (parallel ownership)

1. **PI `scout-pi` (read-only)**  
   Multi-scope scout → `plans/reports/scout-260812-ui-workspace-residual-matrix.md`  
   Scopes: (a) dual HITL inventory + imports of dead dialogs, (b) Console grammar missing EntityHeader/WorkflowStatusbar on form pages, (c) TEKY teal / raw style residual, (d) plans/docs authority map (which files are LOCKED vs archive).

2. **Grok `ui-console` (write)**  
   After scout (or if orchestrator evidence enough):  
   - Remove dead aftersale list dialog path if unreferenced.  
   - Tokenize shifts compose WS_CSS teal → CMC tokens (or strip unused compose chrome).  
   - One next form-depth if scout ranks check-in punch ticket highest (only if UUID route exists or cheap to add).

3. **Grok `ui-lean` (write, docs-first)**  
   - Write `docs/WORKSPACE-LEAN.md` or extend docs index: live authority list + “do not invent Duyệt apps”.  
   - Optional: `plans/reports/INDEX-live-260812.md` linking current locked docs + open residual.  
   - No mass delete of historical plans.

### Non-goals reaffirmed
- Parents link-request list Duyệt stays.  
- KPI bulk period stays.  
- No merge without user.

---

## Herdr layout (this session)

| Role | Target | Kind | Tab/pane |
|------|--------|------|----------|
| Orchestrator | this Grok | grok | `w3:p6` / `w3:t6` |
| Scout | rename → `scout-pi` | pi | `w3:p8` / `w3:t8` |
| Cook A | `ui-console` | grok | split from `w3:p6` |
| Cook B | `ui-lean` | grok | second split |

Focus stays on orchestrator (`--no-focus` on splits).

---

## Handoff prompts (auto)

See live herdr prompts after spawn. Reports must land under `plans/reports/` with date `260812`.
