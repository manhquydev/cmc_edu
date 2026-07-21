---
title: "Chấm công cặp vào/ra mỗi ngày (ADR 0043) — TDD"
description: "Rewrite lõi tính công từ ghép ±2h per-ca sang mô hình cặp vào/ra mỗi ngày: checkin=mốc đầu, checkout=mốc cuối; offsite vẫn ghi nhận + tạo phiếu duyệt theo GĐ track; late/early 1 lần/ngày theo khung ngoài cùng; bỏ chấm bù ngày tùy ý + bỏ shortSpan. Ảnh hưởng payroll + KPI."
status: completed
priority: P1
branch: "feat/attendance-daily-inout"
tags: [backend, payroll, kpi, attendance, checkin, tdd, schema, admin-ui, harness]
blockedBy: []
blocks: []
supersedes: "attendance-pairing model từ plans/260711-1752-hr-kpi-shift-attendance-remediation (completed)"
created: "2026-07-13T10:09:45.716Z"
createdBy: "ck:plan"
source: skill
---

# Chấm công cặp vào/ra mỗi ngày (ADR 0043) — TDD

## Overview

Input: `docs/decisions/0043-attendance-daily-inout-pairing.md` +
`plans/reports/brainstorm-260713-1535-attendance-daily-inout-pairing-report.md` +
Validation Log (dưới, 8 quyết định).

Thay lõi ghép công **`assignPunchesToShifts`** (ghép ±2h per-ca, dùng chung
payroll + KPI, do plan `260711-1752` thiết lập — nay bị ADR 0043 supersede) bằng
mô hình **cặp vào/ra mỗi ngày**. Đây là refactor money-logic (lương + KPI) blast
radius lớn → **TDD bắt buộc**: mỗi phase viết test khóa hành vi trước, rồi mới đổi.

**5 role active:** `sale`, `giao_vien`, `giam_doc_kinh_doanh` (GĐKD),
`giam_doc_dao_tao` (GĐĐT), `super_admin`. Duyệt phiếu chấm công đổi từ "quản lý
trực tiếp" (`managerId`) → **GĐ theo track** (sale→GĐKD, giáo viên→GĐĐT), đồng bộ
`compensation.assignTier` branch-scope pattern.

## Mô hình khóa (nguồn sự thật cho impl)

**Ghi nhận punch**
- Mỗi lần bấm append 1 `TimePunch`, gắn cờ `withinNetwork` (trong/ngoài dải
  `FacilityNetwork`). Cơ sở không khai báo mạng → coi như trong mạng (giữ hành vi
  dev-open hiện tại).
- Bỏ cooldown 5 phút → chống double-tap **10 giây**. Giữ `FOR UPDATE` serialize.
- Bấm **ngoài mạng KHÔNG còn bị từ chối** — vẫn ghi punch; lần offsite đầu ngày
  bắt buộc kèm lý do (thiếu → `appCode: OFFSITE_REASON_REQUIRED`).

**Cặp vào/ra & tính công (per ngày, per nhân viên)**
- checkin = punch **đầu** ngày; checkout = punch **cuối** ngày (phải là 2 punch
  KHÁC nhau). Ngày < 2 punch → chỉ có checkin, **không checkout → không công**
  ngày đó (checkin vẫn lưu để minh bạch).
- **Ca được tính công (E3):** một ca đăng ký approved được tính công **chỉ khi**
  khung ca `[start,end]` **giao** với cặp `[checkin, checkout]` (overlap ⇔
  `start < checkout && end > checkin`). Ca bị bỏ hoàn toàn (vào sau khi ca đã hết,
  hoặc ra trước khi ca bắt đầu) → **không công**. Các ca có giao đều được tính (kể
  cả cách quãng, miễn cặp có giao).
- Không có ca approved giao với cặp → không công ngày đó dù có chấm.
- Muộn/sớm **1 lần/ngày theo khung ngoài cùng của CÁC CA ĐƯỢC TÍNH**: muộn =
  max(0, checkin − giờ bắt đầu ca **được tính sớm nhất**); sớm = max(0, giờ kết
  thúc ca **được tính muộn nhất** − checkout). Không cộng dồn per-ca. (Ca bị bỏ
  KHÔNG kéo khung → không tạo phạt ảo cho ca không dự.)

