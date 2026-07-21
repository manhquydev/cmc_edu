---
phase: 4
title: C2 Single-Punch Approval Warning
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 4: C2 Single-Punch Approval Warning

## Overview
Khi giám đốc duyệt phiếu công chỉ có 1 mốc (`checkOutAt=null` — nhân viên cả ngày chỉ bấm 1 lần), phiếu được duyệt nhưng `resolveDayCredit` trả `NOT_VALID` (0 công). **Rule 0-công là chủ đích (ADR 0043), GIỮ NGUYÊN.** Chỉ thêm tín hiệu để người duyệt không hiểu nhầm "đã xử lý xong = có công".

Lưu ý (đã xác minh code): phiếu chỉ 1-mốc **khi và chỉ khi** cả ngày đúng 1 lần bấm — vì `ensureDayTicket:87-95` gom mọi punch thành sớm-nhất/muộn-nhất. Case checkin-trong-mạng + checkout-ngoài-mạng (và ngược lại) đã có đủ cặp → KHÔNG đụng.

## Rủi ro PO CHẤP NHẬN (ghi rõ, không phải bỏ sót)
Nếu nhân viên bấm **1 lần trong mạng công ty** rồi quên bấm ra → `ensureDayTicket:91-92` return sớm (`!anyOffsite`), **không tạo phiếu**, nên KHÔNG có phiếu để cảnh báo → mất công âm thầm, không tín hiệu. PO chọn **"để tự chịu, không nhắc"** (đồng bộ ADR 0043 §10 + Follow-Up "nhắc cuối ngày = nice-to-have chưa làm"). → Phase 4 CHỈ cảnh báo phiếu (case ngoài mạng); case quên-bấm-ra-trong-mạng KHÔNG mở rộng phase này. Đây là quyết định có chủ đích.

## Requirements
- Functional: `manualPunch.approve` trên phiếu `checkOutAt=null` trả về cờ cảnh báo (vd `warning: 'SINGLE_PUNCH_NO_CREDIT'`), song song cơ chế `warning: 'PAYSLIP_FINALIZED'` sẵn có. Bảng lương / UI phân biệt "duyệt-nhưng-0-công".
- Non-functional: KHÔNG đổi `resolveDayCredit` / `computeDayAttendance` / rule tính công. Chỉ thêm tín hiệu, không thay hành vi tính toán.

## Architecture
`manualPunch.approve` hiện trả `{...updated, warning?: 'PAYSLIP_FINALIZED'}`. Một phiếu có thể trúng CẢ HAI cảnh báo (finalized + single-punch) → single field sẽ nuốt mất 1 cái. **Quyết định (chốt, không để mở):** đổi contract sang **`warnings: string[]`** (mảng, rỗng khi không có), sweep call site duy nhất đọc `warning` (UI duyệt phiếu trong `apps/admin`, + e2e nếu assert). Điều kiện: `checkOutAt === null` → push `'SINGLE_PUNCH_NO_CREDIT'`; finalized → push `'PAYSLIP_FINALIZED'`. Đây là breaking contract có kiểm soát — làm gọn trong cùng phase, test cả 2-warning-cùng-lúc.

## Related Code Files
- Modify: `apps/api/src/checkin/router.ts:264-314` (`manualPunch.approve` — thêm nhánh warning)
- Modify (test): `apps/api/src/checkin/*approval*.test.ts` (thêm case single-punch)
- Read (ngữ cảnh, không sửa): `apps/api/src/attendance/resolve-day-credit.ts:51` (xác nhận null→NOT_VALID, không đổi)
- Optional (UI, nếu trong scope BE-only thì defer): `apps/admin/src/pages/**` bảng duyệt phiếu / bảng lương hiển thị cảnh báo.

## Implementation Steps (TDD)
1. **Test đỏ:** approve 1 phiếu có `checkInAt` set, `checkOutAt=null`, status pending → assert response chứa `warning: 'SINGLE_PUNCH_NO_CREDIT'` và ticket vẫn `approved` (không chặn). Chạy → đỏ.
2. **Test đỏ #2:** approve phiếu có đủ cặp (`checkOutAt` set) → assert KHÔNG có warning single-punch. Chạy → đỏ (nếu impl chưa có) hoặc xanh sẵn (guard).
3. **Impl:** đổi `warning?` → `warnings: string[]`; push `SINGLE_PUNCH_NO_CREDIT` khi `checkOutAt===null`, push `PAYSLIP_FINALIZED` khi finalized. Sweep call site đọc `warning` (grep `PAYSLIP_FINALIZED` trong `apps/admin`, e2e). Test case trúng CẢ HAI cảnh báo cùng lúc → mảng có 2 phần tử. Chạy → xanh.
4. **Test rule bất biến:** thêm/giữ test xác nhận `resolveDayCredit` với ticket approved `checkOutAt=null` vẫn `NOT_VALID` (0 công) — chốt rule KHÔNG đổi. Chạy → xanh.
5. **Regression:** `pnpm --filter @cmc/api test checkin` + `test payroll` (nếu chạm shape response) xanh.

## Success Criteria
- [ ] Duyệt phiếu 1-mốc trả `SINGLE_PUNCH_NO_CREDIT`; phiếu vẫn approved (không chặn — PO chọn "cảnh báo").
- [ ] Duyệt phiếu đủ cặp không có cảnh báo đó.
- [ ] Rule 0-công cho phiếu 1-mốc KHÔNG đổi (test bất biến xanh).
- [ ] Không nuốt cảnh báo khi trùng PAYSLIP_FINALIZED.

## Risk Assessment
- Rủi ro: đổi `warning` → `warnings[]` là breaking contract cho UI/e2e. Mitigation: sweep call site UI + e2e trong cùng phase (grep `PAYSLIP_FINALIZED`); test cả case 2-warning để chống nuốt.
- Rủi ro phạm vi: cám dỗ "sửa luôn cho tính công" — KHÔNG. PO đã chốt giữ rule. Chỉ cảnh báo.
