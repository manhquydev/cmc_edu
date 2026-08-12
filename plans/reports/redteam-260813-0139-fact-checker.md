# Red team — Security Adversary / Fact Checker

**Plan:** `plans/260813-0120-design-system-hardening/` (plan.md + phase-01..06)
**Verified against:** `/home/manhquy/.herdr/worktrees/cmc_edu/audit-design-system-impeccable` @ `develop 69ab8fc` (clean).
All paths below are relative to that worktree.

## Fact Check Table

| # | Claim (phase:location) | Evidence | Verdict |
|---|---|---|---|
| 1 | P01: `console.css` block `:371-431` is the `.o_web_client` token block | `packages/ui/src/console.css:371` `.o_web_client {` … `:431` `color-scheme: light;` `:432` `}` | VERIFIED |
| 2 | P01: 17 names collide with astryx (12 `--font-size-*` `:373-384`, 2 `--font-family-*` `:402-403`, 3 `--color-text-*` `:428-430`) | `console.css:373-384,402-403,428-430`; same 17 declared at `astryx-theme-cmc.css:27-29,60-61,70-81` | VERIFIED |
| 3 | P01: `--text-*` block at `console.css:387-426` | `console.css:387-400` (`-size`) + `:405-426` (`-weight`/`-leading`); `:402-403` font-family sits inside the cited range | VERIFIED (range impure, both parts are deleted anyway) |
| 4 | P01: `h1`–`small` at `console.css:434-441` | `console.css:434-441` exactly | VERIFIED |
| 5 | P01: comment at `astryx-theme-cmc.css:63-69` contains `--font-size-lg` (so `includes()` is unsafe) | `astryx-theme-cmc.css:64` "…(e.g. `--font-size-lg`)…" | VERIFIED |
| 6 | P01: `console-tokens.test.ts:34-41` currently *requires* the collision | `packages/ui/src/console/console-tokens.test.ts:34-42` asserts `--font-size-base: 14px`, `--text-body-size:` … | VERIFIED (path is `src/console/`, plan cites bare filename) |
| 7 | P01: `astryx-theme-cmc.test.ts:16-24` asserts an impossible guarantee; rewrite to require `var(--cmc-fs-*)` | `packages/ui/src/astryx-theme-cmc.test.ts:16-24` only asserts each step is declared. Rewrite is **not satisfiable**: `astryx-theme-cmc.css:72,73,75,76,77,78,79,80,81` are literal px and `:70,71,74` use `--cmc-font-size-*`, not `--cmc-fs-*` | FAILED (see Finding 5) |
| 8 | P01: after deletion `--font-size-lg` = "16px / `var(--cmc-fs-title)`" | `astryx-theme-cmc.css:76` is literal `16px`; `--cmc-fs-title` (`tokens.css:102`) is never referenced by that file | FAILED (value right, mechanism wrong) |
| 9 | P01: allowlist `decl(console) ⊆ {--console-*}` holds after the deletions | Every non-`--console-` declaration in `console.css` is inside `:373-430` (enumerated, none elsewhere) | VERIFIED |
| 10 | P01: pixel change is `lg 15→16`, `2xl 18→24` | 9 of 12 steps change: `4xs/3xs 10→11`, `2xs 11→12`, `lg 15→16`, `xl 16→18`, `2xl 18→24`, `3xl 20→24`, `4xl 22→32`, `5xl 24→32` (`console.css:373-384` vs `astryx-theme-cmc.css:70-81`) | FAILED (see Finding 4) |
| 11 | P02: `--console-border` at `shifts-detail.tsx:113,114`; `--console-bg-subtle` at `:116` | `apps/admin/src/pages/attendance/shifts-detail.tsx:113` `--console-border`, `:114` `--console-bg-subtle`, `:116` both — **all with fallbacks** | FAILED (see Finding 2) |
| 12 | P02: `--cmc-text-supporting` at `report.tsx:136`, no fallback, undeclared | `apps/admin/src/pages/crm/report.tsx:136` `color: 'var(--cmc-text-supporting)'`; absent from `tokens.css` (has `--cmc-text`, `-2`, `-faint`, `-muted`) | VERIFIED |
| 13 | P02: `ui-ratchet.mjs` deliberately ignores `var()` | `scripts/ui-ratchet.mjs:195` `return value.includes('var(') \|\| …`; comment `:20` | VERIFIED |
| 14 | P02: `WS_CSS` template literal at `shifts.tsx:42` | `apps/admin/src/pages/attendance/shifts.tsx:42` | VERIFIED |
| 15 | P02: `pnpm check:css-vars` will be green on `develop` | Executed the plan's spec verbatim: 8 undeclared-no-fallback names, 7 of them false positives from `shifts.tsx:44-49` | FAILED (see Finding 1) |
| 16 | P03: `pipeline.tsx:34` `PAGE_SIZE = 20`; `:287-293` listInput; `:342-351` groupBy; `:353-354` counts; `:481-488` funnel; `:504-508` count+empty | All exact | VERIFIED |
| 17 | P03: optimistic cache of `handleAdvance` at `pipeline.tsx:297-318` | `:297-318` is `advanceMutation`/`onMutate`; `handleAdvance` is at `:321` | FAILED (wrong symbol, right block) |
| 18 | P03: `console-kanban.tsx:20-29,35` — `count` is a bare number | `packages/ui/src/console/console-kanban.tsx:21` `count?: number`, `:29` `displayCount`, `:35` render | VERIFIED |
| 19 | P03: `pipeline.test.tsx:13-14,58-60` locks the `stageCounts` contract; `:153-166` is the badge test | Exact at all three ranges | VERIFIED |
| 20 | P03: `router.ts:102,450` stage filter; `:474-495,519` counts; `:112` max 100; `:483-491` stageCounts ignores search | `apps/api/src/crm/router.ts:102,450,474-495,519,112,483-491` — all exact | VERIFIED |
| 21 | P03: `list.test.ts:58-66` stage filter, `:129-146` stageCounts | `apps/api/src/crm/list.test.ts:58-67`, `:129-147` | VERIFIED |
| 22 | P04: no `:focus-visible` on the listed Console primitives; `console.css:111-205`, `:330-365,449-456` | `console.css:111`, `:330`, `:449-456` correct. File is not devoid of it — `:673` `.console-bc-link:focus-visible`, `:1276` `.console-steps-btn:focus-visible`; none cover the six listed primitives | VERIFIED (with caveat) |
| 23 | P04: `pipeline.tsx:137-238` wraps `role="button"` around a card containing buttons | Wrapper is `:137-242`; `role="button" tabIndex={0}` at `:138-139`; inner `<Button>` at `:230-238` | VERIFIED (end line off by 4) |
| 24 | P04: `onRowClick` mouse-only at `receipt-list.tsx:227`, `classes/index.tsx:449`, `users.tsx:351`, `students/index.tsx:133` | All four exact; `packages/ui/src/components/data-table.tsx:143-157` has no `tabIndex`/`onKeyDown` | VERIFIED |
| 25 | P05: `.github/workflows/ci.yml:112-119` wires `check:ui-frames` + `check:ui-ratchet`; "hai cổng CI đang chạy" | `ci.yml:112-113`, `:118-119` exact. But `package.json` also defines `check:ui-a11y-roles` / `test:ui-a11y-roles` (`scripts/check-ui-a11y-roles.mjs` exists) and `ci.yml` never runs it | VERIFIED / incomplete (Finding 7) |
| 26 | P05: `docs/README.md:15,41` routes frontend to TL12 | `:15` `**Frontend dev** … TL12 (design)` VERIFIED; `:41` is the TL12 catalog entry, not a routing line | VERIFIED / partial |
| 27 | P05: `llms.txt:79` `premium.css`; `index.ts:166-169` dead `.sh-*` comment; `console.css:1394`; `primitives.ts:35-41` SideNav; `console-navbar.tsx:8` | All five exact | VERIFIED |
| 28 | P05: drift strings at `12-design-system-ui.md:8-9,95-101`; `STRUCTURE.md:3,18,70`; `PAGE-FRAMES.md:13-16`; `MASTER.md:146,164-168` | All exact (`AppFrame` ×2/×1/×3/×2 in the four files). `MASTER.md:152-153` is Toast/EmptyState — no forbidden string | VERIFIED except `MASTER.md:152-153` = UNVERIFIABLE |
| 29 | P06: `apps/lms/index.html:6` has `user-scalable=no`; 77 inline styles; `width:60` ×7 | `index.html:6` exact; `grep -c 'style={{'` = **77**; `width: 60` = **7** | VERIFIED |
| 30 | P06: `student/home.tsx:90`, `exercise.tsx:149,153` are `size="2xs"`; `homework-results.tsx:64` | All exact. `homework-results.tsx` lives under `pages/parent/`, not `student/` — the plan's lô-0 list implies student | VERIFIED (path ambiguity) |
| 31 | P06: `routes/index.tsx:46-63` parent, `:66-80` student, `:31` loader; `change-password.tsx:33` has no topbar | `apps/lms/src/routes/index.tsx:46-63`, `:65-81`, `:31`; `student/change-password.tsx:33` | VERIFIED |
| 32 | P06: 6 e2e specs reusable (`lms-login.ui.spec.ts`, 5 journeys) | All 6 exist under `apps/e2e/tests/` and `apps/e2e/tests/journeys/` | VERIFIED |
| 33 | P06: "Trích **6 class**" vs table listing 7 | phase-06 table lists `.lms-card`, `.lms-topbar__spacer`, `.lms-btn-block`, `.lms-page--flush`, `.lms-card--interactive`, `.lms-grid-2`, `.lms-grid-3` = 7 | FAILED (cosmetic) |
| 34 | Supply chain: no phase adds a dependency | No `pnpm add` / dependency edit in any phase file; both new scripts are node-builtin `.mjs` | VERIFIED |
| 35 | Security: per-stage queries cannot leak across facility | `router.ts:442` `requirePermission('crm','opportunityList')`, `:445` `scoped(ctx)`, `:449` `and=[{facilityId}]` before any `stage` push at `:450`, `:473` `withFacility(ctx.db, facilityId, …)` RLS wrapper, aggregates `:488,491` re-scope to `facilityId`. `list.test.ts:69-70` proves the permission gate | VERIFIED — no finding |

