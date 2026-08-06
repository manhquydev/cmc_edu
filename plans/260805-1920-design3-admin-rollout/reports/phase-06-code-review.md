# Code Review — Phase 6 Cleanup / Premium Retirement / Docs

Date: 2026-08-06  
Reviewer: staff-engineer (read-only)  
Plan: `plans/260805-1920-design3-admin-rollout/phase-06-cleanup-premium-retirement-docs.md`

## Code Review Summary

### Scope
- Files (verified claims):
  - `packages/ui/src/odoo.css` — Phase 6 premium mirror under `.o_web_client` (~L1472–end)
  - `packages/ui/src/premium.css` — left for LMS
  - `apps/admin/src/main.tsx` — premium import removed; odoo.css only
  - `apps/lms/src/main.tsx` — still imports premium.css
  - `apps/admin/src/routes/index.tsx` — no design routes; no pathname allow-list
  - `apps/admin/src/shell/shell.tsx` — no design-lab palette entries
  - `scripts/check-ui-frames.mjs` — EXEMPT reduced to login/change-password/coming-soon
  - `docs/design-system-odoo.md`, `docs/12-design-system-ui.md`
  - Plan status completed; census report stale
- LOC: odoo.css ~3.7k (mirror adds ~2.2k); structural deletions of design-lab*
- Focus: Phase 6 unit-testable acceptance (a–e) + mirror-vs-rename risk
- Scout findings: **ToastViewport mounts outside `.o_web_client`**; float-layer scoping trap; docs half-stale; candidate doc not deleted; acceptance/ui-e2e still open

### Overall Assessment

Phase 6 delivers the intended *shape* of PR A/B/C at unit level: admin drops `premium.css`, LMS keeps it untouched, design-lab routes/pages are gone, RequireAuth no longer has a pathname allow-list, and TL12/odoo status banners say rolled-out. The retirement strategy is a **full selector mirror** under `.o_web_client`, not class rename to zero census — that is a valid pragmatic shortcut **only if every `ck-*` consumer is a DOM descendant of `.o_web_client`**. It is not: `ToastProvider` in admin `main.tsx` renders `ToastViewport` as a **sibling** of the router tree, so `.o_web_client .ck-toast*` never matches. That is a production-visible style regression CI will not catch (e2e is role/text). Docs claim "rolled out" while body still describes candidate-era `/design3` readiness gaps; `system-architecture.md` was not updated; candidate file remains.

**Score: 5.5/10**

### Critical Issues

1. **Admin toasts lose all premium styling after dropping `premium.css`**
   - Evidence:
     - `ToastProvider` wraps `SessionProvider`/`RouterProvider` in `apps/admin/src/main.tsx:43-47`.
     - `ToastViewport` is a **sibling** of `{children}` in `packages/ui/src/components/toast.tsx:118-122` (`className="ck-toast-viewport"`).
     - Shell root is `.o_web_client` inside the router (`shell.tsx:127`), not an ancestor of the viewport.
     - Mirror rules are descendant-scoped only: `odoo.css` `.o_web_client .ck-toast-viewport` / `.ck-toast*` (~L2235–2259).
   - Impact: success/error/info toasts across admin (grading, placement, students, parents, classes, …) render without `position: fixed`, card chrome, z-index, or tone border — "CI green, prod broken" pattern the phase file itself warned about.
   - Fix (pick one, prefer smallest):
     1. **Unscope float layers** in the mirror: emit bare `.ck-toast*`, `.ck-cmd*` (cmd is already inside shell but safe unscoped), any other fixed overlays; keep in-tree composites scoped if desired; **or**
     2. Move `ToastProvider` **inside** `Shell` under `.o_web_client`; **or**
     3. Put a host class on `document.documentElement` / `#root` (e.g. `o_web_client` on root) and scope from there.
   - Add a regression test: mount ToastProvider + shell, fire toast, assert computed `position` of `.ck-toast-viewport` is `fixed` (jsdom limited — at least assert selector match via `closest('.o_web_client')` or unscoped CSS presence).

### High Priority

