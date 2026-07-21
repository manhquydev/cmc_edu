# Phase 4 (C2) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ các bước theo plan · **Regression:** 783/783 test (90 file) · **Typecheck:** 26/26 package

## Thay đổi code
| File | Thay đổi |
|---|---|
| `apps/api/src/checkin/router.ts` | `manualPunch.approve`: đổi `{...updated, warning?: 'PAYSLIP_FINALIZED'}` → `{...updated, warnings: string[]}` (luôn có, rỗng khi không cảnh báo); push `'PAYSLIP_FINALIZED'` khi period đã finalize, push `'SINGLE_PUNCH_NO_CREDIT'` khi `checkOutAt===null`; không đổi `resolveDayCredit`/rule 0-công |
| `apps/api/src/checkin/manual-punch-approval-track.test.ts` | Test mới #11 (1-mốc → có warning, vẫn approved), #12 (đủ cặp → không có warning); `seedTicket` helper thêm tham số `hours?` |
| `apps/api/src/payroll/manual-ticket-exemption.test.ts` | Sweep 2 assertion cũ `.warning` → `.warnings` (mảng); test mới "cả 2 cảnh báo cùng lúc" (finalized + single-punch, xác nhận không nuốt cảnh báo, `warnings.length===2`) |
| `docs/11-api-contract.md` | Ghi chú `manualPunch.approve` trả thêm `warnings: string[]` — public contract, cần đồng bộ doc |

## Sweep breaking-contract (`warning` → `warnings[]`)
Grep toàn repo (`apps/admin`, `apps/lms`, `apps/e2e`) cho `.warning` liên quan `manualPunch.approve` — **không có call site UI/e2e nào đọc field này** (UI `check-in-out.tsx`'s `approveMut.onSuccess` không destructure response, chỉ set thông báo tĩnh). Chỉ có 2 assertion trong test API (`manual-ticket-exemption.test.ts`) cần sửa — đã sửa.

## Vấn đề gặp và xử lý (lỗi thật, không phải hạ tầng)
1. Test cũ "approve() has NO warning when the ticket period is still a draft payslip" seed 1 ticket KHÔNG set `checkInAt`/`checkOutAt` (cả 2 đều null) — với logic mới, ticket này khớp điều kiện `checkOutAt===null` nên CÓ `SINGLE_PUNCH_NO_CREDIT` (đúng theo điều kiện PO đã chốt trong phase-04 file, không phải bug). Sửa: đổi assertion từ `toEqual([])` sang `not.toContain('PAYSLIP_FINALIZED')` — giữ đúng mục đích gốc của test (không có cảnh báo finalized), không đổi logic code.

## Đối chiếu Success Criteria
- [x] Duyệt phiếu 1-mốc trả `SINGLE_PUNCH_NO_CREDIT`; phiếu vẫn approved (không chặn).
- [x] Duyệt phiếu đủ cặp không có cảnh báo đó.
- [x] Rule 0-công cho phiếu 1-mốc KHÔNG đổi (test bất biến `resolve-day-credit.test.ts:81-85` đã có sẵn từ trước, vẫn xanh — không cần thêm).
- [x] Không nuốt cảnh báo khi trùng `PAYSLIP_FINALIZED` (test cả 2 cảnh báo cùng lúc, `warnings.length===2`).

## Phạm vi CHỦ ĐỘNG KHÔNG mở rộng (theo đúng quyết định PO trong phase-04 file)
Case nhân viên bấm 1 lần TRONG MẠNG rồi quên bấm ra → `ensureDayTicket` không tạo phiếu → không có gì để cảnh báo. PO đã chốt "để tự chịu, không nhắc" — không đụng trong phase này.

## Unresolved questions
Không có.