**Hợp lệ tự động vs phiếu**
- Ngày **mọi** punch trong mạng → hợp lệ tự động, không phiếu.
- Ngày có **≥1** punch ngoài mạng → cả ngày thành 1 `ManualAttendanceTicket`
  (pending), ghi `checkInAt`=mốc đầu, `checkOutAt`=mốc cuối; **luôn duyệt tay,
  không tự duyệt** (kể cả checkin trong mạng, checkout ngoài mạng). Duyệt = cặp
  giờ đó thành hợp lệ → tính công + muộn/sớm như trên. Từ chối = ngày không công,
  cho gửi lại lý do (`resubmitted`).

**Bỏ**
- `manualPunch.create` nhập ngày tùy ý (chấm bù ngày quên) — bỏ hẳn.
- Cờ `shortSpan` (span<50%) + `shortSpanShifts` trên KPI — bỏ hẳn.

## Validation Log (2026-07-13)

1. Muộn/sớm **1 lần/ngày** theo khung ngoài cùng (không cộng dồn per-ca). Chấp
   nhận giảm tiền phạt so mô hình cũ.
2. Ngày **< 2 punch** (chỉ checkin) → **không công** ca ngày đó; checkin vẫn lưu.
3. Ngày **không có ca approved** → không công dù có chấm.
4. Hợp lệ tự động = **mọi** punch trong ngày đều trong mạng; **1** punch offsite
   → cả ngày thành phiếu duyệt tay.
5. Phiếu ghi `checkInAt`=mốc đầu, `checkOutAt`=mốc cuối bất kể mốc nào offsite.
6. Bỏ `shortSpan`/`shortSpanShifts`.
7. Phiếu từ chối → không công + cho gửi lại (`resubmitted`).
8. Duyệt phiếu = **GĐ theo track** (bỏ `managerId`).

### Validate vòng 2 (2026-07-13)

9. **E1 — chặn sàn `totalNet = 0`**: phạt trừ tối đa bằng (lương+KPI), không âm.
   `assembleSlip` cap `penaltyAmount ≤ base+kpiBonus`; totalNet = max(0, …).
10. **E2 — offsite ngày KHÔNG có ca approved**: vẫn ghi punch (lịch sử), **KHÔNG
    tạo phiếu**, KHÔNG bắt lý do (không có ca để duyệt/tính công).
11. **E3 — ca chỉ tính nếu khung ca GIAO với [checkin, checkout]**; muộn/sớm theo
    khung ngoài cùng của các ca ĐƯỢC TÍNH (xem Mô hình khóa).

## Edge Case Ledger (rà vòng 2 — đã chốt cách xử)

