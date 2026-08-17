# Red-team round 2 — rollout, rollback and evidence

**Date:** 2026-08-17  
**Verdict:** findings applied; proceed to specialized validation.

## Findings

### H1 — Staff route migration has more consumers than the named E2E helper

- **Severity:** High
- **Evidence:** the canonical helper opens `/admin/users`
  (`apps/e2e/src/journey/create-staff-via-admin-ui.ts:107-132`); live helpers and acceptance
  manifest also own the path (`apps/e2e/src/live/live-ui.ts:36-50`,
  `scripts/acceptance-report/flow-manifest.ts:962-983`). Repository search found additional
  journey/live/mobile-audit consumers.
- **Disposition:** Accept.
- **Applied:** Phase 3 now requires a whole-repo consumer inventory and permits the old path only in
  compatibility tests.

### H2 — Browser proof for the Staff complaint was deferred too late

- **Severity:** High
- **Evidence:** Staff creation is an existing real browser dependency used by many journeys
  (`apps/e2e/src/journey/create-staff-via-admin-ui.ts:1-21`), while the original Phase 3 only
  promised focused Admin tests and left broader E2E to Phase 7.
- **Disposition:** Accept.
- **Applied:** director/super-admin/ordinary-role Staff browser proof is a Phase 3 merge gate.

### H3 — Phase 4 combined two independently risky ledgers in one rollback unit

- **Severity:** High
- **Evidence:** operational events are transactional and append-only
  (`packages/db/prisma/schema.prisma:314-329`), while AuditLog is global best-effort middleware
  (`apps/api/src/trpc.ts:142-187`); they have different failure and rollback semantics.
- **Disposition:** Accept.
- **Applied:** Phase 4 is split into protected PR 4A Staff timeline and 4B compliance-link
  correctness.

### M4 — No explicit rollback contract for URL/timeline waves

- **Severity:** Medium
- **Evidence:** existing RecordEvent rows cannot be updated/deleted by the app contract
  (`packages/db/prisma/schema.prisma:314-329`); route emitters span links, route registry and E2E
  consumers, so partial rollback would create dead links.
- **Disposition:** Accept.
- **Applied:** rollback sections added to Phases 3, 4, 5 and 6.

### M5 — Required CI must match the final PR head SHA

- **Severity:** Medium
- **Evidence:** `ui-e2e` is push-triggered and attached by commit SHA
  (`.github/workflows/ui-e2e.yml:80-108`), then runs the full UI project and acceptance/business
  gates (`.github/workflows/ui-e2e.yml:170-200`).
- **Disposition:** Accept.
- **Applied:** every module PR requires terminal-green `typecheck-and-test` and `ui-e2e` on the exact
  final head SHA.

## Whole-plan consistency sweep after round 2

- Files reread: `plan.md`, `decisions.md`, all phase files.
- Decision deltas checked: 5.
- Reconciled stale references: 6.
- Unresolved contradictions at this checkpoint: 0.