**Security verdict, stated plainly:** there is no injection, authz, or tenant-isolation defect in this plan. Facility scoping in `crm.opportunityList` is structurally independent of `input.stage` (`router.ts:449` vs `:450`) and is enforced twice (where-clause + `withFacility` RLS). The two new CI scripts take no arguments, spawn no shell, and read a fixed glob. No phase adds a dependency. The real defects are correctness and executability defects, below.

## Findings

## Finding 1: Phase 02's CI gate fails on `develop` the moment it is written — 7 false positives, 1 real hit — MEDIUM
**Evidence:** I ran the phase-02 spec verbatim (declared = `/(--[a-z0-9-]+)\s*:/` over CSS files only; consumed = `/var\(\s*(--[a-z0-9-]+)/` everywhere; fallback-exempt) across `packages/ui/src`, `apps/admin/src`, `apps/lms/src`. Result: 8 undeclared-without-fallback names.
- `--ws-sheet` `shifts.tsx:51`, `--ws-border` `:52,58,75(+8)`, `--ws-teal-dark` `:61,72,73(+4)`, `--ws-muted` `:63,135,140(+1)`, `--ws-teal` `:71,71,73(+7)`, `--ws-bg` `:76,80,164(+1)`, `--arrow` `:88,92,92(+6)` — **all seven are declared** at `apps/admin/src/pages/attendance/shifts.tsx:44-49`, inside the `WS_CSS` template literal, and render correctly today.
- `--cmc-text-supporting` `apps/admin/src/pages/crm/report.tsx:136` — the only true phantom.

