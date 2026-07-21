# Independent Verification — 38 Flows

Date: 2026-07-20
Story: IV-038
Evidence batch: `ir38-c339f4a-final-20260720`
Proof commit: `c339f4a`

## Verdict

Acceptance tool no longer equates symbol existence with runtime proof. Canonical denominator confirmed: 38 flows = 33 TL25 + 5 ADMIN.

| Result | Count |
| --- | ---: |
| Static built | 38 |
| Runtime proven | 35 |
| Runtime blocked | 3 |
| Runtime failed | 0 |
| Evidence invalid | 0 |
| Untriaged orphan | 0 |

## Blocked Product Gaps

| Flow | Gap | Severity |
| --- | --- | --- |
| P1-08 | `/finance/refund` is a `Tính năng chưa áp dụng` placeholder | High |
| P4-03 | `/crm/post-sale-meeting` is a placeholder | High |
| P4-05 | `/crm/aftersale` is a placeholder | High |

Backend/API portions for these flows passed. Whole-flow verdict remains blocked because declared UI is not functional.

## Tool Audit

- Three scanner mutation probes failed where expected, then reverted cleanly.
- Evidence rejects dirty proof source, missing signed mode, missing synthetic sentinel, ownerless supplemental verdicts, cross-commit merge, non-ancestor commits, path traversal, and comment/title forgery.
- Each flow has one persisted owner; UI supplemental evidence cannot originate a verdict.
- API and owner DB URLs must resolve to the same `__SYNTH__` sentinel.
- `--fresh` refuses to delete a Docker container without the runtime-proof ownership label.

## Runtime Gates

- API Playwright: 51 passed, 1 intentional non-flow skip, 0 failed.
- UI Playwright: 37 passed, 3 product-gap skips, 0 failed.
- E2E unit: 19/19.
- Acceptance verifier unit: 5/5.
- Lint, workspace typecheck, workspace build: pass.
- `pnpm acceptance:report`: 38 built; 35 proven; 3 blocked; 0 failed/invalid.
- Real-browser ledger inspection: pass.

## Safety

- Dedicated container `cmc-synth-pg-ir38`, PostgreSQL 16 Alpine, loopback `127.0.0.1:55432`, database `cmc_synth`.
- No production volume or Docker network used.
- Signed staff/LMS secrets were throwaway shell values; not committed.
- LLM provider key removed; deterministic stub used.
- Screenshots remain local-only. No curated screenshot committed without user approval.

## Follow-up

1. Implement the three blocked screens, then rerun the same proof batch workflow.
2. Add CI job to refresh/verify runtime ledger against a disposable Postgres service.

## Unresolved Questions

None for verification scope. Product implementation priority among the three blocked screens remains a separate planning decision.
