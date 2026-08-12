# Phase 00 — Contract & doc align

**Status:** done (2026-08-11)  
**Risk:** Low  
**Depends on:** nothing  

## Goal

Freeze language and fix doc drift so implementers never invent `/attendance/shifts` or Odoo-hash mid-flight.

## Steps

1. Record locked decisions (done: `decisions.md`).  
2. Patch TL06 row for đăng ký ca: path **`/hr/shifts` → `/hr/shifts/{id}`** (not `/attendance/shifts`).  
3. Confirm docs/27 already says `/hr/shifts/:id` — leave; note “implemented in this plan”.  
4. Inventory “shallow” modules table (list only / expand only) → seed phase 05 matrix.  
5. Report: `reports/phase-00-complete.md`.

## Files

- `docs/06-kien-truc-url-routing.md` (minimal path correction)  
- This plan’s inventory table  

## Acceptance

- [ ] TL06 path matches nav `/hr/shifts`  
- [ ] decisions.md uncontested  
- [ ] Shallow-module inventory draft exists  

## Rollback

Revert doc patch only.