**Why it breaks:** phase-02 acceptance says "`pnpm check:css-vars` xanh trên `develop`", and the risk note pre-commits the executing agent to the wrong remedy: "cho phép allowlist tối thiểu … **không** nới điều kiện fail". An agent following that text will allowlist seven working variables, permanently blinding the gate to that file, instead of fixing the collection rule. Signal-to-noise on first run is 1:7.

**Suggested fix:** specify that the **declared** set is collected from `.css` files *and* from CSS-bearing template literals in `.tsx` (same regex, same files as `consumed`). That drops all seven false positives and leaves exactly `--cmc-text-supporting`. Re-state acceptance as "exactly one hit before the fix, zero after".

## Finding 2: Two of the three "P0 phantom tokens in production" are not phantoms — MEDIUM
**Evidence:** `apps/admin/src/pages/attendance/shifts-detail.tsx:113` `border:1px solid var(--console-border, #dee2e6)`; `:114` `background:var(--console-bg-subtle, #f1f3f5)`; `:116` both, `#f8f9fa` / `#dee2e6`. Every consumption has a literal fallback.
**Why it breaks:** the phase's premise — "Biến ma render ra rỗng — màu biến mất, viền biến mất, im lặng" (phase-02:20) — is false for these two; the fallbacks render. Worse, phase-02's own script spec exempts fallback-bearing `var()` (`:36`), so acceptance criterion "Ba biến trên không còn xuất hiện trong tập `consumed \ declared`" is already satisfied for them **with zero work** — a checkbox that proves nothing. The line attribution is also wrong: `--console-border` is at `:113,116`, not `:113,114`; `--console-bg-subtle` is at `:114,116`, not `:116`.
**Suggested fix:** demote these two to a one-line cleanup note (fallback hex is untokenized debt, not a P0), correct the line map, and scope the phase's P0 claim to `--cmc-text-supporting` alone. Otherwise the phase's stated severity does not survive contact with the file.

