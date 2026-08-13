# CMC Console — independent cross-check (Claude side)

Date 2026-08-13 · branch `develop` · read-only, no source modified
Scope: `docs/design-system-console.md` vs `packages/ui/src/**`, `apps/admin/src/**`

---

## Verdict

CMC Console is **a real design system at the frame/class layer, bolted onto a three-headed token
layer, fronted by a doc that describes only the smallest head.** Credit first, because it is
unusual: 274 `.console-*` classes defined, **zero dead** (every one referenced); `packages/ui`
component TSX contains **zero raw hex**; 363 inline `style={{}}` objects in admin contain **zero raw
px** and 184 `var(--…)` refs; and CI runs two genuine ratchets the doc never mentions
(`scripts/ui-ratchet.mjs` at zero-tolerance baseline `{}`, `scripts/check-ui-frames.mjs --strict`).
That is more enforcement than most "design systems" ever ship. But the token layer underneath is
three unreconciled namespaces — Astryx/StyleX vendor vars, `--cmc-*` (tokens.css), `--console-*`
(console.css) — that declare **the same design decision three times with three different values**
(control radius 12px / 4px / 3px; `--font-size-2xl` 24px / 18px), and **not one test compares two
files**. Every existing CSS test is `readFileSync(one file) + string-includes`, so they verify that a
declaration *exists*, never that it *wins*. Consequence: `astryx-theme-cmc.test.ts:16-24` enforces a
guarantee its own comment states ("Astryx text always renders on-scale **regardless of console.css's
own values**") that the DOM structurally cannot deliver, and `console-astryx-remap.test.ts:87` asserts
the opposite winner — two green tests, contradictory intents, nobody notices. Three tokens are
consumed that **do not exist anywhere** and ship to `dist` silently. So: system-shaped at the surface
the gates can see, large-stylesheet-shaped everywhere else.

---

## Evidence table

| Claim | Evidence |
|---|---|
| console.css is mostly a *consumer* of tokens.css, not its own token layer | 720 `var()` calls in `packages/ui/src/console.css`: **564 `--cmc-*` / 134 `--console-*` / 22 `--font-*`** (4:1 against its own namespace) |
| `--console-*` layer is thin + partly dead | 48 tokens declared `console.css:14-74`; **7 have zero consumers repo-wide**: `--console-success` `:19`, `--console-info` `:20`, `--console-warning` `:21`, `--console-danger` `:22`, `--console-spacer` `:51`, `--console-breadcrumb-padding-x` `:58`, `--console-enterprise-purple` `:16` |
| Phantom tokens ship | `--console-border`, `--console-bg-subtle` used `shifts-detail.tsx:113,114,116` — declared nowhere. `--cmc-text-supporting` used `crm/report.tsx:136` — declared nowhere; present in built `apps/admin/dist/assets/report-DzY3VSOJ.js` |
| Three conflicting control radii, one app | `--cmc-radius-control: 12px` `tokens.css:45` · `--console-radius: 4px` `console.css:46` · `.ws-btn{border-radius:3px}` `shifts.tsx:67`, `.ws-root{border-radius:2px}` `shifts.tsx:53` |
| Two font-size scales, same var names, opposite winners | `astryx-theme-cmc.css:71-82` (`lg:16px, 2xl:24px, 4xl:32px, 5xl:32px`) vs `console.css:373-384` (`lg:15px, 2xl:18px, 4xl:22px, 5xl:24px`). DOM: `<div data-astryx-theme>` `main.tsx:39` is **ancestor** of `<div className="o_web_client">` `shell.tsx:130` → inner scope wins → console values apply in 100% of in-shell admin |
| …and the two tests disagree about that | `astryx-theme-cmc.test.ts:16-24` "pins every step … regardless of console.css's own values" (presence-only assert) vs `console-astryx-remap.test.ts:87` `expect(h1fs === '18px' …)` |
| Doc omits the whole atomic layer | `grep -in "astryx\|stylex" docs/design-system-console.md` → **exit 1, zero hits**. Yet Button/TextInput/Badge/Dialog/Card/Selector/Grid all come from `@astryxdesign/core` (`primitives.ts:14-43`), peer-dep pinned `0.2.0` (`packages/ui/package.json:35-39`) |
| Doc's "Implementation surface (code authority)" table is incomplete | `docs/design-system-console.md:48-56` lists `console.css` only. Missing: `tokens.css` (152), `astryx-theme-cmc.css` (147), `primitives.ts` (43), `apps/admin/src/app.css` (314), `login.css` (238), `soft-ops-fullcalendar.css` (183), + 2 page-local CSS blobs |
| Real enforcement exists but is absent from doc's Verification table | `docs/design-system-console.md:126-131` lists 5 unit locks + e2e. Actual CI also runs `pnpm check:ui-frames && pnpm test:ui-frames` (`ci.yml:113`) and `pnpm check:ui-ratchet && pnpm test:ui-ratchet` (`ci.yml:119`) |
| No CSS linting at all | zero `stylelint` in root/`apps/admin`/`packages/ui` package.json; `eslint.config.js` has `no-restricted-imports` (BANNED_UI_IMPORTS, `:59`) and one user-facing-string rule (`:83-89`) — nothing design-token related |
| State coverage is asymmetric | `console.css`: 33 `:hover`, 5 `:active`, 8 `:disabled`, **2 `:focus-visible`**, 0 `:focus-within`. Focus net actually lives in `astryx-theme-cmc.css:135-138` — the file the doc doesn't list |
| Spacing scale is undersized vs actual design | `--cmc-space-1..4` = 4/8/16/24 only (`tokens.css:48-51`); **13 of 16** entries in `scripts/ratchet-exemptions.json` are literally "2px/12px/20px/22px/32px/80px has no spacing token" |
| Good: class layer is groomed | 274 `.console-*` defined vs 282 referenced; `comm -23` diff = **empty** (no dead classes) |
| Good: ratchet is zero-tolerance | `scripts/ratchet-baseline.json` → `"baseline": {}`; any new unexempted literal in spacing/fontSize/radius/color fails CI |

---

## Findings

### P0 — Token layer is three namespaces with no precedence enforcement

`tokens.css` `--cmc-*` (`:9-152`), `console.css` `--console-*` + Astryx-name remap (`:14-74`, `:373-430`),
and `astryx-theme-cmc.css` vendor-var bridge (`:20-82`) each independently declare radius, font-size,
color and border decisions. They **collide by name on purpose** — `--font-size-lg` is declared in
`astryx-theme-cmc.css:77` (16px) and again in `console.css:379` (15px); `--color-text-primary` in
`astryx-theme-cmc.css:27` and again `console.css:428`. Which wins is decided by DOM nesting
(`main.tsx:39` outside, `shell.tsx:130` inside), not by any rule anyone wrote down.

Every guard is single-file `readFileSync + includes`. **No test in the repo opens two CSS files and
compares them.** So the invariant that actually matters — "the resolved value at the component equals
the intended token" — is untested by construction. `console-astryx-remap.test.ts` gets closest (real
jsdom `getComputedStyle`), but it only injects `console.css` and asserts console's own numbers, so it
would pass unchanged if `astryx-theme-cmc.css` were deleted.

