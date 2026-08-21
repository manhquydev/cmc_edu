---
phase: 3
title: familyLogin + kind union
status: completed
---

# Phase 3

`familyLogin` additive. Dummy PBKDF2, lockout 5/15′. Mint `kind:'family'` không `studentId`. Cùng lúc: `verifyLmsToken`, `LmsSubject`, `requireLmsParent`, `parseLmsToken`, `ParentOnly` nhận `parent | family`. **Không** reject `parent`/`student`.