2. **Mirror approach structural trap (class of bugs, not one-off)**
   - Any future portal/`createPortal`/provider sibling that emits `ck-*`/`tpl-*`/`sh-*` will silently go naked under scoped mirror.
   - Today CommandPalette is safe (rendered inside `.o_web_client` in `shell.tsx:144-149`). Toast is not. Astryx `AlertDialog` uses its own styles — OK.
   - Full **class rename** (`ck-` → `o-` on components + CSS) would not have this mount-point dependency; mirror does.

3. **Docs incomplete vs decision 9 (re-implementation source after `/design3` delete)**
   - `docs/design-system-odoo.md` banner: "rolled out for admin" ✓
   - Body still: "Built & verified in /design3", readiness "NOT ready / Integration with production AppFrame/SideNav", token table still says `/design3` — **stale and contradictory**.
   - `docs/system-architecture.md`: **no** Odoo shell / design3 update (phase PR C required shell section).
   - `docs/design-system-odoo-candidate.md` still present (phase said delete); still points at live `/design3`.
   - `docs/codebase-summary.md` mentions OdooNavbar in package line but still premium-era framing elsewhere.

4. **Acceptance + visual smoke not closed** (plan already marks open — reaffirm as merge blockers)
   - Phase success criteria unchecked: full ui-e2e, acceptance per-flow vs Phase 1 baseline.
   - Census report `phase-06-premium-census.md` still says **do not** drop premium import — evidence was not updated after the mirror strategy; gate "census = 0 unported" was **replaced** without rewriting the census artifact.

### Medium Priority

