---
title: "Phase 7: Coverage Gates E2E and Documentation"
status: todo
---

# Phase 7: Coverage Gates E2E and Documentation

## Overview

**Priority:** P1 · **Depends on:** Phase 6

Make record depth measurable so future modules cannot silently regress to popup-only work surfaces.
Run browser proof and synchronize durable architecture docs.

## Requirements

- [ ] Add a source-derived resource-depth audit with an explicit exception registry.
- [ ] Fail on unclassified production route, record without required depth, duplicate canonical path or unsafe nav landing.
- [ ] URL/history audit covers list-query hydration, validated return context, tab push,
  redirect/create replace, unknown section and malformed ID behavior.
- [ ] E2E covers director staff management, cold links, compatibility redirect and cross-role denial.
- [ ] E2E samples every rollout archetype; unit/integration tests carry exhaustive module cases.
- [ ] `pnpm acceptance:report` is measured before/after; no copied snapshot claims.
- [ ] `typecheck-and-test` and `ui-e2e` green on CI before done.
- [ ] Docs state dual-ledger semantics and canonical staff URLs.

## Architecture

The audit consumes route/link/exception data; it does not infer product intent from filenames alone.
Exceptions require category + reason + owner. Browser tests prove representative runtime behavior;
static coverage proves inventory completeness.

## File inventory

| Path | Action |
|---|---|
| `scripts/` resource-depth audit entry | create |
| `package.json` / workspace scripts | modify for audit command |
| `apps/admin/src/shell/nav-route-resolution.test.ts` | extend |
| `apps/e2e/src/journey/create-staff-via-admin-ui.ts` | verify Phase 3 canonical flow |
| `apps/e2e/src/*.ui.spec.ts` | add director/detail/deep-link coverage |
| `docs/06-kien-truc-url-routing.md` | update as-built paths |
| `docs/ux-resource-centric-structure.md` | add taxonomy/exception rule |
| `docs/system-architecture.md` | add dual-ledger and Staff surface |
| `plans/.../reports/final-resource-depth-ledger.md` | create final measured report |

## Implementation Steps

1. Define machine-readable assertions and exception schema from Phase 1 inventory.
2. Add static audit tests for route/link/detail and nav-role coherence.
3. Verify Phase 3 already migrated every Staff helper/manifest consumer and browser journey; Phase 7
   adds only uncovered system-wide matrix cases.
4. Add representative cold-start/back/share tests for changed module series.
5. Run focused tests, package tests, root typecheck/lint/build as affected.
6. Run `pnpm acceptance:report`; record actual artifact-derived counts.
7. Open PRs sequentially; require both CI checks.
8. Update docs only after source behavior is final.
9. Run final whole-system inventory and record residual explicit exceptions.

## Validation matrix

| Gate | Pass condition |
|---|---|
| Static resource audit | 0 unknown; 0 duplicate canonical paths |
| Nav/RBAC | every visible leaf resolves; director Staff positive; ordinary negative |
| API | all actor-target and tenant tests green |
| Browser | create→detail, row→detail, F5, legacy redirect, back |
| URL/history | query hydrate, explicit return fallback, tab Back/Forward, unknown section, invalid ID |
| Timeline | tenant isolation + payload allowlists |
| CI | both required checks terminal green on each final PR head SHA |
| Acceptance | report generated from current artifacts; no regression unexplained |

## Success Criteria

- Future popup-only regression is detectable.
- Browser proof exists for the staff complaint and representative module waves.
- Documentation matches source and measured evidence.
- Plan can move to completed only after required CI is terminal green.

## Risks

- **Static false confidence:** pair with browser E2E.
- **Brittle scanner:** parse declared route/link structures; keep explicit exceptions.
- **Overloaded E2E:** exhaustive edge cases stay in API/unit tests.
- **Dirty baseline failures:** separate unrelated baseline failures from touched behavior; never hide either.

## Security considerations

Negative E2E proves hidden navigation and typed URLs separately. Test artifacts must not contain
temporary passwords, real PII, tokens or raw audit payloads.
