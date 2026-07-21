# Phase 07 — Teaching cluster (final, largest)

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/teaching/grading.tsx` (already-premium teaching screen), `pages/classes/index.tsx`, `pages/finance/receipt-list.tsx`

## Overview
Six screens — the most complex cluster, done last after the pattern is proven. Includes the special-case
`pdf-annotator` and the dense `schedule`.

| Screen | Archetype | State | tRPC | Emoji |
|--------|-----------|-------|------|-------|
| `teaching/attendance.tsx` | list | REAL | `attendance.listBySession.useQuery`, `attendance.markAll.useMutation` | ✓ in label |
| `teaching/exercises.tsx` | list | REAL | `curriculumUnit.list`, `exercise.list` (queries), `exercise.create/publish/close.useMutation`, `useUtils` | NO |
| `teaching/schedule.tsx` | list | REAL | `classBatch.list.useQuery` | NO |
| `teaching/report-cards.tsx` | form | REAL | `student.lookup.useQuery`, `assessment.draftComment/confirm.useMutation` | NO |
| `teaching/session-evidence.tsx` | form | REAL | `classBatch.list`, `classSession.list` (queries), `sessionEvidence.upsert/addPhoto/publish.useMutation`, `useUtils` | ✓ in label |
| `teaching/pdf-annotator.tsx` | form | REAL | `submission.saveTeacherAnnotation.useMutation` | NO |

## Key insights
- attendance/exercises/schedule → `ListPage` (+ `FilterBar` where present, e.g. schedule).
- report-cards/session-evidence → `FormPage`; session-evidence has photo upload (`addPhoto`) + publish — preserve upload flow.
- **pdf-annotator is special**: canvas/annotation UI, not a standard form. Apply premium framing (`FormPage` header/action bar + premium error/result) but keep the annotator surface intact — do NOT force it into a template that breaks the annotation UX. If premium framing conflicts with the canvas, keep minimal premium wrapper only (decision).
- `✓` in labels = status glyph; replace with `LineIcon name="check-circle"` where it acts as an icon, else keep text.
- `grading.tsx` (already premium) is the closest in-cluster reference — mirror its composition.

## Requirements
- All six adopt their premium archetype (or premium framing for pdf-annotator).
- Every query/mutation payload + upload + publish flow unchanged; no `@cmc/api` edits.

## Architecture / data flow
- attendance: `listBySession` → grid → `markAll.mutate(records)`.
- exercises: unit/exercise lists → create/publish/close mutations → invalidate.
- session-evidence: batch/session lists → `upsert` → `addPhoto` (upload) → `publish` → invalidate.
- pdf-annotator: annotate → `saveTeacherAnnotation.mutate(annotation)`.

## Related code files
- Modify: `apps/admin/src/pages/teaching/{attendance,exercises,schedule,report-cards,session-evidence,pdf-annotator}.tsx`.
- Create: co-located `*.test.tsx` (6).

## Implementation steps (TDD per screen)
1. schedule → ListPage (+ FilterBar) — simplest, single query.
2. attendance → ListPage; lock `markAll` payload.
3. exercises → ListPage; lock create/publish/close mutations + invalidate.
4. report-cards → FormPage; lock draftComment/confirm.
5. session-evidence → FormPage; lock upsert/addPhoto/publish + upload flow.
6. pdf-annotator → premium framing only; lock `saveTeacherAnnotation`; verify annotation UX intact.
7. Phase gate + full-suite verify.

## Todo list
- [x] schedule → ListPage → green
- [x] attendance → ListPage → green
- [x] exercises → ListPage → green
- [x] report-cards → FormPage → green
- [x] session-evidence → FormPage (+ upload) → green
- [x] pdf-annotator → premium framing → green
- [x] final full verify gate (all 22 done)

## Success criteria
- 6 screens premium (5 template + pdf-annotator framed); teaching contracts + upload/publish unchanged.
- Full repo: typecheck 26/26 + build 14/14 + admin test + lint clean + `@cmc/ui` unchanged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| pdf-annotator canvas breaks under FormPage | Med×High | Framing-only; keep annotator surface; fall back to minimal wrapper (decision) |
| session-evidence photo upload regression | Med×High | Lock `addPhoto` + upload trigger in tests before refactor |
| markAll bulk payload drift | Med×Med | Test asserts full record set submitted |
| Cluster size → fatigue/scope creep | Med×Med | One screen per TDD loop; gate after each |

## Security considerations
Session evidence + annotations may include student media/PII — presentation change must not alter upload targets or published visibility. Tests guard payloads; no authz/gating removed.

## Next steps
Final cluster — on completion all 22 screens are premium. Then: update `docs/12-design-system-ui.md` migration status + `docs/codebase-summary.md` if screen inventory is tracked. Recommend a red-team review of the full diff before merge.