## Finding 3: Phase 03 nhịp 2 contradicts phase 03 nhịp 1 — `stageCounts` feeds both the funnel and the badge — HIGH
**Evidence:** `apps/admin/src/pages/crm/pipeline.tsx:486` `value={stageCounts[stage.key] ?? 0}` (funnel) and `:504` `const count = stageCounts[stage.key] ?? 0` (column badge) read the **same** field, produced once at `apps/api/src/crm/router.ts:486-490` from a `where` that is deliberately `{facilityId} + NOT_LOST` only (comment `:483-485`).
**Why it breaks:** phase-03 simultaneously orders (a) "`pipeline.tsx:481-488` funnel — **Giữ nguyên tổng**" and (b) "`stageCounts` … Board có lọc thì count phải đếm theo cùng `where` với items". Both cannot hold: narrowing `stageCounts` by `search` narrows the funnel too, and `apps/admin/src/pages/crm/pipeline.test.tsx:143-151` asserts exactly that the funnel is *not* filter-derived (`['5','1','2','0','3']`). Worse in nhịp 2: if each of the 5 per-column queries carries `stage`, its `stageCounts` collapses to a single key — the plan never says which of the 5 responses feeds the funnel, so an executing agent will invent one.
**Suggested fix:** split the contract before writing code — either add a separate `filteredStageCounts` field (funnel keeps `stageCounts`), or keep one facility-wide aggregate query for the funnel + per-column `total` from each column's own `count`. Name the field and the owning query in the phase file; do not leave it to the executor.

