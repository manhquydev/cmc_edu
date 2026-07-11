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
- **Vòng đời phiếu (`ShiftRegStatus`):** `draft` → `submitted` → `approved` | `rejected` | `cancelled`.
  **Ticket-lock:** tối đa 1 phiếu `submitted` tại một thời điểm/nhân sự (unique partial index); `rejected`
  **KHÔNG** tính vào ticket-lock — nộp lại ngay sau khi bị từ chối. `fromDate` phải là ngày ICT tương
  lai tại thời điểm nộp (QĐ 0035).
- **QĐ (HR remediation, docs/22 ADR 0042): overlap rule** — 1 người chỉ được giữ **một khoảng
  `[fromDate,toDate]` `submitted`/`approved` tại một thời điểm, bất kể ShiftGroup nào** (chống đăng ký
  chồng chéo giữa 2 nhóm ca khác nhau). `rejected`/`cancelled` không tính vào overlap.
- **QĐ: gate duyệt ca = ROLE, không phải managerId chain.** `shift.approve`/`shift.reject` yêu cầu
  role khớp `ShiftGroup.type` (`GIAO_VIEN` → `giam_doc_dao_tao`; `KINH_DOANH` → `giam_doc_kinh_doanh`;
  `super_admin` bypass cả hai) + chống tự-duyệt (caller ≠ chủ phiếu). `reject` bắt buộc `reason` (≥3
  ký tự), ghi vào `ShiftRegistration.rejectReason` — chủ phiếu đọc lại qua `shift.myRegistrations`.

## 3. Lương (Payroll) — mô hình lương bậc greenfield

> **QĐ (HR remediation): baseSalary/đơnGiá/quota nguồn duy nhất là `SalaryTier` catalog** — 3 cột cũ
> trên `SalaryRate` (`baseSalary`, `variablePayRate`, `kpiMax`) đã **deprecated** (không writer mới
> ghi). `compensation.upsertRate` (nhập tay từng người) đã **BỎ** — thay bằng `assignTier` (gán bậc).
> Chi tiết công thức + rationale: **docs/22 ADR 0042**.

- **Công thức:** `totalNet = base(tier) + %côngca × %chỉ-số × đơnGiá(tier) − phạt`, trong đó:
  - `%côngca = min(1, shiftActual/tier.requiredShifts)`.
  - `%chỉ-số = min(1, metricValue/tier.requiredMetric)` — GV: giờ dạy quy đổi (`collectTeacherHours`,
    có nhân `creditFactor` theo độ trễ session-done, xem §4b); Sale: doanh thu phê duyệt (§4).
  - `phạt` luôn là dòng **độc lập** (không gộp vào `kpiBonus`/`baseSalary`), không bao giờ kéo
    `totalNet` xuống âm (clamp ≥ 0).
- **Công ca thực (`shiftActual`):** đếm DISTINCT `(date, shiftTemplateId)` từ entry `approved` trong
  kỳ, ghép với punch **vào/ra** qua `assignPunchesToShifts` (@cmc/domain-payroll): in-punch = punch sớm
  nhất trong `[start−2h, midpoint)`; out-punch = punch muộn nhất trong `[midpoint, end+2h]`. Thiếu 1
  trong 2 nửa = "vắng" (không tính công, không phạt phút, đếm vào `unpunchedDays`). **`shortSpan`**:
  khoảng vào→ra < 50% thời lượng ca danh nghĩa — cờ cảnh báo gian lận (không tự động chặn, GĐ review
  khi duyệt KPI/lương).
- **Phạt per-ca:** muộn/sớm tính **theo từng ca** (không gộp cả ngày) — `penaltyRatePerLateMinute`/
  `penaltyRatePerEarlyMinute` từ `CompensationPolicy` **per-facility** (fallback 500đ/phút muộn,
  1000đ/phút sớm khi cơ sở chưa cấu hình).
- **Miễn phạt ngày có ticket duyệt:** `ManualAttendanceTicket` **`approved`** cho một ngày → miễn phạt
  + miễn `unpunchedDays` cho **mọi** ca đăng ký ngày đó, bỏ qua bước ghép punch. `pending`/`rejected`
  không miễn. Ticket duyệt **sau khi payslip đã finalize** không hồi tố bảng lương đã khoá —
  `manualPunch.approve` trả `warning: 'PAYSLIP_FINALIZED'` để GĐ biết cần `payslip.reopen` + assemble
  lại thủ công nếu muốn áp dụng.
- **Gate duyệt ticket chấm công:** direct-manager (`managerId`) hoặc `super_admin` — chống tự-duyệt.
- **Đổi bậc lương (tier) giữa kỳ:** cho phép — `assignTier` không khoá theo kỳ đang chạy.
  `KpiScore.tierIdSnapshot`/`unitRateSnapshot` chụp tại thời điểm `kpi.refresh` giữ nguyên giá trị đã
  tính cho các slip đã `submitted`+ (audit trail đầy đủ dù tier đổi sau đó).
