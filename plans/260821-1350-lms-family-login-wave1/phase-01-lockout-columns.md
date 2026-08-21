---
phase: 1
title: ParentAccount lockout columns
status: completed
---

# Phase 1

Add `loginAttempts` / `loginLockedUntil` on `ParentAccount` (same shape as `StudentAccount`). Hash stays nullable. No login logic. No GRANT (UPDATE already granted).
