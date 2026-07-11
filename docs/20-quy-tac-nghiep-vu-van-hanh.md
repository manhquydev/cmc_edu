# Tài liệu 20 — Quy tắc Nghiệp vụ chi tiết P2 (Vận hành: Chấm công · Ca · Lương · KPI · Đổi quà · Họp PH · After-sale)

> Phần 2 của quy tắc nghiệp vụ (P1 = TL19: mã/chương trình/bài PDF). Gom các nghiệp vụ **vận hành**
> từ code + decisions. **Huy hiệu (badge) đã LOẠI khỏi scope v2** (quyết định của bạn). Đổi quà, họp
> PH, after-sale: **giữ**.
> Nguồn: `apps/api/src/routers/*`, `schema.prisma`, `docs/decisions/*`.

---

## 1. Chấm công (Check-in / Check-out) — cơ chế WiFi/IP

Cơ chế: khớp **IP client với dải mạng cơ sở**, không phải GPS.

- **FacilityNetwork:** mỗi cơ sở khai báo các dải IP hợp lệ — `ipAddress` dạng **CIDR**
  (`192.168.1.0/24`) hoặc IP đơn (`152.42.167.189`), có `label` ("WiFi VP chính"), `isActive`.
- **Khi chấm công:** lấy IP client (`ctx.ip`, từ header proxy) → hàm `ipMatchesCidr` so với các dải
  active của cơ sở.
  - IP khớp → chấm công **`method: 'ip'`** (hợp lệ tự động, đang trong WiFi công ty).
  - IP không khớp → **`method: 'manual'`** → phải qua **phiếu chấm công thủ công** (QĐ 0034).
- **Cooldown:** vừa chấm xong phải đợi một chút mới chấm lại (chống double-punch) → lỗi `CONFLICT`.
- **Duyệt phiếu thủ công:** **không tự duyệt của mình** (`FORBIDDEN`); **chỉ manager trực tiếp**
  duyệt/từ chối (`FORBIDDEN` nếu không phải). Phiếu theo **ngày**, 1 lý do, 1 lần duyệt (QĐ 0034).
- Bản ghi lưu `ipAddress` + `method` để audit.

## 2. Cơ chế ca & Đăng ký công ca — **sale vs giáo viên KHÁC nhau**

Đây là điểm bạn nhấn: hai vai trò có **hình thức công ca khác nhau**, thể hiện qua **ShiftGroup**.

- **ShiftGroup** phân theo `code` + **`selectionMode`**:
  - `KINH_DOANH` (sale, cskh, ctv_mkt) — hàm `resolveShiftGroup` map các role KD vào nhóm này.
  - `GIAO_VIEN` (giáo viên) — map role dạy vào nhóm này.
  - **`selectionMode` = `SINGLE` | `MULTIPLE`** → **chính là điểm khác biệt**: một nhóm cho chọn
    **một** ca/ngày (khối văn phòng cố định), nhóm kia cho chọn **nhiều** ca (giáo viên dạy theo
    buổi, đăng ký nhiều slot). (Chốt selectionMode cụ thể cho từng nhóm theo cấu hình cơ sở.)
- **ShiftTemplate:** các ca `code` = `CA_SANG`/`CA_CHIEU`/`CA_TOI`, `startTime`/`endTime`
  ("08:00"–"12:00"), màu, thứ tự — thuộc một ShiftGroup.
- **ShiftEntryType:** `work` (đăng ký ca làm) | `leave` (đăng ký nghỉ).
- **Vòng đời phiếu (`ShiftRegStatus`):** `draft` → `submitted` → `approved` | `cancelled`.
  **Ticket-lock:** 1 phiếu Nháp/Chờ duyệt tại một thời điểm; `fromDate` phải tương lai (Asia/Saigon)
  (QĐ 0035).