- **`payslip.assemble`:** tính lại `TOÀN BỘ` từ TimePunch/ShiftRegistration/KpiScore **live** mỗi lần
  gọi (không self-heal ngầm); từ chối nếu chưa gán `SalaryTier` (FORBIDDEN, không fallback legacy).
  `finalize` khoá; `reopen` mở lại để assemble tiếp. Bucket theo **tháng ICT** (UTC+7).
- **GĐ/super_admin không có phiếu lương trong hệ thống** ("lương giám đốc ngoài hệ thống") —
  `kpi.refresh`/`payslip.assemble` target GĐ/super_admin trả `BAD_REQUEST`.

## 4. KPI — lifecycle auto-score

> **QĐ (HR remediation): `kpi.submit`/`kpi.approve` (đơn lẻ)/`kpi.getForUser` đã BỎ** — thay bằng
> lifecycle auto-score dưới đây. `approved` **chỉ** đạt được qua `kpi.bulkApprove` (không có đường
> approve-1-phiếu nào khác ngoài `kpi.override` khi payslip đã reopen). Chi tiết: **docs/22 ADR 0042**.

- **Vòng đời (`KpiScore.status`):** `draft` → `submitted` → `confirmed` → `approved`.
  - `kpi.refresh`: recompute + upsert `draft` (idempotent, race-safe) — **không bao giờ ghi đè** một
    slip đã `submitted`+. Tự làm cho chính mình; làm cho người khác cần role director.
  - `kpi.submitSlip`: chủ phiếu tự nộp, **mở từ 00:00 ICT ngày 3 tháng kế tiếp** — tự `refresh` trong
    cùng transaction trước khi chuyển `submitted` (residual: buổi `done` sau thời điểm nộp cần GĐ
    override thủ công qua `kpi.override`).
  - `kpi.confirm`: **direct manager** (qua `managerId`) hoặc `super_admin` xác nhận
    (`submitted`→`confirmed`) — chống tự-xác-nhận.
  - `kpi.override`: director set `value` trực tiếp (có `overrideReason`, audit `override=true`).
    Sửa slip đã **`approved`** chỉ `super_admin`, **và chỉ khi** `Payslip` kỳ đó đã `reopen` về
    `draft` (van an toàn — không sửa ngầm số đã tất toán).
  - `kpi.bulkApprove`: 2 GĐ tất toán hàng loạt mọi slip `confirmed` **có `Payslip` đã `finalized`**
    trong kỳ, loại trừ phiếu của chính người duyệt (idempotent — chỉ đụng `confirmed`).
  - **Immutable sau finalize:** slip có `Payslip` kỳ đó `finalized` không sửa được (`confirm`/
    `override`) — phải `payslip.reopen` trước.
- **QĐ: branch-scope theo ROLE, không theo `position` free-text.** `kpi.bulkApprove`/`kpi.list` lọc
  target theo `AppUser.roles` (`sale` → phạm vi `giam_doc_kinh_doanh`; `giao_vien` → phạm vi
  `giam_doc_dao_tao`; `super_admin` thấy cả hai). Một GĐĐT gọi `bulkApprove` **không đụng** phiếu của
  `sale`, dù cùng kỳ.
- **Metric "doanh thu phê duyệt" (sale):** `SUM(Receipt.netAmount)` WHERE `status='approved'` AND
  `approvedAt` trong kỳ ICT, gắn theo `createdByAppUserId` (namespace AppUser, không dùng
  `createdById` legacy). **Đây là số GROSS** (chưa trừ `RefundRecord`) — nếu tương lai có transition
  trạng thái mới (vd `approved`→`sent`), phải cập nhật lại filter status ở đây, không được để lệch
  âm thầm.
- **GĐ/super_admin không có phiếu KPI** — cùng lý do §3 (lương ngoài hệ thống).

## 4b. Session-done engine (HR remediation) — chỉ chạy qua sweep worker

> Chi tiết thuật toán + rationale (vì sao KHÔNG hook trực tiếp trên router điểm danh/đánh giá/bằng
> chứng): **docs/22 ADR 0042**.

- **3 điều kiện `done` (tất cả phải đủ, đánh giá bởi worker sweep, không phải event hook):**
  1. **Điểm danh:** ≥1 dòng `present`.
  2. **Đánh giá:** MỌI học sinh `present` có `QualitativeAssessment` (`classSessionId`) status
     `confirmed`.
  3. **Bằng chứng buổi học:** `SessionEvidence` status `published`, ≥1 ảnh.
  - Gate thời gian: chỉ đánh giá khi `now >= session.endTime` (chặn "chốt trước giờ" để gian credit).
