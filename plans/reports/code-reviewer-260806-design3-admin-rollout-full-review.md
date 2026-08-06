# Code Review — Design3 Admin Rollout (full branch)

Date: 2026-08-06  
Reviewer: staff-engineer / code-reviewer (read-only)  
Branch: `feat/ui-copy-standard`  
Range: `754df470` (parent of first design3 commit) → `5b515c67` (HEAD)  
Plan: `plans/260805-1920-design3-admin-rollout/` (status: **completed** — disputed)  
Prior: `plans/260805-1920-design3-admin-rollout/reports/phase-06-code-review.md` (CRITICAL toast)

## Code Review Summary

### Scope

| Item | Value |
|------|--------|
| Files (range) | 100 files · +7368 / −13129 (net deletion dominated by design-lab purge) |
| Code surfaces | `apps/admin`, `packages/ui` (odoo layer + template reskin), `apps/e2e` (menu-nav + binders), `scripts/check-ui-frames.mjs`, docs |
| Commits (design3) | 15 (`ba4f782`…`5b515c6`) |
| Focus | Shell swap · CRM pilot · finance/teaching/classes/enrollment sweeps · premium retirement · design-lab deletion · toast float-layer fix · LMS isolation · docs honesty · merge gates |
| Scout findings | Toast mount outside `.o_web_client` (fixed in `29bc469`); cmd palette actually *inside* shell; only two `position:fixed` premium float families; docs body contradicts "rolled out"; ui-e2e/acceptance never closed |

### Overall Assessment

**Score: 6.7 / 10**

The branch delivers the architectural shape of the design3 contract: Odoo navbar shell, shared template `o-*` reskin, CRM list↔kanban pilot, module residual sweeps, design-lab deletion, admin `premium.css` import drop via scoped mirror, LMS left on premium only. Unit-level shell/CRM/finance tests exist and are purposeful. Commit `29bc469` **does fix** the Phase 6 CRITICAL toast regression by unscoping `.ck-toast*` / `.ck-cmd*`.

It is **not** production-complete under the plan's own success criteria. Plan frontmatter and docs banners say "completed / rolled out" while every plan-level success checkbox is still open, `docs/design-system-odoo.md` still claims AppFrame integration is NOT ready and `/design3` is live, `system-architecture.md` was not updated, acceptance baseline is an unchecked flow-id list with no re-run evidence, and full `ui-e2e` remains an open merge gate on Phases 2–6. Mirror strategy remains a structural trap class (one fix applied; no regression test).

**Verdict:** unit-shape work is real; done-claims and merge-readiness are overstated.

---

### Critical Issues

**None remaining for the toast mount bug after `29bc469`.**

| Prior CRITICAL | Status after `29bc469` |
|----------------|------------------------|
| Admin toasts lose all premium styling (viewport sibling of `.o_web_client`) | **FIXED** — see verification below |

#### Toast fix verification (`29bc469`)

Evidence:

1. **Mount graph still as Phase 6 described**
   - `ToastProvider` wraps router in `apps/admin/src/main.tsx:43-47`.
   - `ToastViewport` is sibling of `{children}` (`packages/ui/src/components/toast.tsx:120-121`, class `ck-toast-viewport` at L145).
   - Shell root is `.o_web_client` inside the router (`apps/admin/src/shell/shell.tsx:127`), not an ancestor of the viewport.

2. **Selectors unscoped in `odoo.css`**
   - `.ck-toast-viewport` / `.ck-toast*` at `packages/ui/src/odoo.css:2235-2259` — bare selectors, not `.o_web_client .ck-toast*`.
   - `.ck-cmd*` at `packages/ui/src/odoo.css:2750-2811` — bare.
   - Grep residual: `o_web_client .ck-toast|o_web_client .ck-cmd` → **none**.

3. **Token resolution for unscoped toast**
   - Toast rules use `--cmc-*` (`--cmc-surface-raised`, `--cmc-shadow-lg`, `--cmc-radius-lg`, …).
   - Those live on `:root` in `packages/ui/src/tokens.css` (admin still imports tokens at `main.tsx:16`).
   - Fixed positioning + z-index + tone borders will apply outside the shell.