- **Người duyệt (managerId + fallback theo nhóm):** cấp trên trực tiếp qua `managerId`; nếu hết chuỗi,
  **fallback theo shift group** — nhóm `GIAO_VIEN` → **giám đốc đào tạo**; nhóm `KINH_DOANH` → **giám
  đốc kinh doanh**. Chống tự-duyệt (QĐ 0027). (Role `bgd` cũ đã bỏ.)

## 3. Lương (Payroll)

- **SalaryRate (các thành phần):** `baseSalary` + `mealAllowance` + `otherAllowance` + KPI (tối đa
  `kpiMax`), `monthlyQuota` (định mức tháng), `effectiveFrom`. Tất cả **sửa được qua UI**, safe-default
  cho tham số mơ hồ (QĐ 0012).
- **Phạt:** 500đ/phút muộn, 1000đ/phút sớm; trừ **POST-TAX** (sau thuế, không méo thu nhập chịu thuế);
  override miễn/giảm của giám đốc là **field riêng** (không dùng `variablePay`) — QĐ 0025.
- **Payslip self-healing:** `assembleSlipData` gộp phạt từ punch **LIVE** mỗi lần gọi; `finalize`
  khoá; `reopen` tính lại từ punch. Bucket theo **tháng ICT** (UTC+7).
- **Báo cáo công tháng** (`checkInOut.monthlyReport`): giám đốc drill-down, aggregate server-side.

## 4. KPI

- **KpiScore vòng đời (`KpiStatus`):** `draft` → `submitted` → `confirmed` → `approved`.
- **Cơ chế:** auto-score + **override theo cây quyền** + **audit** (QĐ 0011). KPI feed vào lương (cap
  `kpiMax` trong SalaryRate). KPI sale có thể lấy số liệu gọi (Callio — QĐ 0010, khi bật).

## 5. Đổi quà (Rewards) — GIỮ; sao thưởng

Học viên tích **sao** (star) từ bài tập → đổi quà.

- **StarTransaction (`StarTxnType`):** `homework_completed` (kiếm sao khi hoàn thành bài) ·
  `gift_redeemed` (tiêu sao đổi quà) · `gift_rejected_refund` (hoàn sao nếu quà bị từ chối) · `manual`
  (điều chỉnh tay).
- **Gift (quà):** `name`, `imageUrl`, **`starsRequired`** (số sao cần), `stock` (**-1 = không giới
  hạn**), `isActive`. **KHÔNG có `minLevel`** — schema (`packages/db/prisma/schema.prisma`) không có
  trường này; mọi mô tả trước đây về "cấp độ tối thiểu để đổi" là doc-drift, đã bỏ khỏi tài liệu
  (product-decision 2026-07-11, YAGNI — không xây tier system khi chưa có yêu cầu sản phẩm cụ thể).
- **Reward vòng đời (`RewardStatus`):** `pending` (HS yêu cầu đổi) → `approved` → `delivered` (đã
  trao) | `rejected` (từ chối → hoàn sao qua `gift_rejected_refund`).
- Nguồn sao chính: bài tập `graded` cộng `starReward` (TL19 §6).
- **Từ chối ngay, không xếp hàng chờ:** thiếu sao (`balance < starsRequired`) hoặc hết `stock`
  (`stock === 0`, sau khi trừ dần từ giá trị dương; `-1` = vô hạn không bao giờ hết) → `redeem` trả lỗi
  `BAD_REQUEST` **ngay lập tức** ("Insufficient stars." / "Out of stock.") — không có cơ chế giữ chỗ
  hay xếp hàng chờ hàng về.
- **Đổi quà đồng thời cho cùng một Gift được tuần tự hoá:** khoá giao dịch Postgres theo `giftId`
  (`pg_advisory_xact_lock(hashtext(giftId))`) đảm bảo 2 HS đổi cùng lúc đơn vị `stock` cuối cùng của
  **cùng một quà** không cùng đi qua được — `stock` và số dư sao được **đọc lại bên trong khoá** (sau
  khi đã acquire) trước khi so sánh/trừ, chặn race giữa lúc pre-check và lúc ghi (`rewards/reward-router.ts`).