5. **Dual CSS systems + drift risk (mirror vs rename)**
   | Risk | Mirror (shipped) | Full class rename |
   |------|------------------|-------------------|
   | LMS isolation | Good if scope holds; float escape fails | Excellent if LMS never gets `o-*` |
   | Bundle / maintain | ~2.2k duplicated rules; every premium fix needs dual edit or LMS/admin drift | One source of truth per class family |
   | Specificity | Higher (`.o_web_client .ck-x`); fights unscoped partial ports already in odoo.css (~L755–1330 `.ck-pnl`, `.ck-callout`, …) | Cleaner |
   | Mount/portal safety | **Fragile** (this review's critical) | Robust |
   | Effort | Low short-term | High (231+ tokens in components per census) |
   | Goal 4 spirit ("port then retire") | Met only as "copy-paste retire import" | True retirement of premium class language on admin |

6. **Inconsistent scoping inside `odoo.css` itself**
   - Pre-Phase-6 blocks ship **unscoped** `.ck-pnl`, `.ck-callout`, `.ck-av`, … while Phase 6 mirror scopes the full premium set under `.o_web_client`.
   - Header comment still says import odoo **after premium.css** (`odoo.css:8`) — stale; admin no longer loads premium.
   - Component source comments still say `Requires @cmc/ui/premium.css` (Panel, CommandPalette, Toast consumers path, etc.) — admin is now odoo-only.

7. **Stale design corpus outside docs/**
   - `design-system/cmc-edu/VIEW-GRAMMAR.md` / `STRUCTURE.md` still reference `/design` lab routes.
   - Not blocking runtime; confuses future agents.

### Low Priority

8. Package barrel comments in `packages/ui/src/index.ts` still require premium.css for templates — misleading for admin authors.
9. `ck-inv` (design-lab inventory helper styles) remain in odoo.css after lab deletion — dead weight.
10. `@keyframes ck-sc-pulse` correctly left unscoped (keyframes cannot be namespaced under a class) — good; no issue.

### Edge Cases Found by Scout

1. **Toast outside shell** — confirmed critical (above).
2. **Login outside Shell** — login does not use `ck-*` markup; OK under current pages.
3. **Chrome-suppressed change-password** — still under `.o_web_client`; templates OK; toast still broken globally.
4. **LMS** — only `import '@cmc/ui/premium.css'`; no odoo.css; no AppFrame usage in LMS pages surveyed; **premium file not mutated** → LMS contract intact for this phase.
5. **RequireAuth allow-list removal** — correct; design routes gone → no auth-bypass ComingSoon trap (phase risk addressed).
6. **check-ui-frames EXEMPT** — design-lab names removed; only login/change-password/coming-soon remain — matches claim.
7. **AppFrame/SideNav** — absent from `apps/admin/src` production shell (only negative test name); components still exported from `@cmc/ui` for LMS/potential reuse — OK.

### Positive Observations (risk calibration only)

- Design-lab deletion is complete under `apps/admin` (0 matches for design-lab / `/design` routes).
- Admin/LMS CSS import split is the right boundary if float layers are fixed.
- Leaving `premium.css` byte-stable for LMS is correctly enforced by "copy into odoo, don't move."
- Phase 6 plan itself documents the visual/acceptance residual gates honestly in unchecked success criteria.

### Claim verification (a–e)

| # | Claim | Verdict |
|---|--------|---------|
| (a) | Acceptance met for Phase 6 **unit-testable** items | **Partial.** Import drop + lab delete + RequireAuth + banners: met. Unit-testable style integrity for toast: **fail**. Census gate rewritten without updated evidence. |
| (b) | No business logic regression | **Pass** for domain/API (phase is CSS/docs/cleanup). Auth surface **improved** (allow-list gone). |
| (c) | LMS premium contract intact | **Pass.** `apps/lms/src/main.tsx` still imports premium; file not required to change; LMS pages stay on primitives + premium. |
| (d) | Patterns | **Mixed.** Scoped mirror is intentional but incomplete vs mount graph; dual unscoped+scoped rules; docs pattern half-finished. |
| (e) | Tests | **Weak.** No test proves scoped mirror reaches ToastViewport; no visual/e2e gate run; shell tests check presence of `.ck-cmd` not computed styles. |

### Done-claims checklist

| Done claim | Verified? |
|------------|-----------|
| odoo.css scoped mirror of premium under `.o_web_client` | Yes (block from ~L1472); **but** breaks out-of-shell mounts |
| admin main no premium; LMS still imports | Yes |
| premium.css unchanged (intent) | Yes by construction (not imported into mirror as file move); not re-hashed here |
| design-lab pages deleted; no allow-list; no /design routes | Yes under apps/admin |
| docs design-system-odoo rolled out; TL12 banner final | Banner yes; body/architecture incomplete |
| plan status completed | Yes in plan.md / phase-06 frontmatter — **overstates** residual critical toast + open e2e |

### Recommended Actions

1. **Block merge / reopen Phase 6 unit gate** until toast styles apply in admin (unscope float layers **or** re-parent ToastProvider).
2. Add a focused unit/integration assert for toast mount ancestry or unscoped float CSS.
3. Rewrite `docs/design-system-odoo.md` readiness sections for post-rollout truth; drop live `/design3` as verification surface; delete or archive `design-system-odoo-candidate.md`.
4. Update `docs/system-architecture.md` shell section (OdooNavbar + `.o_web_client`, no AppFrame in admin).
5. Refresh or supersede `phase-06-premium-census.md` to document mirror strategy + remaining `ck-*` emission debt.
6. Run ui-e2e + `pnpm acceptance:report` per-flow vs Phase 1 baseline before calling plan fully complete.
7. Backlog: true class rename / component port to `o-*` to retire dual language (optional; not required if mirror is fixed and drift process is explicit).

### Metrics

- Type Coverage: not re-run this review (static read-only)
- Test Coverage: no new Phase 6 style regression tests found
- Linting Issues: N/A this pass
- Critical: 1 · High: 3 · Medium: 3 · Low: 3

### Unresolved Questions

- Was visual smoke of toast ever performed after dropping premium import? No evidence in journal/census.
- Preferred fix for toast: unscoped float CSS vs move provider (product preference; both valid).

---

## Status

**Status: DONE_WITH_CONCERNS**  
**Summary:** Phase 6 unit-shape claims largely hold (import split, lab delete, banners), but the scoped premium mirror **breaks admin toasts** because `ToastViewport` is not under `.o_web_client`, and docs/acceptance close-out are incomplete.  
**Concerns:** Critical toast styling regression; mirror-vs-portal class of bugs; stale odoo design doc body + missing architecture update; ui-e2e/acceptance still open merge gates.
