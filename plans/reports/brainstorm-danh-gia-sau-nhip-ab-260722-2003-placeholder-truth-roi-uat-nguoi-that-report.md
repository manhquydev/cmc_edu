# Brainstorm — hướng đi sau Nhịp A+B: sửa sổ nghiệm thu rồi UAT người thật

Ngày: 2026-07-22 · Branch `main` (`dd0b625`) · Vai: Solution Brainstormer

## Vấn đề

Nhịp A+B (`260722-1114`) đã xong 6/6 phase: 3 lỗi chặn luồng gỡ xong, teardown an toàn, runtime capture `0 denied`, lưới CI. Câu hỏi: **làm gì tiếp?**

Scout ra một sự thật làm đổi bức tranh:

- Plan `260707-2308-golive-sprint-land-sso-env-uat` **in-progress từ 2026-07-08**. P1/P2/P3 xong, **P4 (UAT Go/No-Go) treo 2 tuần** ở trạng thái "phần tự động xong, phần người chưa chạy".
- Trong 2 tuần đó chạy **3 plan liên tiếp về *bằng chứng*** (`0908` → `1114` → `1213`).
- F1/F2/F4 — 3 luồng lõi **chưa từng chạy được từ 2026-07-06** — mãi 2026-07-22 mới lộ.

⇒ **Gate tự động đã xanh trong khi sale không thu nổi học phí.** P4 tự tuyên bố "phần tự động xong" trên hệ thống có 3 luồng bất khả thi. Đây chính là lý do UAT người thật tồn tại, và nó là mảnh còn thiếu.

## Lỗ hổng còn lại (đã xác minh, không suy đoán)

| # | Nội dung | Mức |
|---|---|---|
| 1 | **Sổ nghiệm thu nói dối ở mức đếm**: `apps/admin/src/pages/finance/refund.tsx` là `EmptyState` (đã grep lại) nhưng P1-08 đếm `built` ⇒ "38/38 built" không đáng tin. Đây là **F7 của plan `0908` — rơi mất khi plan đó superseded**, chưa ai làm | **Cao** |
| 2 | **LMS chưa đo gì**: 14 route `/parent/*`,`/student/*` bị loại khỏi ma trận capture; 17 `lmsProcedure` cố ý không gọi `can()` | **Cao** |
| 3 | **UAT người thật chưa chạy** — thứ duy nhất bắt được lớp lỗi F1/F2 sớm | **Cao** |
| 4 | 16 tổ hợp `:param` chưa quét; 28 `canDo()` client vô hình với capture (mới rà 1 key `class.create`) | TB |
| 5 | GV đọc roster mọi lớp, rộng hơn `assert-teacher-owns-class.ts` | TB — đã ghi nhận |

## Bốn hướng đã cân

| | Được | Mất | Phán quyết |
|---|---|---|---|
| **A. UAT Phase 4 người thật** | Đường thẳng tới GO; bắt lỗi UX/dữ liệu/gate-client mà không công cụ nào thấy | Cần người + lịch, không phải việc agent làm một mình | **Chọn — bước 2** |
| **B. Mở rộng capture sang LMS** | Phủ nửa khách hàng thật | ~1 ngày; **là plan thứ tư về đo**; capture yếu đúng ở owner-check — nơi LMS authz sống (bài học `kpi.myScore` hôm nay) | Sau |
| **C. Placeholder detection (F7)** | Rẻ nhất (~2h); sửa trực tiếp "sổ nghiệm thu nói dối"; chặn UAT chạy trên tiền đề sai | Gần như không | **Chọn — bước 1** |
| **D. Siết lưới CI (chặn merge + capture vào CI)** | Rẻ | Chặn khi chưa biết tần suất báo động giả = cách nhanh nhất để team tắt gate (chính plan cảnh báo) | Cuối |

## Quyết định (PO chốt 2026-07-22)

| # | Quyết định |
|---|---|
| **B1** | Thứ tự: **C → A**. B và D sau |
| **B2** | `/finance/refund` (P1-08): **chỉ sửa cách đếm**, KHÔNG xây màn hoàn tiền |
| **B3** | Gate `acceptance:report` trong CI: **giữ cảnh báo** (`continue-on-error: true`), nâng lên chặn sau khi có dữ liệu tần suất báo động giả |

**Lý do C trước A:** UAT sẽ dựa trên sổ nghiệm thu. Để nó còn nói "38/38 built" trong khi một màn là placeholder thì UAT bắt đầu từ tiền đề sai.

**Lý do A trước B/D:** đã 3 plan liền dồn vào *đo*. Công cụ giờ đủ tốt. Cái thiếu không phải công cụ đo thứ tư — là **người thật bấm thật trên dữ liệu thật**. Làm B/D trước A = gold-plating hạ tầng đo trong khi go-live đứng yên.

## Cân nhắc khi thực thi

### C — Placeholder detection

