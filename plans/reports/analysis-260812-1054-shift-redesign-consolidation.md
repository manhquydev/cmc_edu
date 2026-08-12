# Analysis — shift/punch redesign commits vs `origin/develop@92cd677`

**Date:** 2026-08-12  
**Scope:** UI/ATTENDANCE (read-only)  
**Baseline:** `origin/develop` = `92cd677` (PR #110 merge)  
**Authority context:** form-depth S1 (`d52caa4` / check-in ticket form), WS_CSS teal→CMC (`2947d6a`), punch card polish (`9c2e415`)

---

## Executive verdict

| Commit | Branch (claimed) | On `origin/develop`? | Verdict |
|--------|------------------|----------------------|---------|
| `656172b` | `feat/shift-registration-console-redesign` | **No** | **DISCARD** |
| `96ddf9b` | `ship/shift-registration-console-redesign` | **No** (but content shipped) | **DISCARD** |

Neither commit should be re-merged onto protected `develop`. Both are either product-superseded or already landed under another SHA.

**Note:** local `develop` tip may still point at `656172b` — that is **not** `origin/develop@92cd677`. Prefer origin for authority.

---

## 1) `656172b` — simplify staff punch interface

### What it is

- **When:** 2026-08-10  
- **Files:** `check-in-out.tsx` (+75/−29 at author time), `check-in-out.test.tsx`, `app.css` (+64 punch classes), plan under `plans/260810-2148-staff-check-in-checkout-visual-simplification/`  
- **Intent:** visual simplify of **CheckInTab** only:
  - wrap clock in `.attendance-punch-clock` + label “Giờ Việt Nam (ICT)”
  - wrap result banners in `.attendance-punch-result` (`aria-live`)
  - wrap primary action in `.attendance-punch-action` (full-width 44px CTA)
  - **remove** `Card` around the clock block

### Already in develop?

**No** for the CSS/class composition. Develop **does** have a later, deliberate punch polish that **keeps** the card:

| Evidence | Source |
|----------|--------|
| `9c2e415` on develop: “large Console punch CTA card”; `data-testid="check-in-punch-card"` | `git merge-base --is-ancestor 9c2e415 origin/develop` → YES |
| develop `check-in-out.tsx` still imports `Card`, uses `check-in-punch-card` around `IctClock` | develop lines ~522–554 (FormPage CheckInTab) |
| test locks the card: `getByTestId('check-in-punch-card')` | develop `check-in-out.test.tsx:276` |
| develop `app.css` has **0** hits for `.attendance-punch-*` | `rg` on develop `app.css` |
| S1 form-depth rewrote inbox (list → **Mở phiếu**, no row Duyệt) | develop comments ~17–18, button ~377 |

So `656172b` is **not** “missing form-depth”; it is an **older alternate chrome** that predates and **conflicts with** `9c2e415` product choice (Card CTA).

### Conflict risk if merged onto `92cd677`

**Heavy** for a raw merge/cherry-pick of the whole commit.

`git merge-tree` against `origin/develop`: **changed in both** for

1. `apps/admin/src/app.css`
2. `apps/admin/src/pages/attendance/check-in-out.tsx`
3. `apps/admin/src/pages/attendance/check-in-out.test.tsx`

Develop side of `check-in-out.tsx` also carries form-depth (inbox index-only, `links.manualPunchTicket`, no list approve dialogs) that `656172b` base never saw — conflict markers are not “whitespace”, they are structural.

### Recommendation: **DISCARD**

**Why:**

1. Intentional later polish on develop (`9c2e415`) **re-introduced/kept Card** as the focal CTA; applying `656172b` would **undo** that and break the locked `check-in-punch-card` test.  
2. File already rewritten by #110 form-depth; salvage value is CSS chrome only, not a second product path.  
3. Conflict cost ≫ residual UX gain (label “Giờ Việt Nam (ICT)”, hover translate on button).

**If product later wants the ICT label / full-width button:** re-implement **as a tiny greenfield PR on develop** inside current CheckInTab + Card, do **not** revive `656172b` or the stale feature branch tip.

---

## 2) `96ddf9b` — redesign shift registration schedule

### What it is

- **When:** 2026-08-11  
- **Message:** replace row-by-row entry with date-by-shift CMC Console grid; keep submit/approval contracts.  
- **Files:** `shifts.tsx` (+468/−133), `shifts.test.tsx`, `app.css` (+260 `.shift-registration-*`), e2e journey, plan/report tree under `plans/260810-2311-shift-registration-console-redesign/`

### Already in develop?

**Yes — effectively the same patch already merged as PR #107.**

| Evidence | Detail |
|----------|--------|
| `c81af86` on develop | `feat(attendance): redesign shift registration schedule (#107)` — same subject/body |
| **Identical patch-id** for `shifts.tsx` content | `git show 96ddf9b \| patch-id` == `git show c81af86 \| patch-id` → `f0a8a805…` |
| develop still has `.shift-registration-*` in `app.css` | e.g. `.shift-registration-progress` ~:44+ |
| develop `shifts.tsx` evolved further | list/form split + `SubmitTab` + inline `WS_CSS` matrix (`ws-matrix` ~:171); teal tokens `var(--cmc-brand)` (`2947d6a`) |

`96ddf9b` is **not** an ancestor of `c81af86` (squash/merge commit topology), but the **tree delta for the feature is the same**. Post-#107 work on #110 made develop **strictly newer** than `96ddf9b`.

### Conflict risk if merged onto `92cd677`

**Heavy / regressive.**

`git merge-tree` **changed in both**:

1. `apps/admin/src/app.css`  
2. `apps/admin/src/pages/attendance/shifts.tsx`  
3. `apps/admin/src/pages/attendance/shifts.test.tsx`  
4. `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`  

Diff stat `origin/develop` vs `96ddf9b` on those surfaces is large (**develop has more**: form-depth list/inbox, detail routes, tokenized WS_CSS). Merging `96ddf9b` “forward” would fight #110 and risk **reverting** form-depth.

### Recommendation: **DISCARD**

**Why:**

1. Feature already shipped via **PR #107 / `c81af86`**.  
2. Remaining branch tip is a **stale snapshot** behind #110 (form-depth + teal token pass).  
3. No unique UI value relative to develop; consolidating would only create conflict theater.

Safe cleanup (optional, out of scope for this review): delete remote `ship/shift-registration-console-redesign` / local feat branch after confirming no open PR depends on them — **do not force-merge**.

---

## Cross-cutting

| Topic | Finding |
|-------|---------|
| Shared file collision with #110 | Both commits touch files #110 rewrote (`check-in-out.tsx` and/or `shifts.tsx` + `app.css`) |
| Form-depth | Check-in form UUID is **on develop** (`check-in-ticket-detail.tsx` present); neither redesign commit adds that |
| TEKY teal | develop already maps WS accent to CMC tokens; not a reason to revive `96ddf9b` |
| Protected develop | Any revival must be **new PR from develop tip**, not replay of pre-#110 branch tips |

---

## Decision table (for orchestrator)

| Commit | Consolidate? | Action |
|--------|--------------|--------|
| `656172b` | **No — DISCARD** | Leave out of develop; optional greenfield polish PR later |
| `96ddf9b` | **No — DISCARD** | Already in history as #107; drop ship branch tip |

---

## Status

**DONE** — both pending redesign commits assessed as **DISCARD** vs `origin/develop@92cd677` with merge-tree conflict evidence and patch-id / successor commit proof.