4. **Command palette note (commit message imprecision)**
   - Commit claims both ToastProvider *and* CommandPalette mount as siblings of `.o_web_client`.
   - **Toast: true.** **CommandPalette: false** — rendered *inside* `.o_web_client` at `shell.tsx:144-149`.
   - Unscoping cmd is still correct (defensive) and does not break LMS (LMS does not import `odoo.css`).

5. **Residual float census**
   - Only two `position: fixed` blocks remain in `odoo.css` (toast viewport L2236, cmd L2751).
   - No other premium fixed overlays found under `packages/ui`.
   - Astryx `AlertDialog` / `Dialog` use their own styles (not `ck-*` mirror) — out of mirror trap class for this CSS strategy.

**Gap still open:** no automated test asserts that toast CSS applies after premium retirement (only DOM class presence in `toast.test.tsx`). Visual regression remains human/CI-e2e blind.

---

### High Priority

#### H1. Plan/docs claim "completed / rolled out" while success criteria and merge gates are open

Evidence:

| Claim surface | Says | Reality |
|---------------|------|---------|
| `plan.md` frontmatter | `status: completed` | All 5 Success Criteria checkboxes unchecked (`plan.md:127-144`) |
| Phase table | Phases 1–6 completed | Phases 2/3/4/5 explicitly note **ui-e2e merge gate open** |
| Phase 6 SC | unit items `[x]`; e2e/acceptance `[ ]` | Honest in phase file, contradicted by plan status |
| `docs/design-system-odoo.md:5` | "rolled out for admin" | Body still candidate-era readiness (below) |
| `docs/12-design-system-ui.md:8-13` | Superseded-for-admin banner | Banner OK; architecture doc not updated |

Impact: operators and future agents treat the branch as mergeable/done when the plan's own non-negotiable gates (`typecheck-and-test` + `ui-e2e` per phase; acceptance per-flow vs Phase 1 baseline) have no evidence of closure on this branch.

#### H2. `docs/design-system-odoo.md` fails decision 9 (re-implementation source after `/design3` delete)

Decision 9: after deleting `/design3`, this doc must be sufficient to re-implement. Banner says rolled out; body still:

- `### Built & verified in /design3` (`docs/design-system-odoo.md:124`)
- `✗ Integration with production AppFrame/SideNav` (`:187-190`) — **false** post shell swap
- `✗ Component library changes: /design3 uses page-scoped CSS` (`:192`) — **false**; `packages/ui/src/odoo*` exists
- Links to deleted `apps/admin/src/pages/design-lab-3.tsx` as "Live React component (route `/design3`)" (`:250`)
- Footer: "rollout is in progress" (`:267`) while banner says complete

Also required by Phase 6 PR C and **not done**:

- `docs/system-architecture.md` — still Phase-3 AppShell/SideNav narrative; **one** hit for Odoo/design3 language and it is the old Astryx migration paragraph (`:84` region). No OdooNavbar / `.o_web_client` shell section.
- `docs/design-system-odoo-candidate.md` still present (phase said delete after promote).

#### H3. Full `ui-e2e` + acceptance baseline not proven on this branch

Evidence:

- Phase 1 baseline file lists 38 flow ids, all unchecked (`reports/baseline-acceptance-flows-phase1.md`).
- No Phase 6 acceptance re-run artifact in `reports/`.
- E2E contracts were updated (good): `menu-nav.ts` rewritten for app-switcher; binders retarget `main.o-main`; `admin-shell.ui.spec.ts` pins Odoo chrome; CRM journey smokes list↔kanban (`crm-receipt.journey.ui.spec.ts:76-81`).
- `assertEntryAbsent` was carefully rewritten with settle-wait on "Tổng quan" (`menu-nav.ts:115-158`) and is used by `gift-config-nav` — shape addresses red-team Critical #2.
- **None of that is a green CI run.** Plan red-team itself called E2E blast radius Critical; cook progress notes leave gate open.

