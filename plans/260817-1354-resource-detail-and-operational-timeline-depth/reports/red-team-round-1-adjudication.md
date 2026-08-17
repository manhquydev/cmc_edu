# Red-team round 1 adjudication

**Date:** 2026-08-17  
**Plan:** `260817-1354-resource-detail-and-operational-timeline-depth`  
**Lenses:** resource/form-depth architecture; audit/RBAC/tenant; URL/history UX;
scope/YAGNI.

## Summary

- Raw findings: 20.
- Evidence filter: 20 passed `file:line`.
- Deduplicated/capped: 15.
- Disposition: 11 Accept, 4 Accept modified, 0 Reject.
- Product code changed: none.

## Adjudicated findings

| # | Finding | Severity | Disposition | Applied to |
|---|---|---|---|---|
| 1 | Route inventory omitted declared production surfaces | High | Accept | inventory, Phase 1 |
| 2 | Course detail/update exceeded current minimal curriculum contract | High | Accept | D5/D6, Phase 6 |
| 3 | Gift exemption conflicted with the first taxonomy wording | High | Accept modified: refine catalog exception, keep Reward as lifecycle record | D5/D6, inventory |
| 4 | Hiding same-facility super-admin rows was a new policy, not preserved behavior | High | Accept modified: visible read-only, sensitive actions forbidden | D2, Phase 2 |
| 5 | Class tabs cannot share one parent permission | High | Accept | Phase 5 |
| 6 | ParentAccount lacked a canonical read authority | High | Accept | D9, Phase 6 |
| 7 | Module-owned timeline ignored cross-domain and worker producers | High | Accept | Phase 1, Phase 6 |
| 8 | Staff detail shell ownership and Activity phase boundary were ambiguous | Medium | Accept | Phase 3/4 |
| 9 | Staff list had no URL query schema | High | Accept | D7, Phase 3 |
| 10 | Create-success history used no push/replace contract | High | Accept | D7, Phase 3/6 |
| 11 | Cross-record return context was not typed or validated | High | Accept | D7, Phase 3/5 |
| 12 | Tab history/search/state semantics were unspecified | High | Accept | D7, Phase 5 |
| 13 | Unknown sections and compatibility redirects were ambiguous | Medium | Accept | D1/D7/D8, Phase 3/5/6 |
| 14 | AppUser payloads and audit action overrides were examples, not closed manifests | Medium | Accept | D10, Phase 4 |
| 15 | Global AuditLog links lacked current-facility resolvability | Medium | Accept | D10, Phase 4 |

## Evidence highlights

- Declared routes missed by the first inventory:
  `apps/admin/src/routes/admin.routes.tsx:176`,
  `apps/admin/src/routes/teaching.routes.tsx:80`,
  `apps/admin/src/routes/finance.routes.tsx:28`,
  `apps/admin/src/routes/crm.routes.tsx:48`.
- Course is explicitly minimal/deferred:
  `apps/api/src/course/router.ts:1-3`,
  `packages/db/prisma/schema.prisma:635-648`; ClassBatch copies its program for code generation:
  `apps/api/src/class/class-batch-router.ts:163-177`.
- Current `user.list` exposes same-facility rows while sensitive mutations guard super-admin:
  `apps/api/src/user/router.ts:268-344`.
- Class shell/roster gates differ:
  `apps/admin/src/routes/admin.routes.tsx:101-113`,
  `apps/admin/src/pages/classes/class-detail.tsx:401-428`,
  `apps/api/src/class/class-batch-router.ts:273-299`.
- Parent action rosters differ:
  `packages/auth/src/index.ts:130-133`,
  `apps/api/src/parentAccount/router.ts:45-116`.
- Cross-domain writers exist:
  `apps/api/src/enrollment/router.ts:40-73`,
  `apps/api/src/finance/router.ts:576-617`,
  `apps/api/src/worker/session-done-sweep.ts:84-109`.
- Existing list state is local-only:
  `apps/admin/src/pages/admin/users.tsx:125-152,305-340`.
- Audit ID derivation is input-first:
  `apps/api/src/audit/audit-helpers.ts:32-49`; AuditLog has no facility:
  `packages/db/prisma/schema.prisma:1118-1133`.

## Whole-plan consistency sweep after round 1

- Files reread: `plan.md`, `decisions.md`, all seven phase files, source-current inventory,
  brainstorm/advice report.
- Decision deltas checked: 10.
- Reconciled stale references: 13.
- Unresolved contradictions at this checkpoint: 0.

