# Validate: day-one authoring ui gaps

**Date:** 2026-08-02

| Question | Answer |
|----------|--------|
| Does course create change public API? | No — existing `course.create` |
| Does ensure risk prod child data? | Gated by LOCAL_SIM_SEED_ALLOW; only inserts when count=0; local-sim DB name is cmc_prod by design |
| Sale SoD changed? | No |
| Class form rewritten? | No — unblocked by course UI + seed |
| Acceptance tests? | 3/3 course unit tests pass; 2 CurriculumUnit rows on local-sim |

**Open questions:** None for this slice. Sale receipt visibility remains product-owned.  
**Cook recommendation:** Implemented in-session; remaining optional polish is UX on class date inputs only.  