Impact: highest real production risk of the branch — shell + 30 menuNav call sites + 7 direct binders. Unit tests cannot substitute.

#### H4. Mirror strategy is "import retired," not "premium language retired" — residual trap class

Evidence:

- Admin: `import '@cmc/ui/odoo.css'` only (`main.tsx:19-22`); no `premium.css`.
- LMS: still `import '@cmc/ui/premium.css'` (`apps/lms/src/main.tsx:20`); **no** `odoo.css`.
- `premium.css` diff in range: **0 lines** (LMS contract held).
- Mirror: ~2.2k lines copied under `.o_web_client` into `odoo.css` (~3748 LOC total).
- Census gate rewritten: `phase-06-premium-census.md` originally said **do not** drop premium import; follow-up note (`:101-105`) documents mirror + toast/cmd exception after the fact.
- Components still emit `ck-*` (FunnelBar `ck-fn` in `pipeline.tsx:453`, toast, cmd, Panel, etc.). Admin relies on descendant scope for in-tree composites.

Impact:

- Any future portal / provider sibling emitting `ck-*`/`tpl-*`/`sh-*` will go naked again unless unscoped or re-parented.
- Dual maintenance: LMS premium fixes do not auto-flow to admin mirror (and vice versa).
- Goal 4 spirit ("port then retire") met only as copy-paste retire import.

Not a merge blocker by itself after toast fix, but it is the architectural debt the branch chose over class rename.

---

### Medium Priority

#### M1. No regression test for float-layer CSS after premium drop

`toast.test.tsx` asserts class names and a11y roles only. Shell tests open `.ck-cmd` and check text (`shell.test.tsx:157-171`). Nothing asserts:

- presence of unscoped `.ck-toast-viewport { position: fixed }` in loaded CSS, or
- `ToastViewport` not requiring `.closest('.o_web_client')`.

Recommended minimal guard: unit test that reads a known rule from the bundled odoo CSS string, or integration assert that `getComputedStyle` is fixed when a real stylesheet is injected in jsdom (harder). At minimum: static test that `odoo.css` matches `/^\.ck-toast-viewport\s*\{/m` without `.o_web_client` prefix.

#### M2. CRM kanban nested interactive controls (carried from Phase 4)

`pipeline.tsx:116-210`: outer `div role="button"` wraps real `<Button>`s (advance / mark lost / schedule / enroll) with `stopPropagation`. WCAG nested interactive; keyboard ambiguity. Phase 4 review already filed; not fixed. Not a stage-machine bug.

Positive residual from Phase 4: list `SOURCE_LABELS` mapping **is** present (`pipeline.tsx:355-358`); double-count header fixed (`title={stage.label}` + `count={count}` at `:478`).

#### M3. OdooNavbar app-switcher UX/a11y incomplete

`odoo-navbar.tsx:33-90`:

- No outside-click close, no Escape handler, no focus trap.
- Switcher stays open until a tile is clicked or toggle re-clicked.
- `isChildVisible` is **required** (good — addresses SideNav fail-open red-team finding); unit test covers gated child hide (`shell.test.tsx:126-133`).

Acceptable for v1 shell if known; not production-polished chrome.

#### M4. Inconsistent scoping / stale comments inside `odoo.css` and barrels

- File header (`odoo.css:6-8`): claims custom properties scoped under `.o_web_client` only and "document-global selectors are forbidden"; then ships hundreds of unscoped `.o-navbar`, `.o-kanban-*`, `.ck-pnl` (pre-mirror block ~L670+), plus unscoped float layers.
- LMS isolation today is **import discipline**, not selector scoping purity. Correct for current consumers; comment is false.
- Header still says "Import … after premium.css" — admin no longer loads premium.
- Component comments still say `Requires @cmc/ui/premium.css` (e.g. `command-palette.tsx:27`, barrel notes in `index.ts`).

#### M5. Phase 5 process vs user decision "1 module = 1 PR"

User decision 6: ~12 PRs. Landed as discrete commits on one branch (finance, teaching, classes, enrollment + CRM residual; remainder "template-covered"). Code quality of sweeps is fine; process debt means less independent CI signal per module. `phase-05-module-sweep-status.md` documents this honestly.

