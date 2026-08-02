# 2026-08-02 — Day-one authoring gaps (timeline e2e → plan → ship)

## Context

After local-sim experience setup and full ui-chromium (40/40 on synth DB), a
**timeline** MCP e2e (SA creates directors/staff, then ops) proved the money
path works via API but **authoring surfaces** blocked pure-UI day-one.

## Evidence (not theory)

| Finding | Proof |
|---------|--------|
| Course API OK, UI list-only | `course.create` as GĐĐT; `/admin/courses` no create button |
| CurriculumUnit empty on local-sim | DB count 0; exercise dialog requires unit + PDF |
| Class form “Tạo lớp” disabled | Strict validator OK; empty course list starves `courseId` |
| CRM Ghi danh path correct | `pipeline.tsx` → `/finance/new?opportunityId=` |
| Sale receiptList 403 | Intentional SoD — not fixed this slice |
| `/classes` Coming Soon | Real route `/admin/classes` |

Full ui-chromium on throwaway `cmc_synth`: **40 passed**. Timeline attendance
mark as `gv.tbhvnx7@…` succeeded after class.teacherId + receipt approve.

## Decision

Option A only (brainstorm/research/advise under `plans/reports/*day-one*`):
course create UI + ensure CurriculumUnit on local-sim path + redirect. Defer
sale “my receipts” and curriculum CRUD.

## What shipped

- Admin course create dialog + unit tests
- `scripts/ensure-curriculum-units.ts` + hook from seed-local-sim-demo
- `/classes` → `/admin/classes`
- Docs: README Getting Started, changelog, this journal

## Lesson

CI journey green (cookie mint + DB seed) **masks** day-one UI holes. Test with
password timeline actors and empty catalog to find authoring gaps.

## Follow-ups (non-blocking)

- Rebuild local-sim admin image to surface “+ Tạo khoá” in Docker SPA
- Class form date pickers (UX only)
- Product call: sale read-own receipts vs keep SoD
