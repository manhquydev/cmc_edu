---
title: "Phase 1: Start — research freeze & decision log"
status: todo
priority: P1
effort: "0.5–1d"
dependencies: []
---

# Phase 1: Start

## Overview

Đóng băng evidence scout, chốt product decisions D1–D8, và xác định “authority pack” docs sẽ import từ `cmc-lms` vào monorepo docs.

## Requirements

- [ ] Decision log D1–D8 có trạng thái: accepted / deferred / rejected + owner
- [ ] Danh sách file authority từ `cmc-lms` được copy/adapt (không để path ngoài monorepo làm SoT lâu dài)
- [ ] Wave 1 scope list (in/out) signed by user

## Implementation Steps

1. Re-read (đã scout):
   - `cmc-lms/docs/class-unit-spec.md`, `role-matrix.md`, `architecture.md`, `auth-model.md`
   - `cmc_edu/docs/decisions/0038`, `0041`; `system-architecture.md`
2. Present decision table to user (see plan.md) and record answers in this phase file under “Decisions recorded”.
3. Create folder `docs/lms-v2/` (or adapt) and **import** (not symlink forever):
   - class-unit-spec, role-matrix excerpts, curriculum CSV
4. Freeze Wave 1:
   - **IN:** unit engine, enrollment ranges, exercise library/delivery, attendance, journal, family portal, admin class/student ops, ERP provision bridge
   - **OUT (default):** gift catalog UX overhaul, badges/levels, parent meetings, SSE, full gradebook UI
5. Mark phase done only when D1–D4 + D6 answered (D5/D7/D8 can have defaults).

## Decisions recorded (owner answers 2026-08-11)

Product log (ngôn ngữ chủ hệ thống):  
`plans/reports/decisions-owner-260811-cau-1-5.md`  
Consensus: `plans/reports/brainstorm-advise-260811-lms-erp-unified-system.md`

| ID | Decision | Status | Owner wording |
|----|----------|--------|---------------|
| D1 | Hybrid create HS; no learn until unit grant | **ACCEPTED** | Câu 4 = A (GĐĐT/admin tối cao, có kiểm soát) |
| D2 | Khóa học > Unit; quyền học = unit trong khóa | **ACCEPTED** | Câu 1 — cấp quyền theo unit của khóa học |
| D2b | Phiếu/gói map sang unit (số/dãy) trong khóa | **ACCEPTED in principle** | Chi tiết “gói = mấy unit” tinh khi làm form phiếu |
| D3 | Supersede ADR 0038 → sequence 1 bài/buổi | **ACCEPTED** (default live) | Không bị phản đối |
| D4 | Family auth theo chuẩn LMS live khi gộp | **ACCEPTED** (default) | Đi cùng Scenario B |
| D5 | Không buổi bù; hủy buổi lùi unit | **ACCEPTED** (default) | |
| D6 | facility+RLS schema; Wave1 1 CS map live | **ACCEPTED** (default) | |
| D7 | Map role ERP → GV / admin LMS | **ACCEPTED** (default) | |
| D8 | Wave1 sao; quà sau | **ACCEPTED** (default) | |
| D9 | Scenario B: dữ liệu dạy–học từ LMS live | **ACCEPTED** | Câu 2 = B |
| D10 | Build quality trên cmc_edu trước; cutover+**đóng LMS cũ** sau | **ACCEPTED** | Câu 3 — không ép freeze ngay; đóng LMS kia khi hệ mới đạt chất lượng |
| D11 | Hoàn tiền: cắt unit chưa học (từ kế tiếp), giữ lịch sử | **ACCEPTED** | Câu 5 = A |
| D12 | Teaching constitution = class-unit-spec cmc-lms | **ACCEPTED** | Cùng câu 1 + live |

**Phase 1 freeze:** đủ để bắt đầu WP-02 ADR + WP-03…06 spike.  
**First cook:** WP-03 domain → WP-06 spike (not full UI/cutover).

## Related Code / Docs

- Read: both repos’ authority docs (no code edit this phase)
- Write: this plan + decision log; optional `docs/lms-v2/` copies

## Success Criteria

- [ ] User answers D1–D4, D6
- [ ] Wave 1 scope written and non-goals explicit
- [ ] Authority pack path inside monorepo decided

## Risk Assessment

Blocking phase: without D2/D3, schema port will thrash. Do not start phase 3 coding until these are accepted.