#### M6. Finance cancelled statusbar — logic good, proof is unit-only

`workflowFor` appends terminal "Đã hủy" (`receipt-detail.tsx:40-49`); tests assert cancelled is current and draft is not (`receipt-detail.test.tsx:148-169`). Correct domain fix vs clamp-to-draft bug. No e2e coverage of cancelled chrome.

#### M7. Teaching `ck-fc` → `o-fc` collision fix is real and admin-local

Calendar classes renamed so FocusCard's `ck-fc*` premium rules no longer paint FullCalendar (`soft-ops-fullcalendar.css`, schedule). CSS lives in admin component + `odoo.css` empty-state — LMS cannot import. Good.

#### M8. Unscoped `.ck-toast*` / `.ck-cmd*` load on every admin page including `/login`

Login does not emit those classes today → no visual issue. If a future login toast fires, styles apply (good). If LMS ever co-imports `odoo.css` by mistake, float rules + unscoped `.o-*` would fight premium — process risk only.

---

### Low Priority

1. `docs/design-system-odoo-candidate.md` still present; points at deleted `/design3`.
2. Dead design-lab inventory styles (`ck-inv*`) may remain in odoo.css after lab deletion.
3. Barrel `index.ts` still documents premium.css requirement for templates that now emit `o-*`.
4. App-switcher tiles are text+icon list; design doc body still debates "vertical text-list vs icon grid" as lab-era open question while production ships one shape.
5. `RoleSwitcher` PROD early-return still present (`role-switcher.tsx:21`) with source-gate unit test — good; unchanged risk.

---

### Edge Cases Found by Scout

1. **Toast outside shell** — CRITICAL fixed by `29bc469`; residual = missing regression test.
2. **CommandPalette inside shell** — commit message wrong; unscoping harmless.
3. **Login outside Shell** — loads `odoo.css` globally; no `ck-*` markup on login → OK.
4. **Chrome-suppressed change-password** — path-only suppress (`shell.tsx:45-47`); still under `.o_web_client`; server still does not enforce staff `mustChangePassword` (documented pre-existing).
5. **LMS isolation** — verified: LMS premium only; premium.css untouched; no odoo imports under `apps/lms`.
6. **RequireAuth allow-list** — removed (`routes/index.tsx:30`); design routes gone; no ComingSoon auth-bypass trap.
7. **AppFrame/SideNav** — zero production usage under `apps/admin/src` (only negative test name in `shell.test.tsx:150`).
8. **FilterBar name** — preserved (`filter-bar.tsx:26`); `check-ui-frames.mjs` still asserts `FilterBar` string match; EXEMPT reduced to login/change-password/coming-soon.
9. **assertEntryAbsent ghost-pass class** — mitigated with switcher settle + section-menu positive wait; still needs live canary red proof on CI.
10. **Kanban color CSS vars** — defined under `.o_web_client` only; cards inside shell resolve; cards outside would lose color bar (no current mount outside).

---

### Spec compliance vs plan success criteria

| Criterion (plan.md) | Verdict |
|---------------------|---------|
| Every post-login route (incl. change-password) renders Odoo shell; no AppFrame/SideNav in admin shell | **Met (unit/static)** — `shell.tsx`, grep, shell tests. E2E not closed. |
| Odoo layer in `packages/ui/src/odoo*`; design-lab-3 not source of truth; `/design3` deleted | **Met** — lab files gone; `odoo.css` + navbar + kanban exported. |
| E2E no journey regression vs main; typecheck-and-test green each PR; assertEntryAbsent canary | **Unproven** on this branch. Code adapted; CI evidence missing. |
| acceptance:report per-flow vs Phase 1 baseline still pass | **Unproven** — baseline list exists; re-run absent. |
| Docs: TL12 superseded-for-admin; design-system-odoo "rolled out"; system-architecture updated | **Partial** — banners yes; body + architecture **fail**. |

