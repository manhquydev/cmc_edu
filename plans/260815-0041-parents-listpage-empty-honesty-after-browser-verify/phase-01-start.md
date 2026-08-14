---
title: "Phase 1: Start"
status: todo
---

# Phase 1: Start

## Overview

Freeze the empty-copy decision matrix (red-team corrected). No invent `kind`.

## Requirements

- [x] Confirm develop tip includes Classes #145
- [x] Freeze matrix below before Phase 2 code
- [x] Confirm Parents has no create CTA today (design note only)

## Empty-copy decision matrix (authority)

| Surface | Role needed | Condition | Copy direction | Forbidden |
|---------|-------------|-----------|----------------|-----------|
| Requests | any with queue access | `total===0` (any `filterStatus`) | One shared under-claim: queue empty for current status filter — kindless string | `first-run`, `filtered`, invent create, per-status fiction without tests |
| All parents | `parentAccount.updateEmail` (`sale` / GDKD) | `email=missing`, search empty, `total===0` | Under-claim: no parents **missing email** | Claim facility has zero parents; invent create; publish kind |
| All parents | same | `email=missing`, search non-empty, `total===0` | Search-zero that **names** missing-email constraint (AND filter) | Generic "not found" that omits email filter; invent create |
| All parents | same | `email=all`, search empty, `total===0` | Facility has no parent accounts (true unfiltered-ish baseline for this tab) | `filtered` kind; invent create |
| All parents | same | `email=all`, search non-empty, `total===0` | Search-zero under-claim (Students tone) | invent create; publish kind |

**Mechanism:** pass `empty={CONST_STRING}` to DataTable — already renders EmptyState without `data-empty-kind`.

## Todo

- [x] Matrix confirmed at cook start
- [x] Note: requests over-cap (pageSize 50) is Non-goal

## Success Criteria

- Cook will not invent Classes-style first-run CTA or `TableEmptySpec.kind`.

<!-- Updated: Validation Session 1 - matrix missing|all; kindless strings -->