- **`doneAt` = snapshot đóng băng** — lấy giá trị **muộn nhất** trong 3 mốc (điểm danh cuối, xác nhận
  đánh giá cuối, publish bằng chứng) tại lúc `done`. Đánh dấu lại điểm danh/huỷ đánh giá **sau khi**
  `done` **không** đổi `doneAt` — **không hồi tố** credit đã tính.
- **`creditFactor(doneAt, endTime)` — hệ số tín chỉ giờ dạy theo độ trễ chốt buổi** (chỉ tính vào
  `collectTeacherHours` cho KPI GV, §4): trễ ≤24h → **1.0** (đủ); ≤48h → **0.5**; >48h → **0**. Session
  có `endTime` trước mốc kích hoạt engine (`SESSION_DONE_ACTIVATED_AT`) là lịch sử — backfill 1 lần,
  credit **luôn 1.0** không phân biệt trễ.
- **Auto-cancel 0-HS + buổi bù nối đuôi khóa:** session `planned`/`confirmed` quá `endTime + 24h` mà
  **0 điểm danh `present`** → tự `cancelled`. Nếu session có `scheduleSlotId` (không phải buổi thêm
  thủ công `addMakeup`), sweep **tự tạo buổi bù** nối vào **cuối** chuỗi slot lặp lại đó (cùng
  `scheduleSlotId`, 7 ngày sau buổi cuối cùng đã có trong slot — **có thể kéo dài lịch học qua
  `ClassBatch.endDate`** khi lớp nợ buổi). `ClassSession.makeupForSessionId` trỏ ngược về buổi gốc.
- **Conflict phòng → bỏ qua, chờ người xử lý:** nếu phòng của lớp bận vào ngày bù dự kiến, sweep
  **không tạo** buổi bù tự động, báo `roomConflict: true` trong kết quả — UI hiển thị buổi đã hủy
  chưa có buổi bù để GĐĐT xếp lịch thủ công.

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

## 8c. Runbook onboarding — trước kỳ lương ĐẦU TIÊN của một cơ sở

> Greenfield (validate session 4): `payslip.assemble`/`kpi.refresh` từ chối chạy cho bất kỳ ai chưa có
> `SalaryTier` gán — không có fallback từ lương cũ.

1. `salaryTier.create` — tạo ít nhất 1 bậc `KINH_DOANH` và 1 bậc `GIAO_VIEN` cho cơ sở (GĐKD/GĐĐT).
2. `compensation.assignTier` — gán bậc cho **TOÀN BỘ** nhân sự `sale`/`giao_vien` đang hoạt động của
   cơ sở (bỏ sót ai → người đó không `submitSlip`/`assemble` được, chặn ngay ở `kpi.refresh` với
   `tierMissing: true`).
3. (Tuỳ chọn) `compensationPolicy.upsert` — cấu hình lại `penaltyRatePerLateMinute`/
   `penaltyRatePerEarlyMinute` nếu khác mặc định 500đ/1000đ.
4. Xác nhận `AppUser.managerId` đã set đúng cho mọi `sale`/`giao_vien` (chuỗi báo cáo lên
   `giam_doc_kinh_doanh`/`giam_doc_dao_tao` tương ứng) — `kpi.confirm` cần đúng chuỗi này.

## 9. Truy vết nguồn

| Nghiệp vụ | Nguồn |
|---|---|
| Chấm công WiFi/IP | `checkin/router.ts` (`checkInOut.punch`) + `FacilityNetwork` |
| Phiếu chấm công thủ công | `checkin/router.ts` (`manualPunchRouter`) |
| Ca sale vs GV | `resolveShiftGroup()` + `ShiftGroup.selectionMode` + `shift/router.ts` + docs/22 ADR 0042 |
| Lương bậc (tier) | `payroll/router.ts` + `@cmc/domain-payroll` (`assembleSlip`, `assignPunchesToShifts`) + docs/22 ADR 0042 |
| KPI auto-score + lifecycle | `kpi/router.ts` + `kpi/auto-score.ts` + docs/22 ADR 0042 |
| Session-done engine | `class/session-done.ts` + `worker/session-done-sweep.ts` + docs/22 ADR 0042 |
| Đổi quà | `StarTransaction`/`Gift`/`Reward` enums; từ chối ngay + khoá tuần tự theo `giftId` trong `rewards/reward-router.ts` |
| Họp PH / test | `ParentMeeting`/`TestAppointment` |
| After-sale | `AfterSaleCase` + QĐ 0027 |

> **Khuyến nghị (như TL19):** rule ca sale-vs-GV (`selectionMode`) và cổng chấm công IP hiện sống
> trong code — nâng thành **ADR** để v2 tái mã hoá chắc chắn.

> Liên kết: TL19 (P1) · TL14 (vai trò) · TL01 (bất biến lương/ca) · TL04 (agent nhắc lịch/đối soát) ·
> docs/22 ADR 0042 (KPI auto-score + session-done engine, chi tiết đầy đủ).