## 6. Họp phụ huynh & Lịch test

- **ParentMeeting (`ParentMeetingStatus`):** `scheduled` → `done` | `cancelled`. Lịch họp PH, nhắc lịch
  (Communication agent — TL4).
- **TestAppointment:** `TestType` = `entrance` (test đầu vào) | `periodic` (định kỳ); `TestStatus` =
  `scheduled` → `done` | `no_show`. Nối CRM (test đầu vào ~ giai đoạn O3 học thử) và đánh giá định kỳ.

## 7. After-sale (Chăm sóc sau bán) — GIỮ

- **AfterSaleCase (`CaseStatus`):** `open` → `in_progress` → `resolved` → `closed`; **`CasePriority`**:
  `low` | `normal` | `high`.
- **Phụ trách:** hiện `sale` đảm nhiệm (role `cskh` tạm gác — ADR-D); `afterSale.*` cấp cho sale
  (QĐ 0027). `setStudentLifecycle` vẫn chỉ giám đốc.

## 8. Nghiệp vụ LOẠI khỏi scope v2

- **Huy hiệu (Badge / StudentBadge / BadgeSource):** **bỏ** theo quyết định của bạn. Giữ bảng trong
  DB (không xoá cứng để khỏi vỡ dữ liệu cũ) nhưng **không build UI/nghiệp vụ** ở v2. Đổi quà (sao)
  vẫn giữ độc lập.

## 8b. Thông báo & Email (Notification / EmailOutbox)

- **StaffNotifEvent (11 loại sự kiện đẩy thông báo nhân viên):** `class_cancelled`, `enrollment_new`,
  `receipt_pending_approval`, `kpi_pending_review`, `chatter_note`, `shift_reg_submitted/approved/
  rejected`, `manual_punch_pending/resubmitted/rejected`. Mỗi sự kiện → thông báo tới đúng người liên
  quan (vd `receipt_pending_approval` → GĐKD).
- **Email qua Outbox** (transactional outbox — TL18): ghi vào `EmailOutbox` trong cùng transaction,
  worker relay. **`EmailStatus`:** `queued` → `sending` → `sent` | `failed` | `skipped`.
- **`EmailTransport`:** `graph` (nội bộ, nhân viên `@cmcvn.edu.vn`) | `brevo` (người nhận ngoài —
  phụ huynh) — QĐ 0013, 0030. `skipped` = no-op khi chưa cấu hình `GRAPH_*`.
- **Template:** subject + template theo loại (đăng nhập PH, phiếu chờ duyệt, nhắc lịch…). Nội dung
  chạm dữ liệu trẻ tuân TL08 §7.

## 9. Truy vết nguồn

| Nghiệp vụ | Nguồn |
|---|---|
| Chấm công WiFi/IP | `routers/check-in-out.ts` + `FacilityNetwork` |
| Ca sale vs GV | `resolveShiftGroup()` + `ShiftGroup.selectionMode` + QĐ 0035/0027 |
| Lương/phạt | QĐ 0025, 0012 + `SalaryRate` |
| KPI | QĐ 0011, 0010 |
| Đổi quà | `StarTransaction`/`Gift`/`Reward` enums; từ chối ngay + khoá tuần tự theo `giftId` trong `rewards/reward-router.ts` |
| Họp PH / test | `ParentMeeting`/`TestAppointment` |
| After-sale | `AfterSaleCase` + QĐ 0027 |

> **Khuyến nghị (như TL19):** rule ca sale-vs-GV (`selectionMode`) và cổng chấm công IP hiện sống
> trong code — nâng thành **ADR** để v2 tái mã hoá chắc chắn.

> Liên kết: TL19 (P1) · TL14 (vai trò) · TL01 (bất biến lương/ca) · TL04 (agent nhắc lịch/đối soát).
