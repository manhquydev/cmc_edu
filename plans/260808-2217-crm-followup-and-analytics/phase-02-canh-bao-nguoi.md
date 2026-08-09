---
phase: 2
title: "P2 — Cảnh báo cơ hội đang nguội"
status: pending
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 02 — P2: Cảnh báo cơ hội "đang nguội"

## Overview
Gắn nhãn "đang nguội" cho cơ hội còn hoạt động mà để lâu quá ngưỡng ngày không chuyển bước, để tư vấn viên chủ động cứu trước khi mất hẳn. **Không đụng luồng học phí.**

## Giá trị nghiệp vụ (cho người nghiệm thu)
- Không còn cơ hội bị bỏ quên âm thầm.
- Tự động — không phụ thuộc tư vấn viên có nhớ nhập liệu hay không.

## Nghiệm thu tính năng (điều kiện chấp nhận — demo được ngay)
- [ ] Cơ hội còn hoạt động, để mốc-đổi-bước lùi quá ngưỡng → hiện nhãn "đang nguội" trên phễu.
- [ ] Khi có thao tác (chuyển bước / đánh mất) → nhãn biến mất.
- [ ] Cơ hội "đã nhập học" (điểm cuối) không bao giờ bị gắn nhãn.
- [ ] Ngưỡng nguội đặt ở **cấu hình hệ thống** (mặc định 7 ngày); người dùng KHÔNG tự đổi trên màn hình.

## Chỉ số kết quả nghiệp vụ (theo dõi, KHÔNG chặn sign-off)
- Qua từng tuần, **số cơ hội đang nguội (đo bằng ảnh chụp) giảm dần** so với ảnh chụp tuần đầu tiên sau khi bật P2. *(Đo bằng snapshot — không cần lưu lịch sử; mục tiêu định hướng, hiệu chỉnh sau tuần 1.)*

## Requirements
- Functional:
  - Định nghĩa "nguội" (v1): cơ hội **còn hoạt động** (chưa mất, chưa nhập học) có `stageChangedAt` lùi quá ngưỡng. Tính **trực tiếp khi mở màn hình** (không chạy nền, không bảng cờ).
  - **Phối hợp với P4 (làm sau):** khi P4 có mặt, định nghĩa "nguội" phải loại thêm cơ hội đã có việc-kế-tiếp hẹn ở tương lai (`nextActionAt > now`). P4 chịu trách nhiệm cập nhật điều kiện này; ở giai đoạn P2-only chưa có cột đó nên không ảnh hưởng.
  - Ngưỡng qua biến môi trường `ROTTING_THRESHOLD_DAYS` (mặc định 7).
- Non-functional:
  - Không tiến trình chạy-nền, không bảng lịch sử.
  - Query runtime null-safe: `COALESCE(stageChangedAt, createdAt)` (stageChangedAt nullable với dòng chưa từng đổi bước).

## Architecture
- Thêm cột `stageChangedAt DateTime?` (nullable) vào `Opportunity`.
- Ghi mốc tại **các cửa đổi bước là UPDATE, đều trong domain CRM** (KHÔNG chạm finance):
  1. `advance-opportunity.ts` — cửa dùng chung: đã xác minh phủ cả advance thủ công LẪN 2 chuyển bước của lịch kiểm tra (chúng route qua đây, không tự ghi stage). 1 chỗ phủ 3 đường.
  2. `opportunityMarkLost` khi **reopen → O2** (`crm/router.ts:220`) — reset đồng hồ.
- **Row tạo mới lấy mốc từ DB `DEFAULT now()`** (đặt ở bước 3 migration) → KHÔNG cần sửa bất kỳ create-site nào, kể cả `crm:134` và walk-in `finance:356`. Đây là lý do P2 **thật sự không đụng file finance**.
- **Cố ý KHÔNG set tại `receiptApprove` (O4→O5, `finance:398`) và `receiptCancel` (O5→O4, `:517`).** O5 không bao giờ nguội; ca vừa hủy phiếu (O5→O4) mang mốc cũ → hiện "đang nguội" ngay = đúng nghiệp vụ. Ghi rõ semantics vào comment.
- Hiển thị: badge trên `pipeline.tsx` (data-testid riêng); cờ "nguội" tính dẫn xuất trong query list hiện có.

