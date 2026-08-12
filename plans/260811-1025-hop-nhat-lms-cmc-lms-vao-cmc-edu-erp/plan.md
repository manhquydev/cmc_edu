---
title: "Hop nhat LMS cmc-lms vao cmc_edu ERP (PROGRAM INDEX)"
description: "Chỉ mục chương trình — KHÔNG cook plan này. Thực thi theo 3 plan con."
status: pending
priority: P1
effort: "multi-sprint"
tags: [lms, erp, program-index]
created: 2026-08-11
---

# PROGRAM INDEX — Hợp nhất LMS + ERP

> **Không `/ak:cook` plan này.** Đã tách để tránh 9 phase quá lớn.

## Owner decisions

`plans/reports/decisions-owner-260811-cau-1-5.md`

## Execution order (cook sequence)

| Order | Plan | Outcome | Status |
|-------|------|---------|--------|
| **1** | [`260811-1117-lms-foundation-adr-va-spike-unit-range`](../260811-1117-lms-foundation-adr-va-spike-unit-range/) | ADR + domain + schema + spike roster | **ACTIVE — cook first** |
| **2** | [`260811-1118-lms-teaching-spine-api-ui-family`](../260811-1118-lms-teaching-spine-api-ui-family/) | Teaching day loop + family + UI | After 1 |
| **3** | [`260811-1118-lms-erp-money-bridge-import-cutover`](../260811-1118-lms-erp-money-bridge-import-cutover/) | Tiền→unit + import + đóng LMS cũ | After 2 quality |

## Research / brainstorm

- Deep scout: `plans/reports/research-260811-deep-scout-lms-merge.md`  
- Brainstorm+advise: `plans/reports/brainstorm-advise-260811-lms-erp-unified-system.md`  

## Legacy phase files in this directory

`phase-01`…`phase-09` below are **historical draft** from mega-plan; superseded by the three plans above. Keep for reference only.

## Success (program)

- [ ] Plan 1 cooked + proven  
- [ ] Plan 2 staging teaching day  
- [ ] Plan 3 cutover + old LMS closed  

<!-- slug: hop-nhat-lms-cmc-lms-vao-cmc-edu-erp -->