| Phase unit claims | Verdict |
|-------------------|---------|
| Phase 1 odoo layer + tests | Met (`odoo-navbar`, `odoo-kanban`, tokens/astryx remap tests) |
| Phase 2 shell swap + permission gate + chrome suppress | Met (unit) |
| Phase 3 template/archetype `o-*` reskin; FilterBar name kept | Met |
| Phase 4 CRM kanban + list + `?view=` + shared listInput | Met (unit + e2e smoke *code*) |
| Phase 5 module sweeps / template-covered remainder | Met as documented (not 12 PRs) |
| Phase 6 premium import drop + lab delete + auth allow-list | Met unit-shape; float fix landed; docs incomplete |

---

### Coverage assessment

| Layer | What exists | Gap vs behavioral risk |
|-------|-------------|------------------------|
| **Unit** | OdooNavbar, Kanban, tokens/astryx remap; shell chrome/permission/⌘K; pipeline tests (pre-existing + switcher); receipt cancelled statusbar; schedule kanban/calendar class rename; RoleSwitcher PROD source gate | No float-layer CSS regression; optimistic CRM advance not re-rendered in mocks; visual density untested |
| **E2E (code)** | menu-nav rewrite; admin-shell Odoo pins; journey binders → `main.o-main`; CRM view switcher smoke; gift-config assertEntryAbsent | **Not proven green** on branch; highest risk surface |
| **Acceptance** | Phase 1 flow-id inventory (38) | Zero re-run vs baseline; all boxes open |
| **Visual / human** | Phase 6 plan requires full-admin eye smoke | No evidence performed after premium drop |
| **Static gates** | check-ui-frames EXEMPT cleaned; FilterBar identifier preserved | Must re-run in CI after design-lab corpus removal |

---

### Positive observations (risk calibration only)

- Permission gate on `OdooNavbar` is required, not optional fail-open; shell unit test proves recon child hide.
- `assertEntryAbsent` settle design explicitly fights the ghost-pass class the red-team predicted.
- Finance cancelled statusbar is a real domain fix, not chrome-only.
- Teaching calendar rename removes a real class-collision bug (`ck-fc` vs FocusCard).
- Design-lab purge + allow-list removal is complete and shrinks auth attack surface.
- LMS contract held with hard evidence (import split + zero premium.css diff).
- Toast fix chose the smallest correct lever (unscoped float CSS) without re-parenting the entire provider tree.

---

### Residual risks after `29bc469`

| Risk | Severity now | Notes |
|------|--------------|-------|
| Toast unstyled | **Closed** | Unscoped + :root tokens |
| Cmd unstyled | **Closed** (was already inside shell) | Unscoped defensive |
| Future portal/`ck-*` sibling | **Open (class)** | Mirror still descendant-scoped for non-float composites |
| Dual CSS drift admin↔LMS | **Open** | Two copies of ~2k rules |
| E2E/menuNav regressions | **Open** | Code ready; CI not shown |
| Acceptance flow regression | **Open** | No re-run |
| Docs as re-implementation source | **Open** | Body stale; architecture missing |
| Nested kanban a11y | **Open** | Pre-existing Phase 4 |
| Staff forced-password server enforce | **Open** | Pre-existing; chrome suppress only |

---

### Merge readiness

## **CONDITIONAL**

Not **READY**: open plan success criteria, dishonest "rolled out" body, missing architecture update, no acceptance/e2e proof.

Not hard **BLOCK** on the toast defect (fixed) or LMS isolation (holds). Block *claims of done* and *merge to main* until the list below is closed.

### What still must run / fix before claiming done