## Finding 4: Phase 01's pixel warning names 2 changed steps; 9 change — HIGH
**Evidence:** computed diff of `console.css:373-384` vs `astryx-theme-cmc.css:70-81`: `4xs 10→11`, `3xs 10→11`, `2xs 11→12`, `xs 12→12`, `sm 13→13`, `base 14→14`, `lg 15→16`, `xl 16→18`, `2xl 18→24`, `3xl 20→24`, `4xl 22→32`, `5xl 24→32`. Nine steps move; the plan (phase-01:19) warns about `lg` and `2xl` only.
**Why it breaks:** the plan's sole regression control is manual eye-check of "**đúng 3 màn**" against a list of expected movements (phase-01:74,82-83). `4xl 22→32px` (+45%) and `5xl 24→32px` drive `--text-display-*` (`console.css:398-400`) — display/metric text — which is not on the reviewer's list and may not be on the three chosen screens. A wrong checklist plus no VRT means the change ships unverified, exactly the risk row the plan claims to mitigate.
**Suggested fix:** replace the two-item warning with the full 9-row before/after table, and require the eye-check to include one screen that renders a display/metric size (cockpit/dashboard). Cheap alternative: temporarily assert the resolved values in the new cross-file test so the delta is machine-recorded.

## Finding 5: Phase 01's rewrite of `astryx-theme-cmc.test.ts` is impossible under the file it declares untouchable — HIGH
**Evidence:** phase-01:58-59 orders "đổi thành require `var(--cmc-fs-*)`" for `packages/ui/src/astryx-theme-cmc.test.ts:16-24`. Actual values in `packages/ui/src/astryx-theme-cmc.css`: `:72` `12px`, `:73` `12px`, `:75` `14px`, `:76` `16px`, `:77` `18px`, `:78` `24px`, `:79` `24px`, `:80` `32px`, `:81` `32px` are **literals**; `:70,71` use `var(--cmc-font-size-column)` and `:74` `var(--cmc-font-size-data)` — names that are not `--cmc-fs-*` (`tokens.css:55-56` vs `:99-105`). The phase's "File sửa" section never lists `astryx-theme-cmc.css`, and "Không đụng" (`:39`) reinforces it.
**Why it breaks:** the executing agent hits a test it cannot make green without an unscoped rewrite of 12 declarations in a file the plan told it not to touch — and that rewrite is itself pixel-affecting (`--cmc-fs-*` has 7 values for a 12-step scale, so it forces arbitrary remapping). Typical AI-agent resolution: weaken the assertion to whatever passes, producing a phantom test.
**Suggested fix:** either (a) drop this rewrite — the existing `:16-24` assertion ("every step is pinned") is exactly the invariant phase 01 needs and stays valid after the deletion, or (b) promote "astryx font-size steps reference `--cmc-*` tokens" to its own scoped task with the 12-value mapping written out. Do not leave it as a one-line instruction.

## Finding 6: Phase 04 offers a "fix" for nested interactives that recreates them as invalid HTML — MEDIUM
**Evidence:** option 1 at phase-04:32 is "dùng `KanbanCard onClick` sẵn có". `packages/ui/src/console/console-kanban.tsx:70-77`: when `onClick` is set, `KanbanCard` renders `<button type="button">{title}…{children}…</button>`. `apps/admin/src/pages/crm/pipeline.tsx:230-238` passes `<Button>` elements as those children. Result: `<button>` inside `<button>` — invalid HTML, worse than today's `role="button"` wrapper, and the exact 4.1.2 defect the phase exists to remove.
Secondary: phase-04:16-18 groups the kanban card under "Mở dòng chỉ bằng chuột", but the wrapper already has a keyboard path at `pipeline.tsx:141-146` (Enter/Space, guarded by `e.target !== e.currentTarget`). Removing the wrapper without replacing that handler is a keyboard **regression**.
**Suggested fix:** delete option 1; keep only "card tĩnh + tiêu đề là link, actions ngoài vùng hit". Add a one-line note that `pipeline.tsx:141-146` is the behavior being preserved, not the behavior being removed. Consider making `KanbanCard`'s `onClick` branch throw/warn when children contain interactive nodes, so the trap cannot be re-entered.

