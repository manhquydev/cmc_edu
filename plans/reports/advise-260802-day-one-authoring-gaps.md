# Advise: Day-one authoring gaps

## What to do
1. **Ship course create dialog** on `/admin/courses` for GĐĐT (reuse class-dialog patterns).
2. **Ensure CurriculumUnit seed** runs on local-sim bootstrap (call shared ensure from `seed.mjs` or `seed-local-sim-demo` host-side prisma when DB reachable).
3. **Redirect `/classes` → `/admin/classes`**.
4. Do **not** open sale `receiptList` without ADR/product sign-off.
5. Do **not** build curriculum unit CRUD this slice.

## What to avoid
- Expanding auth rosters “just for demo”.
- Rewriting class form validator (already tested).
- “Fixing” CRM Ghi danh destination (already correct).

## Success metrics
- GĐĐT: create course in UI without DevTools.
- After local-sim seed path: `curriculumUnit.list` non-empty → exercise create dialog usable.
- Typed `/classes` lands on class admin list (or redirect).

## Work checklist
- [ ] Plan phases
- [ ] Red-team / validate assumptions
- [ ] Implement course UI + tests
- [ ] Curriculum ensure + runbook touch if needed
- [ ] Route redirect
- [ ] Focused tests