1. **CI `typecheck-and-test` green** on this branch (includes `check-ui-frames` after EXEMPT/corpus change).
2. **CI `ui-e2e` green** vs main — no journey regression; confirm `gift-config-nav` assertEntryAbsent still meaningful.
3. **`pnpm acceptance:report`** on clean worktree; tick/annotate Phase 1 baseline flow ids that still pass; record date + SHA.
4. **Rewrite `docs/design-system-odoo.md` readiness sections** for post-rollout truth (delete live `/design3` claims; mark AppFrame integration done; point only at `packages/ui/src/odoo*` + shell).
5. **Update `docs/system-architecture.md` shell section** (OdooNavbar, `.o_web_client`, `main.o-main`, no AppFrame in admin).
6. **Delete or archive `docs/design-system-odoo-candidate.md`**.
7. **Add float-layer regression guard** (static CSS assert minimum) so the next scoped mirror cannot re-break toast.
8. **Human visual smoke** after premium drop: toast success/error, ⌘K, CRM kanban/list, finance receipt cancelled, teaching calendar — e2e will not catch naked chrome.
9. **Demote plan status** from `completed` to something accurate (`in_progress` / `validation`) until 1–3 close — or leave completed but only after evidence is filed.

Optional backlog (not merge-blocking if above closed): true `ck-*` → `o-*` class rename; app-switcher focus trap; kanban nested-button restructure.

---

### Recommended actions (priority order)

1. Run required CI checks; do not merge on unit-only green.
2. Fix docs honesty (H2) in the same merge train as "rolled out" claims.
3. Land float-layer static regression test next to `29bc469`.
4. File residual mirror drift as explicit backlog with owner process (dual-edit premium + odoo mirror, or schedule rename).
5. Keep FilterBar symbol name until `check-ui-frames` is intentionally rewritten.

---

### Metrics

| Metric | Value |
|--------|--------|
| Overall score | **6.7 / 10** |
| Critical open | **0** (1 fixed post Phase 6 review) |
| High | **4** |
| Medium | **8** |
| Low | **5** |
| Type coverage | Not re-run this pass (static read-only) |
| Test coverage | Unit solid for shell/CRM/finance/odoo primitives; **e2e/acceptance unproven** |
| Linting | N/A this pass |
| `premium.css` mutation | **0** (LMS safe) |
| Design-lab remaining under `apps/admin/src/pages` | **0** |
| Residual scoped toast/cmd | **0** |

---

### Claim verification matrix (branch-level)

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Odoo UI layer extracted to `@cmc/ui` | **Pass** | `packages/ui/src/odoo/*`, `odoo.css`, package export `./odoo.css` |
| Admin shell = Odoo navbar, no SideNav | **Pass (static/unit)** | `shell.tsx`, shell tests, e2e admin-shell code |
| Templates/archetypes reskinned `o-*` | **Pass** | ListPage/ControlBar/DataTable/PageHeader/… |
| CRM design3 kanban + list switcher | **Pass (unit + e2e code)** | `pipeline.tsx`, crm-receipt smoke |
| Finance/teaching/classes/enrollment sweeps | **Pass (scoped)** | commits `4c851dc`…`731e199` |
| premium.css retired from admin via mirror | **Pass with debt** | main.tsx + odoo mirror; toast unscoped |
| LMS keeps premium only | **Pass** | lms main.tsx; zero premium.diff |
| design-lab deleted; auth allow-list gone | **Pass** | routes, no design-lab files |
| Toast float-layer fixed | **Pass** | `29bc469` + selector audit |
| Docs complete / re-implementable | **Fail** | body + architecture |
| Plan success criteria complete | **Fail** | all top-level boxes open |
| ui-e2e / acceptance green | **Unproven** | no artifact |

---

### Unresolved questions

1. Has any full `ui-e2e` been run on `5b515c67` (or equivalent) outside this review? No artifact in plan reports.
2. Was toast visually checked after `29bc469`? No journal note beyond census follow-up text.
3. Preferred long-term exit from mirror debt: dual-edit process vs class rename program?

---

## Status

**Status: DONE_WITH_CONCERNS**  
**Summary:** Design3 admin rollout unit-shape is real and the Phase 6 CRITICAL toast regression is fixed by unscoping float-layer CSS; LMS isolation holds. Branch is not merge/done-ready while ui-e2e, acceptance baseline, and docs honesty remain open against the plan's own gates.  
**Concerns/Blockers:** CONDITIONAL merge — require CI `typecheck-and-test` + `ui-e2e`, acceptance per-flow re-run, rewrite of `design-system-odoo.md` readiness body, `system-architecture.md` shell update, and a float-layer regression guard before claiming production rollout complete.
