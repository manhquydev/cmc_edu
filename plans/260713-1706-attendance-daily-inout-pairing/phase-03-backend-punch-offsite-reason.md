---
phase: 3
title: "Backend punch offsite+reason"
status: pending
priority: P1
dependencies: [1]
---

# Phase 3: Backend punch offsite+reason

# Overview
Sửa `checkInOut.punch`: không từ chối offsite nữa — ghi punch kèm cờ
`withinNetwork`; lần offsite đầu ngày bắt buộc lý do và tạo phiếu; cập nhật
`checkInAt`/`checkOutAt` của phiếu ngày đó theo mốc đầu/cuối. Cooldown 5' → 10s.

## Requirements
- Functional:
  - Punch trong mạng → `withinNetwork=true`, không phiếu (trừ khi ngày đã có phiếu
    do lần offsite trước → punch này gắn vào phiếu, cập nhật checkOutAt).
  - Punch ngoài mạng → `withinNetwork=false`. Nếu ngày CHƯA có phiếu → **bắt buộc**
    `reason`; thiếu → `appCode: OFFSITE_REASON_REQUIRED` (không ghi punch). Có reason
    → ghi punch + tạo phiếu `pending` với `note=reason`, `checkInAt=mốc đầu ngày`.
  - Mỗi punch (bất kể trong/ngoài mạng) trên ngày ĐÃ có phiếu → cập nhật
    `checkInAt=mốc đầu`, `checkOutAt=mốc cuối` của phiếu (nếu ≥2 punch).
- Non-functional: giữ `FOR UPDATE` serialize; cooldown 10s; facility-scoped RLS.

## Architecture
- Input đổi: `punch` nhận optional `{ reason?: string (max 2000) }`.
- Bỏ nhánh `throw IP_NOT_ALLOWED`. Thay bằng: tính `withinNetwork` = (không có
  `FacilityNetwork` active) OR (IP khớp 1 dải). Ghi vào `TimePunch.withinNetwork`.
- Cooldown: `PUNCH_COOLDOWN_MS = 10_000`. Giữ appCode `COOLDOWN`.
- **E2 + F2 — chỉ tạo phiếu khi ngày CÓ đăng ký ca (submitted hoặc approved):**
  trước khi tạo/bắt reason, kiểm tra ngày đó có `ShiftRegistrationEntry` thuộc
  registration status **`submitted` HOẶC `approved`** không. Nếu **không có đăng ký
  ca nào** → chỉ ghi punch (kèm cờ withinNetwork), **KHÔNG tạo phiếu, KHÔNG bắt
  reason**. **F2 (chống mất công):** tính cả `submitted` để phiếu vẫn được tạo khi
  GĐ chưa kịp duyệt ca lúc nhân sự punch — nếu chỉ tính `approved`, ca duyệt-sau sẽ
  không có phiếu → mất công. Payroll/KPI vẫn chỉ CREDIT ca `approved` (E3), nên
  phiếu ứng với ca bị từ chối sau đó là vô hại.
- Sau khi ghi punch, trong cùng tx:
  - Lấy mọi punch của appUser trong ngày ICT đó (dùng `ictDateOnlyOf` + bounds).
  - firstPunch = sớm nhất, lastPunch = muộn nhất (≥2 punch mới có lastPunch≠first).
  - anyOffsite = ngày có punch nào `withinNetwork=false`.
  - hasShift = ngày có ≥1 ShiftRegistrationEntry (registration submitted|approved).
  - Nếu `anyOffsite && hasShift`:
    - Tìm phiếu ngày đó (`ManualAttendanceTicket` theo appUserId + ticketDate).
    - Nếu chưa có: **cần reason** (nếu punch hiện tại là offsite và chưa có phiếu).
      Thiếu reason → ném `OFFSITE_REASON_REQUIRED` TRƯỚC khi ghi punch (validate sớm).
      Có → tạo phiếu `pending`, `note=reason`, `checkInAt=firstPunch`,
      `checkOutAt = ≥2 punch ? lastPunch : null`.
    - Nếu đã có phiếu **`pending`/`resubmitted`**: cập nhật `checkInAt`/`checkOutAt`
      theo mốc đầu/cuối ngày — **F1 (giữ đóng băng dưới race):** update CÓ ĐIỀU KIỆN
      `WHERE id AND status IN ('pending','resubmitted')`. Nếu GĐ vừa approve xen giữa
      (P2025 / 0 row) → bỏ qua, KHÔNG ghi đè (đóng băng an toàn). Không đọc-status-
      rồi-ghi không guard.
    - **Red-team R1 (chống gian lận punch sau duyệt):** phiếu **`approved`/`rejected`**
      → **KHÔNG đổi `checkInAt`/`checkOutAt`** (đóng băng tại thời điểm duyệt).
      Punch mới cùng ngày vẫn ghi vào `TimePunch` (lịch sử) nhưng KHÔNG chạm phiếu,
      KHÔNG tự mở lại. Payroll/KPI ngày offsite-approved dùng GIỜ ĐÓNG BĂNG trên
      phiếu (phase 5/6), nên punch muộn thêm không thể kéo dài công đã duyệt.
  - Nếu ngày toàn trong mạng: không tạo phiếu.
