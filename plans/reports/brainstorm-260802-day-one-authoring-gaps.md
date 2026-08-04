# Brainstorm: Day-one authoring UI gaps

**Date:** 2026-08-02  
**Evidence:** timeline phase 1–2 MCP e2e + explore scout  
**Mode:** delivery contract (ak-brainstorm)

## Contract

| Field | Value |
|-------|--------|
| **Outcome** | GĐĐT can bootstrap catalog and class **from admin UI** on local-sim/pilot without API bypass; exercise path unblocked by seeded CurriculumUnit; `/classes` deep-link no longer dead-ends. |
| **Constraints** | Keep RBAC (course.manage = GĐĐT only); no sale→receiptList SoD change in this slice; YAGNI/KISS; match existing Astryx form patterns (classes/users). |
| **Non-goals** | Full CurriculumUnit admin CRUD; sale “my receipts” API (product/ADR); CRM Ghi danh path redesign (already correct); Entra SSO; grading LMS full chain. |
| **Acceptance** | (1) GĐĐT creates course via UI → appears in list + class form dropdown. (2) Fresh local-sim/bootstrap has ≥1 CurriculumUnit without manual SQL. (3) Class form enables with course+valid dates+slot (documented). (4) `/classes` redirects to `/admin/classes`. (5) Unit tests for course create UI green. |

## Problem ranking (from scout)

| Pri | Issue | Root cause |
|-----|--------|------------|
| P0 | Course list-only | API exists; UI missing create |
| P0 | CurriculumUnit empty on local-sim | `seed.mjs` seeds units; local-sim path never runs it |
| P0* | Class button disabled | Usually empty courses / incomplete slot — form correct |
| P1 | `/classes` ComingSoon | Wrong path; real is `/admin/courses` |
| Defer | Sale receiptList 403 | Intentional SoD |
| Defer | CRM Ghi danh | Correct → `/finance/new?opportunityId=` |

## Approaches compared

| Option | Pros | Cons |
|--------|------|------|
| **A. UI + seed only (Recommended)** | Smallest; unblocks day-one; matches documented gap `course.create` | No unit CRUD UI |
| B. Full curriculum admin | Complete authoring | Over-scope for timeline pain |
| C. Docs-only | Zero code | Operators still blocked |

**Decision: A.**

## Next

Scout ✓ → Research/advise note → Plan → Red-team → Validate → Cook.