- **Hai họ placeholder, không chỉ một:**
  1. `EmptyState` + text kiểu "Tính năng chưa áp dụng" (`finance/refund.tsx`)
  2. `ComingSoon` → "Đang phát triển" (`admin.routes.tsx:50`, `hr.routes.tsx:17`, `ops.routes.tsx:13`) — **inline element, không có page file** ⇒ scanner theo file sẽ bỏ sót
- **Bắt buộc ts-morph theo import graph, KHÔNG regex-first** (D5 plan `0908`, đã kiểm chứng: prototype regex chỉ resolve 13/40 màn, dính bug đuôi `.js` và `<Fallback />` của Suspense)
- **Không tự đặt target số route.** Baseline hiện tại scanner resolve **57 route** — red-team #22 cảnh báo bản đầu ghi target "46" tức **thấp hơn baseline**, đạt 46 = mất 11 route mà vẫn tuyên bố thành công. Sinh từ scanner, đừng viết tay
- **Falsification bắt buộc**: tạm biến một màn thật thành placeholder → luồng đó phải rớt khỏi `built`; revert. ⚠️ **Đừng falsify trên `/finance`** — spec UI assert heading "Phiếu thu học phí" (red-team #23). Dùng route nháp
- **Kiểm tác động exit code**: exit ≠ 0 hiện chỉ trigger trên *orphan chưa phân loại* + *unresolved namespace*, **không** trên `partial`. P1-08 đổi `built → partial` **không** làm CI đỏ — cần xác nhận lại bằng chạy thật, không suy luận
- Cập nhật mọi tài liệu đang tuyên bố "38/38 built"

### A — UAT Phase 4

- Đọc `plans/260707-2308-golive-sprint-land-sso-env-uat/phase-04-uat-gonogo.md` trước; phần tự động đã xong, chỉ còn phần người
- **Luật cứng rút từ F1**: UAT phải đi **trọn luồng bằng MỘT vai**, **cấm bắc cầu id** giữa các vai. Chính cơ chế bắc cầu `classBatchId` (`p1-runtime-proofs.spec.ts:49-63`) đã che F1 khỏi 38 runtime-proof
- Nhịp A vừa gỡ đúng 3 lỗi chặn ⇒ **giờ mới có khả năng** đi trọn luồng. Chạy UAT trước hôm nay chắc chắn tắc ở P1-02
- ⚠️ **Chọn DB cho UAT**: `cmcv2-prod-postgres-1` chứa **dữ liệu trẻ em thật** và đang publish `0.0.0.0:5432`. Cân nhắc chạy UAT trên `cmc-synth-pg` (synthetic seed) trừ khi UAT bắt buộc dữ liệu thật — cần PO quyết

## Tiêu chí thành công

**C**: P1-08 **không** còn `built`; falsification chứng minh scanner thật sự bắt placeholder; số route resolve **không tụt dưới 57**; `acceptance:report` vẫn exit 0 (partial không phải lỗi); cả 2 họ placeholder (`EmptyState` + `ComingSoon` inline) đều bị bắt.

**A**: mỗi luồng P1 lõi được **một vai** đi trọn từ đầu tới cuối, không truyền id giữa vai; biên bản Go/No-Go có chữ ký; mọi CRITICAL = 0.

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Scanner placeholder cho false positive → luồng thật bị hạ oan | TB | Falsification 2 chiều; whitelist có lý do từng mục |
| Bỏ sót họ `ComingSoon` inline (không có page file) | **Cao** | Bắt buộc test cho cả 2 họ trước khi đóng |
| UAT chạy nhầm trên DB có dữ liệu trẻ em thật | **Cao** | Chốt DB trước khi bắt đầu; ưu tiên synthetic |
| Lại sa vào xây công cụ đo thay vì UAT | TB | C giới hạn cứng ~2h; quá thì cắt scope, không mở rộng |

## Bước tiếp theo

1. Plan cho **C** (placeholder detection) — nhỏ, 1 phase là đủ
2. Sau C xanh: mở lại `260707-2308` Phase 4, điều phối UAT người thật
3. Sau UAT: cân B (LMS capture) và D (siết CI) dựa trên lỗi UAT thật tìm ra

## Câu hỏi chưa giải

1. **UAT chạy trên DB nào** — `cmc_synth` (an toàn) hay dữ liệu thật (sát thực tế hơn)? Chưa quyết.
2. **Ai đóng vai gì trong UAT** — cần 4 vai nghiệp vụ + phụ huynh/học viên; hiện chưa có danh sách người.
3. Actor thật của 4 luồng khai `nhan_vien` (P3-01, **P3-02**, P4-01, P4-03) — tồn từ plan `0908`, vẫn chưa ai trả lời. P3-02 khó nhất (`manualPunch.resubmit` cố ý không có registry key, dùng owner-check).
4. 7 màn còn dùng guard chép tay có chuyển sang `PermissionGate` không?
