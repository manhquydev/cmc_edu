---
phase: 5
title: "Đợt tiền — finance cluster journeys"
status: done
completed: '2026-07-25 — P1-09 xanh 4×, P1-08 no-ui-path, sổ 12/38'
report: 'plans/reports/phase-05-dot-tien-finance-260725-1015-report.md'
priority: P1
effort: "3-4d"
dependencies: [1, 2, 3]
---

# Phase 5: Đợt tiền — finance cluster

## Overview
Đợt journey đầu tiên theo D4: các flow thuộc **cột `đợt`="tiền"** trong bảng triage Phase 2 (receipt, second-eye ≥20M, refund, email biên nhận...) chưa có journey. (RT-8: field `cluster` manifest là nhãn phase build, không dùng làm khóa đợt.) Đợt này đắt nhất (helper mới sinh ra ở đây) và quan trọng nhất (luồng tiền là xương sống nghiệm thu).

## Requirements
- Functional: mỗi flow finance "viết-được" trong triage có 1 journey `.journey.ui.spec.ts`; dữ liệu do vai tự tạo theo trình tự (sale tạo lead→opp→receipt; GĐ duyệt; ...); flow đỏ → `test.fixme` + `statusReason{code:'red-fixme', detail: lý do đã xác minh}` vào manifest.
- Non-functional: §4.2/§4.3 là assertion; negative case cho luật second-eye (sale KHÔNG thấy nút duyệt) theo khuôn `receipt-approve-negation` hiện có.

## Architecture
Lắp ghép helper hiện có (`menu-nav`, `find-in-list`, `create-staff-via-admin-ui`, `mintStaffCookie`); helper mới chỉ khi ≥2 spec cùng cần (DRY, ví dụ `approve-as-director.ts`). Mỗi spec độc lập: tự tạo nhân sự + dữ liệu của nó, cleanup theo khuôn hiện hành.

## Related Code Files
- Create: `apps/e2e/tests/journeys/<flow>.journey.ui.spec.ts` (số lượng theo triage), helper mới trong `apps/e2e/src/journey/` nếu đạt ngưỡng ≥2 spec dùng
- Modify: `scripts/acceptance-report/flow-manifest.ts` (gắn `journey:` theo H2 + statusReason cho flow đỏ)

## Implementation Steps (TDD — mỗi spec)
1. Với từng flow theo thứ tự triage: viết assertion ĐÍCH trước (kết quả cuối vai cuối phải thấy) → chạy đỏ.
2. Bồi các bước vai theo trình tự cho tới xanh; không `goto`, không truyền id.
3. Falsification chọn mẫu (≥1 spec trong đợt): ẩn tạm nav entry của màn đích local → spec phải đỏ đúng bước menu; hoàn nguyên (khuôn AC plan 260723-1422).
4. Flow đỏ vì bug/thiếu UI: dừng đúng nghi thức — `fixme` + statusReason + bằng chứng; KHÔNG sửa app.
5. Kết đợt (nghi thức RT-9): **4× liên tiếp CHỈ các spec của đợt** + **1× full suite** để bắt va chạm chéo; regen `acceptance:report`, soi trạng thái các flow đợt tiền.

## Success Criteria
- [ ] 100% flow đợt "tiền" trong triage "viết-được" có journey; còn lại có statusReason đúng nghi thức
- [ ] 4× spec-của-đợt xanh liên tiếp + 1× full suite xanh (spec fixme không tính đỏ)
- [ ] Sổ hiển thị đúng trạng thái từng flow đợt tiền từ results file (không tay)
- [ ] Ít nhất 1 falsification sống được ghi lại trong report đợt

## Risk Assessment
- Đợt đầu lộ khoảng trống helper → chấp nhận chậm, trích helper khi lặp; KHÔNG thiết kế trước helper cho đợt sau (YAGNI).
- Second-eye cần user GĐ thật → `create-staff-via-admin-ui` đã chứng minh đường này; không seed.
