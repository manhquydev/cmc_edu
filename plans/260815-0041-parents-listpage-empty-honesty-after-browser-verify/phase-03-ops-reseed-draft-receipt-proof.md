---
title: "Phase 3: Ops reseed draft receipt proof"
status: todo
---

# Phase 3: Ops reseed draft receipt proof

## Overview

**Optional evidence only — never blocks Parents PR ship.**

Browser verify saw 0 drafts. Prefer **query** existing `[SEED] Phiếu nháp chờ duyệt`
before any seed run. Full `seed-local-sim-demo.ts` is **not** fully idempotent
(CRM/receipt approve path mutates; draft block is existence-checked for status=draft
only — approved fixture can break reseed).

## Requirements

- [x] Print/confirm `DATABASE_URL` host is local before any seed
- [x] Prefer `finance.receiptList` / UI filter draft over full reseed
- [x] If reseed unavoidable: record receipt counts before/after; abort on non-local URL
- [x] SKIP with reason is success for this phase
- [x] No seed-logic code changes in the Parents product PR

## Implementation Steps

1. Check docker / erp.localhost health.
2. Query draft receipts first.
3. Only if missing and local: carefully reseed OR document SKIP.
4. One line in cook report.

## Success Criteria

- Draft brand visible **or** SKIP recorded — Parents PR still ships.

<!-- Updated: Validation Session 1 - non-blocking; query-first; not fully idempotent -->