## Migration (thứ tự BẮT BUỘC — red-team)
1. `ADD COLUMN "stageChangedAt" TIMESTAMPTZ NULL` (**nullable, KHÔNG default** — tránh full-table rewrite dưới ACCESS EXCLUSIVE và tránh mọi dòng cũ bị gán mốc migration-time trông "vừa đổi").
2. Trong **cùng migration**, `UPDATE ... SET stageChangedAt = updatedAt` (backfill xấp xỉ; xem ghi chú bias dưới).
3. `ALTER COLUMN "stageChangedAt" SET DEFAULT now()` SAU khi backfill (metadata-only, KHÔNG rewrite; chỉ áp cho INSERT tương lai). → mọi create-site (kể cả finance walk-in) tự có mốc mà không cần sửa code. Đổi bước (UPDATE) vẫn phải set tường minh vì default chỉ áp lúc INSERT.

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` (`Opportunity` + `stageChangedAt`) + migration (nullable → backfill → SET DEFAULT now()); `apps/api/src/crm/advance-opportunity.ts` (set khi đổi bước); `apps/api/src/crm/router.ts` (set tại reopen `:220`; cờ nguội trong list); `apps/admin/src/pages/crm/pipeline.tsx` (badge).
- **KHÔNG sửa `finance/router.ts`** (create-site dùng DB default). Không sửa create `crm:134` (DB default lo).
- Create: journey `apps/e2e/.../crm-rotting.journey.ui.spec.ts` + DB seed helper lùi ngày.
- KHÔNG tạo: `worker/rotting-sweep.ts`, bảng cờ.

## Implementation Steps
1. `impact({target:"advanceOpportunityOneStep", direction:"upstream"})` + `impact` trên `opportunityList` — cảnh báo nếu HIGH/CRITICAL.
2. Migration theo đúng thứ tự trên.
3. Set mốc tại `advance-opportunity.ts` + reopen (2 chỗ UPDATE); create dùng DB default; unit test mọi cửa (advance, lịch test, reopen, create).
4. Thêm cờ "nguội" trong list + badge UI (data-testid riêng, không đổi cấu trúc phễu cũ).
5. Journey: seed lùi ngày (chứng minh "nhãn biến mất" sau thao tác) + case ngưỡng để chứng minh "nhãn xuất hiện"; pin toán tử biên `stageChangedAt < now - ngưỡng`.
6. `pnpm acceptance:report`; `detect_changes`; PR.

## Success Criteria
- [ ] `stageChangedAt` đúng ở mọi cửa đổi bước domain CRM (unit).
- [ ] Cơ hội O5 không bao giờ hiện nguội; ca vừa hủy phiếu hiện nguội ngay (test).
- [ ] `crm-receipt` journey **không hồi quy** (vì không đụng finance).
- [ ] Migration backfill chạy đúng thứ tự (dòng cũ có mốc từ `updatedAt`, không phải migration-time).

## Risk Assessment
- Không đụng finance → rủi ro lớn nhất đã bị loại bỏ.
- **Backfill bias (LOW):** `updatedAt` bị bump bởi cả thao tác không-đổi-bước (VD gán owner `crm:295`) → backfill **đánh giá cơ hội cũ "mới" hơn thực tế** (bỏ sót nguội, không báo động giả). Hướng lệch an toàn, tự đúng dần khi có đổi bước mới. Ghi 1 dòng comment.
- **Tiến độ (LOW):** P2 đụng cửa dùng-chung + migration + backfill + journey lùi-ngày → effort 2-3d (nới từ 2d).
- Rollback: drop cột `stageChangedAt` (migration down); gỡ badge. Cột nullable an toàn.

## Phụ lục kỹ thuật
- Cửa đổi bước đã xác minh (grep mọi ghi `stage`): `advanceOpportunityOneStep` (advance + lịch test route qua đây, `appointment/router.ts:130,191`), `receiptApprove` O4→O5 (`finance:398`, KHÔNG chạm), `receiptCancel` O5→O4 (`:517`, KHÔNG chạm), `markLost` reopen→O2 (`crm:220`, CÓ set), create O1 (`crm:134`, `finance:356`) lấy mốc từ DB `DEFAULT now()` → không cần code, không đụng finance. `crm:238`(markLost) và `:295`(assign) không đổi stage → không phải cửa đồng hồ.