- **Thứ tự validate reason vs ghi punch:** kiểm tra "offsite + chưa có phiếu +
  thiếu reason" TRƯỚC khi `timePunch.create` để không tạo punch mồ côi.

## Related Code Files
- Modify: `apps/api/src/checkin/router.ts` (`checkInOut.punch` + có thể tách helper
  `ensureDayTicket(tx, ...)`)
- Modify: `apps/api/src/errors.ts` (nếu cần hằng appCode mới — hoặc chỉ chuỗi)
- Modify: `apps/api/src/checkin/ip-match.test.ts` (điều chỉnh kỳ vọng offsite)

## TDD Test Plan (test-first)
Sửa/thêm trong `ip-match.test.ts` (hoặc file mới `punch-offsite.test.ts`):
1. **RED trước**: punch trong mạng → `withinNetwork=true`, không tạo phiếu.
2. Punch offsite lần đầu ngày, KHÔNG reason → `appCode OFFSITE_REASON_REQUIRED`,
   KHÔNG có `TimePunch` mới, KHÔNG phiếu.
3. Punch offsite lần đầu + reason → tạo `TimePunch(withinNetwork=false)` + phiếu
   `pending` `note=reason` `checkInAt=punch`.
4. Punch thứ 2 cùng ngày (offsite hoặc onsite) → phiếu cập nhật `checkOutAt=punch2`.
5. **Edge (Validation Log)**: checkin trong mạng (không phiếu) rồi checkout offsite
   → punch2 offsite tạo phiếu, `checkInAt=punch1`(onsite), `checkOutAt=punch2`,
   status `pending` (KHÔNG auto-approve). ⚠️ Vì lần offsite đầu là punch2 → cần
   reason ở punch2.
6. Cooldown: 2 punch cách <10s → `COOLDOWN`, chỉ 1 punch.
7. Cơ sở không có `FacilityNetwork` active → `withinNetwork=true` (dev-open giữ nguyên).
8. Giữ: staff inactive → FORBIDDEN; profile không có → FORBIDDEN.
9. **R1**: phiếu đã `approved`, punch offsite mới cùng ngày → `TimePunch` được ghi
   nhưng `checkInAt`/`checkOutAt` phiếu KHÔNG đổi (đóng băng).
10. **E2**: punch offsite vào ngày KHÔNG có đăng ký ca (không submitted/approved) →
    ghi `TimePunch(withinNetwork=false)`, KHÔNG tạo phiếu, KHÔNG bắt reason.
11. **F2**: ngày có ca `submitted` (chưa duyệt) + punch offsite + reason → phiếu tạo;
    sau đó GĐ duyệt ca → payroll credit; nếu chỉ tính approved thì mất công (test khóa).
12. **F1**: phiếu `pending`, punch mới cùng lúc GĐ approve (mô phỏng race: set approved
    rồi ghi punch) → checkOutAt KHÔNG đổi (conditional update 0 row).

## Implementation Steps
1. RED: viết 8 case.
2. GREEN: sửa `punch` (input reason, bỏ reject offsite, cờ withinNetwork, cooldown 10s,
   ensureDayTicket).
3. Chạy `pnpm --filter @cmc/api test -- checkin` xanh.

## Success Criteria
- [ ] 12 case TDD xanh (gồm E2/F1/F2).
- [ ] Offsite không còn bị từ chối; lần offsite đầu ngày (có đăng ký ca) bắt buộc reason.
- [ ] Phiếu tự tạo/cập nhật checkInAt/checkOutAt đúng mốc đầu/cuối, có guard đóng băng (F1).
- [ ] `hasShift` tính cả submitted (F2) — không mất công khi ca duyệt sau.
- [ ] Edge checkin-onsite/checkout-offsite → phiếu pending, không auto-approve.
- [ ] Ngày không đăng ký ca + offsite → punch ghi, không phiếu (E2).
- [ ] Cooldown 10s.

## Risk Assessment
- **Rủi ro:** race 2 punch đồng thời cùng ngày tạo 2 phiếu. Mitigation: giữ
  `FOR UPDATE` trên AppUser (đã có) → serialize theo user; ensureDayTicket chạy
  trong cùng tx sau khi có lock.
- **Rủi ro:** reason bắt buộc gây khựng UX nếu offsite là punch2 (checkout). Đã
  chốt: bất kỳ punch offsite nào mà ngày chưa có phiếu đều cần reason. Frontend
  (phase 7) mở modal lý do đúng thời điểm.