| Edge | Xử lý | Phase |
|------|-------|-------|
| checkin == giờ ca bắt đầu | muộn=0 (max(0,·)) | 2 (test) |
| checkout luôn ≥10s sau checkin | cooldown 10s đảm bảo, không span 0 | 2/3 |
| punch 00:30 sang ngày ICT khác | thuộc ngày khác; ngày không ca → chỉ punch | 2/3 |
| 2 GĐ duyệt 1 phiếu đồng thời | TOCTOU guard `WHERE status IN (pending,resubmitted)`; race → BAD_REQUEST | 4 |
| phiếu pending lúc chốt lương | ngày không công; duyệt sau → reassemble (draft) / warning (finalized) | 5 |
| ticket cũ không có giờ vào/ra | approved mà thiếu cặp → không công; greenfield chấp nhận; migration dedupe | 1 |
| template ca end ≤ start (qua đêm) | ngoài scope core; ghi note siết validate ở template creation | 8 |
| checkin trong mạng + checkout offsite | cả ngày thành phiếu; checkInAt (trong mạng) + checkOutAt (offsite); duyệt cả cặp | 3 |
| cặp vào/ra không giao ca nào | không công ngày đó (như vắng), không phạt | 2/5/6 |
| offsite + không có ca (E2) | punch ghi, không phiếu, không reason | 3 |
| ca bỏ hoàn toàn (E3) | không công; không kéo khung phạt | 2/5/6 |
| phạt > thu nhập (E1) | totalNet sàn 0; penaltyAmount cap = base+kpi | 5 |
| **F1** punch ghi đè phiếu vừa được approve (race) | update phiếu ở punch có guard `WHERE status IN (pending,resubmitted)`; P2025→bỏ qua, giữ đóng băng | 3 |
| **F2** GĐ duyệt ca SAU khi nhân sự punch offsite → mất công | `hasShift` tính cả `submitted` (không chỉ approved) → phiếu vẫn tạo; credit vẫn chỉ ca approved | 3/5/6 |
| **F3** proxy/IP null → mọi punch offsite → GĐ ngập phiếu | rủi ro vận hành (không đổi thiết kế); monitor theo `docs/trusted-proxy.md`, ADR 0039 caveat | 3 (risk) |
| requiredShifts=0 → KPI value 0 | hành vi CŨ, ngoài scope plan này; ghi nhận | — |
| `unpunchedDays` đếm theo SỐ CA (không phải ngày) | misnomer CŨ giữ nguyên (blast radius rename); ghi nhận | 5 |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Schema & migration](./phase-01-schema-migration.md) | Completed |
| 2 | [Domain core computeDayAttendance](./phase-02-domain-core-computedayattendance.md) | Completed |
| 3 | [Backend punch offsite+reason](./phase-03-backend-punch-offsite-reason.md) | Completed |
| 4 | [Backend ticket approval track](./phase-04-backend-ticket-approval-track.md) | Completed |
| 5 | [Payroll integration](./phase-05-payroll-integration.md) | Completed |
| 6 | [KPI integration](./phase-06-kpi-integration.md) | Completed |
| 7 | [Frontend punch+ticket UI](./phase-07-frontend-punch-ticket-ui.md) | Completed |
| 8 | [Docs sync + e2e + harness](./phase-08-docs-sync-e2e-harness.md) | Completed (e2e 20/20 pass, api 759/759 pass, typecheck 26/26 pass, story verify: pass) |

**Thứ tự bắt buộc:** 1 → 2 → (3, 4 song song được) → 5 → 6 → 7 → 8. Phase 2 là
lõi thuần, TDD trước; phase 5/6 phụ thuộc 2+3+4; phase 8 chốt sau cùng.

## Acceptance Criteria (toàn plan)

- [x] Punch trong mạng → hợp lệ; punch ngoài mạng → ghi nhận + phiếu pending, lần
      offsite đầu ngày bắt buộc lý do.
- [x] checkin=mốc đầu, checkout=mốc cuối; ngày <2 punch → không công.
- [x] Ca chỉ có công nếu khung ca giao [checkin,checkout] (E3); muộn/sớm 1 lần/ngày
      theo khung ngoài cùng của các ca được tính.
- [x] `totalNet` sàn 0, không âm (E1); offsite ngày không ca → punch, không phiếu (E2).
- [x] Phiếu duyệt theo GĐ track (sale→GĐKD, GV→GĐĐT), anti-self, từ chối→gửi lại.
- [x] Phiếu approved feed cặp giờ vào payroll + KPI; pending/rejected → không công.
- [x] `manualPunch.create` ngày tùy ý bị bỏ; `shortSpan`/`shortSpanShifts` bị bỏ.
- [x] Cooldown 5' → chống double-tap 10s.
- [x] Trang chấm công: nút đổi trạng thái 5s tự về; modal lý do khi offsite; phiếu
      hiện 2 cột giờ; màn duyệt GĐ track. URL drift `/attendance/check-in-out` vs
      `/hr/checkin` được đồng bộ.
- [x] Docs (TL27/10/11/19/20) + ADR 0043 status flip sang implemented; e2e
      attendance-lifecycle chạy thật xanh (20/20, xem phase 8 "Verification note");
      harness story verify: pass.

## Dependencies

