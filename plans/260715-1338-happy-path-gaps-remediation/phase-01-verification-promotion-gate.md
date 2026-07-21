---
phase: 1
title: Verification & Promotion Gate
status: completed
priority: P1
dependencies: []
---

## Kết quả (2026-07-15)
Xem chi tiết: `reports/phase-01-verification-260715-1454-findings.md`.
- **V1:** không có lỗ hổng `assertPasswordNotExpired` — mọi mutation thật đều gọi. Không promote việc vào Phase 3.
- **V2:** 3 điểm audit cũ đã tự fix (Astryx migration). 4 file còn lại là UI display/business-classification, không phải cổng quyền thật (mutation vẫn qua `canDo()`). Nhập ghi chú tham khảo vào Phase 8, không tách sub-plan.

# Phase 1: Verification & Promotion Gate

## Overview
Hai việc xác minh rẻ, làm trước để chốt phạm vi thật của các phase sau — không sửa code sản phẩm, chỉ điều tra + ghi nhận. Kết quả có thể **promote** việc vào Phase 3 (nếu tìm thấy thủ tục quên gate) hoặc **tách sub-plan** (nếu frontend hardcode còn nhiều).

## Requirements
- Functional: xác định (a) có thủ tục LMS nào quên gọi `assertPasswordNotExpired`; (b) frontend còn hardcode role-array làm cổng quyền không.
- Non-functional: không mutate code; output là 1 ghi chú kết luận trong report + cập nhật scope phase sau.

## Architecture
Điều tra tĩnh (grep/đọc), không chạy runtime. Đối chiếu 2 nguồn: registry `@cmc/auth` (server) vs literal role trong `apps/*/src`.

## Related Code Files
- Read: `apps/api/src/trpc.ts` (`assertPasswordNotExpired:203-221`, `requireLmsStudent`, `lmsProcedure`)
- Read: mọi call site `requireLmsStudent` / `lmsProcedure` trong `apps/api/src/**` (đặc biệt `exercise/open-tier.ts`, `submission/router.ts`, `rewards/*`)
- Read: `apps/admin/src/**`, `apps/lms/src/**` — grep role literal
- Modify (nếu cần): scope note trong `plans/260715-1338-happy-path-gaps-remediation/phase-03-*.md` / `phase-08-*.md`

## Implementation Steps
1. **V1 — password-expired coverage.** Grep `requireLmsStudent` + `lmsProcedure` ra toàn bộ student-facing mutation. Với mỗi mutation ghi bài/đổi trạng thái (saveDraft, submit, redeem, ...), kiểm có gọi `assertPasswordNotExpired` không. Lập danh sách "gọi / không gọi".
   - Nếu CÓ thủ tục thiếu → ghi vào Phase 3 scope (thêm 1 bước: hoặc gọi helper tại chỗ, hoặc — tốt hơn — bọc thành `studentMutationProcedure` gate tự động). Đây là promote từ "Chưa xác định" → bug thật.
2. **V2 — frontend role-array hardcode.** Grep `apps/admin/src` + `apps/lms/src` các mẫu: `['giao_vien'`, `['hr'`, `MANAGER_ROLES`, `roles.includes(`, so literal role dùng làm điều kiện hiện/ẩn/gate. Đối chiếu 3 điểm `docs/03` từng nêu: `opportunity-detail.tsx`, `checkin-panel.tsx`, `attendance-roster.tsx`.
   - Đếm số điểm còn tồn tại. Nếu ≤ ~5 điểm → nhập vào Phase 8. Nếu > ~5 → dùng `AskUserQuestion` hỏi PO có tách sub-plan "frontend authz sweep" riêng không (open question #1 của plan).
3. Ghi kết luận (danh sách file:line + phán quyết promote/defer) vào `plans/260715-1338-happy-path-gaps-remediation/reports/` (tạo thư mục nếu chưa có).

## TDD note
Phase điều tra — không có code sản phẩm để test. "Test" ở đây = liệt kê được đầy đủ call sites và phân loại đúng. Không viết test giả.

## Success Criteria
- [ ] Danh sách đầy đủ student mutation + trạng thái gọi `assertPasswordNotExpired`; kết luận có/không lỗ hổng.
- [ ] Số điểm frontend role-hardcode được đếm chính xác (file:line), phán quyết nhập-Phase-8 hoặc tách-sub-plan.
- [ ] Scope Phase 3 / Phase 8 được cập nhật theo kết quả.

## Risk Assessment
- Rủi ro: bỏ sót call site → lỗ hổng vẫn còn sau plan. Giảm thiểu: grep cả `lmsProcedure` (gate gốc) lẫn `requireLmsStudent` (gate thứ 2), không chỉ 1.
- Rủi ro thấp toàn phase (read-only).
