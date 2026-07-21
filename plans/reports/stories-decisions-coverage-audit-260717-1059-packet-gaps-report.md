# Stories/Decisions Packet Coverage Audit

Source: `harness-cli query matrix` (25 stories, all `implemented`) + `harness-cli query matrix` on decisions (10 rows) vs `docs/stories/*.md` and `docs/decisions/*.md` on disk. Policy basis: `docs/HARNESS.md:319-321` — "For auth, authorization, data ownership, API shape, audit/security, or validation changes, record the decision in both places" (markdown file + `harness-cli decision add`). `docs/decisions/README.md` restates the same trigger list. `docs/stories/README.md` has no explicit per-story packet-required rule (says "no story packets active yet" — itself stale) so story flags below are risk-judgment against the same HARNESS.md trigger categories, not a written story-specific rule.

## Story packet gaps — ranked by risk

Have packets: US-001, US-UI-01a..08. **17 of 25 stories have no `docs/stories/US-*.md` file.**

### HIGH — auth / money / data-ownership / audit-security, no packet
| Story | Why high-risk |
|---|---|
| US-004 | Money gate: `receiptApprove` -> auto-O5. Core finance state transition. |
| US-009 | Receipt cancel/refund (revert O4, cap). Money reversal path. |
| US-005 | Provisioning atomic/idempotent (student/parent/enroll). Creates accounts — data ownership. |
| US-007 | Guardian link request/approve. Parent-child data ownership/access grant. |
| US-008 | LMS parent login (phone OTP + profile picker). Auth. |
| US-ADMIN-01 | Facility mgmt, network CRUD, audit log, OTP leak fix. Explicit audit/security. |
| US-GAPS-02 | Teacher class-ownership scoping, duplicate-student TOCTOU close, OTP tx timeout. Authz + auth. |
| US-GAPS-03 | Session-scoped reads by teacher ownership, OTP sweep race fix. Authz + auth. |
| US-HR-01 | Tier salary calc (money) + 5-role nav (authz), tied to ADR 0044 (also ungapped, see below). |

### MEDIUM — money-adjacent or validation, partially covered elsewhere
| Story | Note |
|---|---|
| US-003 | Receipt create from opportunity — money-adjacent but no state-transition gate itself. |
| US-006 | Enrollment reserved->active, Receipt-driven — money-linked but downstream of US-004/005. |
| US-010 | Reconciliation agent flags (HOTL) — money integrity but explicitly deferred/low test coverage already (0 integ/e2e/plat in matrix). |
| US-012 | Attendance mark + lifecycle gates — feeds payroll but ADR 0043 already documents the design decision. |
| US-015 | `exercise.openForStudent` gate — tied to ADR 0038, which itself lacks a decision doc (see below); story and ADR gap compound. |
| US-019 | SessionEvidence + photo consent — privacy-adjacent, not auth/money core. |
| US-GAPS-01 | 43 happy-path gaps incl. race conditions/guards — broad data-integrity scope but no single auth/money focus. |
| US-ATT-01 | Attendance in/out — ADR 0043 already has a doc, lowers marginal value of a separate story packet. |

### LOW — CRUD/UI/infra, packet optional
US-002, US-011, US-013, US-014, US-016, US-017, US-018 — CRM stage moves, class-batch CRUD, e2e skeleton, exercise CRUD, submission draft/grade, report-card draft. No auth/money/data-ownership surface per HARNESS.md trigger list.

## Decision packet gaps — ranked by risk

Registered in harness.db (10): 0001-0007, 0042, 0043, **0044**. Have `docs/decisions/*.md` files: 0001-0007, 0042, 0043. **0044 is registered in harness.db but has no doc file — violates the README's own "add both" instruction, an inconsistent half-done state, not just a missing optional doc.**

0038, 0039, 0040, 0041 are **not registered in harness.db at all** and exist only as prose sections in `docs/22-adr-rule-chi-code-0038-0041.md` (never promoted).

| ADR | Why | Registered in harness? | Priority |
|---|---|---|---|
| 0044 KPI auto-score + tier salary + session-done (HR remediation) | Money (salary calc formula) — directly in HARNESS.md trigger list | Yes (accepted) | **HIGH** — fix the harness/doc mismatch first |
| 0041 Provisioning atomic at receipt approval (+v2 tweaks) | Data ownership (account creation) triggered by money event | No | **HIGH** |
| 0039 Attendance via base-network IP match (no GPS) | Validation/security mechanism gating clock-in, feeds ADR 0043 & payroll | No | **HIGH** |
| 0038 Exercise-open timing by teaching progress (Tier A/B) | Validation rule change (who can access what, when) | No | MEDIUM |
| 0040 Shift grouping by role + selectionMode (sale ≠ teacher) | Role-based behavior split — mild authz flavor, lower blast radius | No | MEDIUM |

## Unresolved Qs
- Is 0044's harness.db registration this session's backfill or a pre-existing entry missing its doc? If backfill, the doc file should probably be created in the same pass that added the row (README's own two-step rule) — confirm whether that's intended as a follow-up.
- `docs/stories/README.md` and `docs/decisions/README.md` both read as stale (README claims "no story packets active" despite 9 existing files) — worth a doc refresh independent of this audit, but out of scope here (report-only).
- No explicit "story packet required" trigger list exists (only the decision-record trigger in HARNESS.md) — the story risk ranking above is inferred by analogy; confirm that's the intended read before treating it as policy.

Status: DONE
Summary: 17/25 stories and 5/10 candidate decisions (0038-0041, 0044) lack packet files; highest-priority gaps are money-gate/refund/provisioning/guardian/OTP-auth stories (US-004, US-005, US-007, US-008, US-009, US-ADMIN-01, US-GAPS-02/03, US-HR-01) and decisions 0044 (registered but doc-less — an inconsistent state), 0041, and 0039.