- Supersedes (không blocking, đã completed): `plans/260711-1752-hr-kpi-shift-attendance-remediation`
  — plan này thiết lập `assignPunchesToShifts` ±2h mà ADR 0043 thay. Không có
  plan active nào chồng lấn file → không cần cập nhật frontmatter chéo.

## Red Team Review (2026-07-13)

| # | Mức | Phát hiện | Xử lý |
|---|-----|-----------|-------|
| R1 | CAO | Punch offsite mới sau khi phiếu đã duyệt kéo dài checkout → công tăng ngoài kiểm soát (gian lận checkin sớm/checkout muộn né duyệt). | **Vá:** đóng băng `checkInAt/checkOutAt` khi phiếu approved/rejected; payroll+KPI ngày offsite-approved dùng giờ đóng băng trên phiếu, không punch live. Phase 3/5/6 + test 7b. |
| R2 | CAO | Logic `dayValid`/`present` trùng ở payroll & KPI → nguy cơ lệch, KPI tính công khác payroll. | **Vá:** tách helper CHUNG `resolveDayCredit` tại `apps/api/src/attendance/day-credit.ts`, cả 2 router dùng. Phase 5 tạo, phase 6 phụ thuộc. |
| R3 | TRUNG | Chủ phiếu role null (GĐ/super_admin) → không track → không ai duyệt. `resolvePayrollTargetRole` chưa export. | **Vá:** role null → chỉ super_admin duyệt; tách target-role resolver sang module `attendance/` dùng chung. Phase 4. |
| R4 | TRUNG | 1 phiếu/ngày chưa có unique index → đua tạo 2 phiếu. | **Vá:** unique `(appUserId, ticketDate)` + dọn trùng cũ. Phase 1. |
| R5 | THẤP (chấp nhận) | Bỏ `shortSpan` → bấm 2 phát cách 10s = đủ cặp = đủ công cả ngày (gian lận "bấm rồi về"). | **Không vá** — hệ quả trực tiếp của quyết định bỏ shortSpan + "ưu tiên đơn giản". Ghi Open Questions là rủi ro chấp nhận có ý thức. |
| R6 | THẤP | Reason offsite là free text hiển thị cho GĐ. | Không vấn đề: React escape, Prisma param — không XSS/SQLi. Giữ. |
| R7 | THẤP | Cancel modal lý do lúc checkout offsite = mất checkout = mất công. | Đúng thiết kế chống gian lận; phase 7 làm rõ UX (cảnh báo "chưa checkout"). |

Whole-plan consistency: sau vá, không còn tham chiếu `assignPunchesToShifts`/
`shortSpan` trong phase impl; nguồn cặp giờ nhất quán (đóng băng) giữa phase 3/5/6;
helper chung chốt DRY R2. Không còn mâu thuẫn chéo phase.

**Vòng 3 (2026-07-13) — edge-hunt sâu:** thêm F1 (race punch↔approve → guard
conditional update), F2 (ca duyệt-sau → hasShift tính submitted, chống mất công),
F3 (proxy/IP null → risk vận hành, monitor). 2 mục pre-existing (requiredShifts=0,
unpunchedDays misnomer) ghi nhận ngoài scope. **Đánh giá: plan đã BÃO HÒA** — không
còn edge nghiệp vụ mơ hồ cần user quyết; các vòng sau sẽ chỉ lặp lại.

## Open Questions

- **Rủi ro chấp nhận (R5):** bấm 2 lần cách ≥10s vẫn đủ "có công cả ngày" — bỏ
  shortSpan mở lỗ này. Người dùng đã chọn "ưu tiên đơn giản". Nếu sau muốn siết:
  thêm min-span hoặc yêu cầu checkin gần giờ ca. Ghi nhận, KHÔNG làm trong plan này.
- Nghỉ phép/ốm hợp lệ (ngày không đi làm không bị trừ) — ngoài phạm vi; cần module
  nghỉ phép riêng.
- Nhắc nhân viên cuối ngày nếu chưa checkout (tránh mất công vì quên) — nice-to-have;
  phase 7 cân nhắc banner cảnh báo nhẹ (R7).
