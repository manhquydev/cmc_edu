# Review — Record-centric Work Schedule pilot (phases 0–3)

**Date:** 2026-08-11  
**Commit:** `0573c95` `feat(hr): record-centric Work Schedule form URLs and shift.get`  
**Plan:** `plans/260811-1408-record-centric-url-form-depth/`  
**Branch note:** landed on `feat/lms-foundation-unit-range-spike` (consider cherry-pick onto a dedicated HR/url branch before PR to main)

## Outcome reviewed

Pilot delivers **Odoo-like form depth** with **CMC path grammar**:

| URL | Role |
|-----|------|
| `/hr/shifts` | List index (mine / inbox) |
| `/hr/shifts/new` | Compose → submit → form |
| `/hr/shifts/:registrationId` | Form work surface via `shift.get` |
| `/go/shiftRegistration/:uuid` | Agent/share entry (links layer ready) |

Domain chrome is CMC (Soạn → Chờ duyệt → Đã duyệt), not Odoo Planned/CONFIRMED.

## Verification evidence

| Gate | Result |
|------|--------|
| `@cmc/links` unit | 28 pass |
| Admin shifts + detail + hr.routes | 25 pass |
| API `shift.get` | 6 pass (owner, track GĐ, peer, unknown, facility) |
| API full `src/shift/` | 47 pass (prior tester run) |
| tsc on shift surfaces | clean |
| P3 journey source | Updated for `/new` + checkbox + form URL assert |

## What matches Odoo principles (keep)

- Record has stable address  
- List is index; form owns status + actions  
- Back/share/F5 path (unit-level; e2e pending)  
- Compose separate then land on record form  

## Gaps before system rollout

| Gap | Severity | Owner next step |
|-----|----------|-----------------|
| Playwright journey not re-run green in this session | High | Phase 04 — run ui-e2e / P3 journey |
| Dual approve (list + form) still present | Medium | Accept short-term; phase 04 may demote list expand |
| Detail unit thin (invalid id / mutate) | Low | Add tests in phase 04 |
| UAT checklist docs not updated | Medium | Phase 04 step 4 |
| Branch mixes LMS spike + HR pilot | Process | Cherry-pick or split PR |

## Coordination decision

**Do not start KPI/Aftersale form-depth until phase 04 e2e green** (plan hard gate).

Phase 05 matrix published with as-built inventory and PR sizes  
→ `phase-05-system-rollout-matrix.md`.

Recommended post-pilot order: **KPI score → Aftersale case → Refund** (payroll last / product decision).

## Immediate next actions (ordered)

1. **Phase 04 proof:** run P3 journey + cold-start form smoke; fix regressions  
2. **CopyLinkButton** on shift form (done in follow-up if landed)  
3. **UAT path list** include `/hr/shifts/{uuid}`  
4. Owner pick first P2 module after pilot green  
5. Open dedicated PR if this commit must not ride LMS branch  

## Verdict

**Pilot phases 0–3: shippable at unit/API level.**  
**System-wide UX program: blocked only by phase 04 e2e gate**, not by architecture.
