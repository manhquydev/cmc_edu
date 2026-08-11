# Cook — CI warnings + next queue (matrix, curriculum axis, parents list)

**Mode:** ak:cook --auto --tdd · parallel explore  

## Critical CI (PR #110)

| Failure | Cause | Fix |
|---------|-------|-----|
| typecheck-and-test | `screen-role-matrix.json` drift (new form routes) | Regenerated matrix |
| e2e enrollment | `provisioning: pending` — grantUnits needs UCREA orderGlobal 1–4, CI migrate-only had 0/2 units | `ensureUcreaCurriculumAxis` in e2e global-setup + seed/ensure scripts expand to 1–4 |
| Prior | orderGlobal seedPublishedExercise, mid.refunds, FormPage actions | Already fixed |

## Next queue implemented
- Parents directory: `ListPagination` + `onRowClick` → form (keep list Duyệt on link requests)

## Non-goals
- Remove parents link-request Duyệt (e2e locks it)
- Domain unit-grant math change