Cost in 6 months, concretely: a brand/density change (e.g. "make the app 1 step less dense", "round
the corners") requires editing 3 files in 3 vocabularies plus 2 page-local blobs, with no way to
verify the result other than looking at it — and the doc says visual-regression CI is an explicit
non-goal (`design-system-console.md:117`). Every such change therefore lands as a partial change: some
surfaces move, some don't, and the divergence is indistinguishable from intent because *both*
namespaces have a passing test defending their own value. That is how a design system becomes a
stylesheet: not by having bad values, but by losing the ability to change them atomically. Expect the
`--console-*` layer to keep accreting (it already has a `--console-sc-*` sub-scale at `:2173-2226` with
its own responsive tier) while `--cmc-*` ossifies, and expect the first real rebrand request to be
quoted in weeks.

**Recommendation (cheap, 1 file):** add `packages/ui/src/token-precedence.test.ts` — jsdom, inject
`tokens.css` + `astryx-theme-cmc.css` + `console.css` in `main.tsx` order, build the real nesting
(`[data-astryx-theme] > .o_web_client > el`), and assert the **resolved** value of every var declared in
more than one file. Any collision must be either asserted (deliberate override, documented) or removed.
Second: pick one namespace as canonical and make the others aliases (`--console-radius: var(--cmc-radius-…)`),
so there is exactly one number to edit.

### P1 — Three tokens are consumed but never declared; nothing can catch it

`shifts-detail.tsx:113,114,116` uses `var(--console-border, #dee2e6)` and `var(--console-bg-subtle, #f1f3f5)`;
`crm/report.tsx:136` uses `var(--cmc-text-supporting)` **with no fallback**. None of the three exists.
The first two silently render the hardcoded fallback forever — token indirection that is theatre. The
third resolves to nothing, so that table header inherits an unintended colour, and it is already in
`apps/admin/dist/assets/report-DzY3VSOJ.js`. The ratchet cannot see it (`var()` values are explicitly
skipped, `ui-ratchet.mjs:22`), no stylelint exists, TypeScript does not type CSS custom properties.

**Recommendation:** ~30-line CI script — collect every `var(--X` across `packages/ui/src` + `apps/*/src`,
subtract every `--X:` declaration (incl. inline `style` objects and CSS template literals), fail on the
remainder. Whitelist the two dynamically-constructed ones (`--console-kanban-card-color`,
`--console-kanban-color-${n}`, `console-kanban.tsx:66`). Cost: one afternoon; catches every future typo.

### P1 — Page-local CSS blobs are an escape hatch invisible to every gate

`WS_CSS` (`shifts.tsx:42`+, injected `shifts.tsx:563`) and `MATRIX_CSS` (`shifts-detail.tsx:111`, injected
`:369`) are template-literal stylesheets inside page components. `WS_CSS` alone re-implements a **complete
parallel button system** — `.ws-btn--primary/outline/ghost/danger` (`shifts.tsx:70-76`) with its own radius
(3px), own border palette (`--ws-border:#dee2e6`, `--ws-muted:#6c757d`, `--ws-bg:#f8f9fa`, `:45-48`), own
disabled state (`:69`), and a full chevron statusbar (`:83-120`) with hardcoded `#e9ecef/#868e96/#adb5bd/
#c92a2a/#fa5252/#fff5f5`. `ui-ratchet.mjs` scans **only** `style={{…}}` blocks under `apps/admin/src/pages`
(`:52,104-110`) — a CSS string is not a style object, so all of it is free. `shifts-ws-css-tokens.test.ts`
guards exactly two hex values (`#00a09d`, `#017e84`) and two aliases; the ~20 other raw values in the same
string are unguarded. Also blind: `apps/admin/src/components/soft-ops-fullcalendar.css` (183 lines, the only
non-page file in admin with raw hex), all of `packages/ui`, all of `apps/lms`.

**Recommendation:** either extend the ratchet's file walk to `*.css` + tagged CSS template literals, or
(better) move `.ws-*`/`.ws-mx` into `console.css` as `.console-workflow-*` so the existing class-layer
discipline applies. Do not leave a second button system in a page file.

### P2 — The doc oversells in four specific places

1. **"This document is the sole evergreen design authority for `apps/admin`"** (`:21`) vs
   `primitives.ts:16` `export { Button } from '@astryxdesign/core/Button'` — the doc contains zero
   occurrences of "Astryx" or "StyleX", so the authority document does not name the library that
   renders every button, input, badge, dialog and card in the app. Fix: add Astryx + `astryx-theme-cmc.css`
   + `tokens.css` to the surface table at `:48-56`, and state which layer owns which decision.
2. **Token table advertises a dead token** — `:79` `| --console-success | #28a745 | Status green |` vs
   `console.css:19` where `--console-success` is declared and consumed **zero times** repo-wide (status
   green actually comes from `--cmc-success: #2e7d32`, `tokens.css:28` — a *different* green). Same for
   `--console-info/warning/danger`. Fix: delete the dead declarations, or wire them.
3. **Token table is unrepresentative** — `:69-83` spot-checks 6 tokens, all `--console-*`, i.e. the
   namespace that supplies **19%** of console.css's own `var()` calls. A reader concludes `--console-*` is
   the token layer; it is the minority layer. Fix: lead the table with `--cmc-*`.
4. **Verification table understates the real gates** — `:126-131` lists only unit locks + e2e + a
   Phase-4 smoke report. The two mechanisms that actually stop drift day to day (`ui-ratchet.mjs`
   zero-tolerance + `check-ui-frames.mjs --strict`, `ci.yml:113,119`) are absent. This one is
   *under*selling, and it is the more damaging omission: a maintainer reading the doc will not know the
   ratchet exists and will be surprised by a red CI they can't explain.

*Fair note, since I am judging the doc:* line `:117` explicitly parks automated visual regression, and
lines `:9-12` report the smoke as "8 PASS / 2 WARN" with named residuals. The doc does **not** claim
visual coverage it lacks. The oversell is about *surface*, not about test rigor.

### P2 — Spacing scale is undersized; enforcement routes the gap into a ledger

`--cmc-space-1..4` = 4/8/16/24 (`tokens.css:48-51`). Real pages need 2, 12, 20, 22, 32, 80 —
`ratchet-exemptions.json` has 16 entries, 13 of them literally "no spacing token" for those values. The
gate is stronger than the scale it enforces, so the ledger absorbs the pressure instead of the scale.
The exemptions file's own comment records that expanding the scale was **declined** — a deliberate,
documented decision, so this is not an oversight. But the mechanical consequence is that the ledger
grows monotonically and each entry is a permanent un-tokenized value. In 6 months this is 40+ entries
and the ratchet's signal-to-noise drops.

**Recommendation:** add `--cmc-space-05: 2px`, `--cmc-space-2h: 12px`, `--cmc-space-5: 32px` (a 6-step
scale is still small and still a scale), then empty the ledger of the 11 entries those cover. Keep the
`80px auto 0` and negative-bleed entries — those are genuinely not lengths on a scale.

### P2 — Focus styling is owned by an undocumented file

`console.css` has 33 `:hover` and **2** `:focus-visible`. Keyboard visibility for the other ~31 surfaces
depends on the blanket `[data-astryx-theme='neutral'] :is(input, textarea, select, button, a, [role="button"],
[tabindex]):focus-visible { outline: 2px solid var(--cmc-brand) }` at `astryx-theme-cmc.css:135-138` — a file
the authority doc does not list. Non-semantic interactive elements (divs with click handlers) get nothing.
No WCAG 2.1 SC 2.4.7 violation proven here, but the guarantee is accidental and one refactor of the bridge
file away from disappearing. **Recommendation:** move the focus rule into `console.css` next to the hover
rules, and add it to the doc's layout grammar section.

---

## What I could not verify, and why

- **Rendered/visual truth.** Instructed not to build or run dev; no browser. Everything above is
  static-source + DOM-nesting reasoning. The `--font-size-*` precedence conclusion follows from CSS
  custom-property inheritance plus `main.tsx:39` / `shell.tsx:130` nesting, and is corroborated by
  `console-astryx-remap.test.ts:87` asserting 18px — but I did not observe a pixel.
- **Whether the tests actually pass today.** Did not run `pnpm test` (no-install/no-build constraint).
  Assertions about what each test *would* catch are read from the test source, not from a run.
- **Astryx internals.** `@astryxdesign/core@0.2.0` is StyleX-compiled; I did not read `node_modules` to
  confirm which vendor vars are honoured, so I cannot say how many of the 30 overrides in
  `astryx-theme-cmc.css:20-82` actually bind vs. are dead names. The 4 `!important` + `:has()` structural
  selectors at `:88-127` are a strong smell that the bridge is fighting the vendor, but "smell" is all
  I can support.
- **Odoo pin fidelity.** `docs/design-system-console.md:37` claims shipped CSS matches commit
  `7de220c…`; no local sparse clone present to diff against. `console-tokens.test.ts:29-32` only asserts
  the commit **string appears in the CSS header** — it verifies a comment, not fidelity. Flagging the
  test's limit, not disputing the claim.
- **LMS.** Confirmed `apps/lms/src/app.css` (85 lines) does not import `console.css` and uses `lms-*`;
  did not audit its internal consistency — out of scope.

## Unresolved questions

1. Is the `--font-size-*` override at `console.css:373-384` intentional density (Odoo dense steps) or
   drift? Both tests defend a different answer. Needs an owner decision, then one of the two must go.
2. Is `--console-*` meant to survive as a namespace, or is it a migration remnant now that 81% of
   console.css consumes `--cmc-*`? Collapsing it would remove one of the three heads.
3. Was the ratchet's omission from the doc's Verification table deliberate (different plan owner) or an
   oversight?