## Finding 7: An a11y gate already exists in `package.json` and is not wired to CI — invisible to phases 04 and 05 — MEDIUM
**Evidence:** `package.json` defines `"check:ui-a11y-roles": "node scripts/check-ui-a11y-roles.mjs"` and `"test:ui-a11y-roles"`; both `scripts/check-ui-a11y-roles.mjs` and `scripts/check-ui-a11y-roles.test.mjs` exist. `grep -n 'a11y' .github/workflows/*.yml` returns **nothing** — `ci.yml` runs `check:ui-frames` (`:112-113`) and `check:ui-ratchet` (`:118-119`) only.
**Why it breaks:** phase 05 will write into `docs/design-system-console.md` that there are "**Hai cổng CI đang chạy**" (phase-05:30) — freezing a factual error into the document whose whole purpose is to stop documentation drift. And phase 04, the a11y phase, adds new gates while an existing, tested, unwired a11y gate sits in the repo — contradicting the plan's own principle "CI là đội review" (plan.md:17-18).
**Suggested fix:** phase 04 wires `check:ui-a11y-roles && test:ui-a11y-roles` into `ci.yml` next to `:118-119` (or the plan records, with a reason, why it stays off). Phase 05 then documents three gates, or two plus an explicit "deliberately not wired" note.

## Finding 8: Phase 03 nhịp 2 multiplies DB work 5×, not "5 round-trip" — MEDIUM
**Evidence:** each `crm.opportunityList` call executes `findMany` + `count` + facility-wide `groupBy` + lost `count` in one `Promise.all` (`apps/api/src/crm/router.ts:474-492`) plus a conditional `appUser.findMany` (`:501-503`) — up to 5 queries per call. Phase-03:42 prescribes "**5 `useQuery`**" ⇒ up to 25 queries per board render, of which the `groupBy` at `:486-490` and the `count` at `:491` are **identical facility-wide aggregates recomputed 5 times**. The phase's mitigation gate is "Chỉ mở endpoint `opportunityBoard` nếu đo được 5 round-trip là chậm thật" — measuring the wrong quantity.
**Why it breaks:** the trigger for escalating to a board endpoint is calibrated against a number that is 5× too small, so the escalation will never fire; and the redundant aggregates scale with facility size, not page size. This is the same class of defect (page-scoped counting vs facility aggregate) the F7 comment at `pipeline.tsx:342-346` warns about, inverted.
**Suggested fix:** state the real cost (≤25 queries, 10 of them redundant) in the phase, and either add a `counts: false` input so 4 of the 5 columns skip the aggregates, or make the funnel + counts a single dedicated query and the columns items-only. Decide this before nhịp 2 starts, not after a latency complaint.

## Unresolved questions

1. Phase 03 nhịp 2: which of the 5 per-column responses feeds `FunnelBar` (`pipeline.tsx:481-490`)? Unspecified — blocking for execution.
2. Phase 05: is `MASTER.md:152-153` (Toast / EmptyState) genuinely drift, or a mis-cited line? No forbidden string is present there.
3. Phase 06: `homework-results.tsx` is `pages/parent/`, not `pages/student/` — confirm lô 0's `:64` edit and lô 1's pilot page are the same parent file.
4. Phase 01 test (5) depends on `node_modules/@astryxdesign/theme-neutral/theme.css`, which is absent locally (deps not installed in the audit worktree) — verify in CI that the branch is actually exercised and does not silently skip.

---
Status: DONE_WITH_CONCERNS
Summary: 35 claims checked — 26 verified, 6 failed, plus a fact-check of the CI wiring claim (`ci.yml:112-119` is exact). No security defect exists in this plan (facility scoping in `crm.opportunityList` is enforced independently of `stage` at `router.ts:449` and `:473`, and no phase adds a dependency); the blocking problems are an unexecutable phase-02 gate that fires 7 false positives on `develop`, a self-contradicting `stageCounts` contract in phase 03, and a phase-01 pixel warning that names 2 of 9 changed type steps.
