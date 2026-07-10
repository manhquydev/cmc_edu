# Premium Design Language Promotion: Why TDD Became The Spec

**Date**: 2026-07-10 18:45  
**Severity**: [Completed] Learning  
**Component**: @cmc/ui, design system, test infrastructure  
**Status**: Resolved (branch `feat/premium-design-language`, 5/5 phases done, 40 files, 1960 insertions)

## What Happened

After Mantine→Astryx shipped, the user said the UI looked "thô sơ" — no visual improvement. Root cause: **migrations are plumbing, not redesign**. A brainstorm surfaced the real work: design-language FIRST (pilot-proven), then build-out. User locked a baseline after 4 iterations — operational cockpit (restraint + whitespace + monochrome icons + warm canvas + Inter). Then we promoted it into `@cmc/ui` across 5 TDD phases: test harness (missing entirely), tokens/LineIcon, composites (MetricCard/Panel/TaskRow/FunnelBar), shell (AppFrame/SideNav), page templates (ListPage/DetailPage/FormPage), and reconciliation with the 260707 build-out plan. All 5 phases DONE, 9 commits, 1960 insertions, 40+ tests.

## The Brutal Truth

This was **the first time we encoded a design system as invariants in tests, not as token JSON + Figma**. It feels weird and takes discipline: we wrote test suites for Panel to assert `!theme.contains("tint")` and FunnelBar to verify proportional scaling. But here's the payoff: when a junior builds page-17 and wonders "do I color this icon?", they can run `pnpm --filter @cmc/ui test` and the answer is there in code, not in a Figma hand-wave. This is the antidote to design drift. Also: every phase **passed byte-parity checks** against origin/main — zero regression in existing pages (receipt-list, receipt-detail migrated with identical behavior; admin tests stayed green). That confidence doesn't come free.

## Technical Details

- **@cmc/ui test harness from zero**: vitest config, jsdom environment, @testing-library/react, test-setup.ts. Forced us to surface an `import.meta.url` bug under jsdom (workaround: fs cwd read instead). Each phase gated: `pnpm --filter @cmc/ui test` (40+ tests now), `typecheck`, `build` (dist-clean).
- **Premium tokens** (packages/ui/src/tokens.css, +60 lines): warm canvas `#F7F6F3`, Notion-subtle shadows, 12px/pill radius, one-accent for data-viz. Additive — zero existing component references them. Tests assert rgb values never tinted.
- **Composites** (MetricCard 39 lines, Panel 23, TaskRow 27, FunnelBar 22): thin, composable, no god-components. Tests encode: Panel surface never tinted, FunnelBar width scales proportionally, TaskRow icon always monochrome.
- **Page templates** (ListPage/DetailPage/FormPage, 24–36 lines each): slot-based, not data-aware. Finance pages (receipt-list/detail) migrated with parity — same filter/status semantics, new premium surface.
- **Shell** (AppFrame 30 lines, SideNav 65 lines): admin-only (LMS deferred, YAGNI). Custom frame with blurred sticky nav + line icons + pill CTA. No direct Astryx dependency (one-door lint safe).

## What We Tried

1. **Upfront**: Tried to validate design taste purely from specs + screenshots — diminishing returns. Fixed: locked via 4 iterations + user sign-off, now have a reference baseline.
2. **Test design**: First approach was shallow render tests (props only). Realized invariants ARE the spec — upgraded to behavioral tests (Panel never tints, FunnelBar scales, monochrome icons). Now tests ARE the design contract.
3. **Delegation** (P3–P4): Handed off to fullstack subagents (shell + templates + finance migration). Returned APPROVE_WITH_NITS — both reviewers confirmed parity + no regression. One nit: router-Link coupling on promoted composites (clarified via docs comment).

## Root Cause Analysis

**Why plumbing ≠ redesign**: the Astryx migration succeeded at its stated goal (parity). It revealed that parity is not sufficiency — the app needed design + pages, both. By design-first and pilot-proving, we avoided the trap of building 30 flat pages then retrofitting. By TDD-ing the language (tests encode invariants), we made design fidelity testable, not just aspirational. By strict promotion discipline (parity checks, byte-level regression gates), we kept existing behavior untouched while reshaping the surface.

## Lessons Learned

1. **Design systems need tests as spec, not just tokens.** Token JSON is necessary but not sufficient — a junior can ignore it. Test suites that encode "never tint", "always monochrome" make the rule executable and auditable. This is unusual (most design systems skip it), but it's the difference between a guideline and a contract.

2. **Pilot-proven design language beats 30 flat pages then retrofit.** This plan's discipline of lock-then-promote prevented scope creep and double-work. The user's "tinh chỉnh khi build-out" approval means build-out is NOT redesign; it's implementation within locked bounds.

3. **Strict parity gates on promotion preserve confidence.** Every page migration tested for identical behavior (filter/status/render output). Zero regression → team can ship without fear. The receipts pages became proofs, not rewrites.

4. **Abstract carefully, reuse measurably.** AppFrame/SideNav promoted only for admin (desktop). LMS frame deferred (separate, warm variant, future effort). This YAGNI discipline kept scope tight. Avoid forcing shared abstractions onto incompatible contexts (mobile ≠ desktop).

5. **Honest scope boundaries.** 260707-0915 screen state flagged as follow-up decision: are those 30 screens real-built or placeholder? If real, adoption is a migration. If placeholder, it's the natural build path. We didn't silently expand; user decides.

## Next Steps

1. **P5 follow-up**: Inventory 260707-0915 screen states (real-built vs placeholder vs ComingSoon gated) before defining scope for premium adoption migration.
2. **LMS warm variant**: Design + promote in separate effort (shares base tokens/icons/composites, warm palette + mobile frame).
3. **Design reference image**: Optional concrete visual reference for pixel-accurate matching on future pages (prevents taste drift).
4. **Branch → PR → main**: This branch ready for code review; no blockers after phase-05 docs reconciliation.

---

**Status**: DONE (5/5 phases, all tests passing, parity verified, scope boundaries explicit, next steps owned)
