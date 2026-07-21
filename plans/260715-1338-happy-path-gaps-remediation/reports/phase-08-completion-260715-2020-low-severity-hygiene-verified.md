# Phase 8 (Low-Severity Hygiene) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ 6 hạng mục bắt buộc · **Regression:** 826/826 API (93 file) · **Typecheck:** 26/26 package

## Thay đổi code

### 1. slots max-cap (resource guard)
`apps/api/src/class/class-batch-router.ts` — `classBatchCreateInput.slots` thêm `.max(20)` (mirror `markAllInput.max(200)` pattern). Test: >20 slot → BAD_REQUEST.

### 2. addMakeup date-range validation
`apps/api/src/class/class-session-router.ts` — thêm check `input.sessionDate` phải nằm trong `[classBatch.startDate, endDate]` (dùng `ictDateOnlyOf` chuyển DateTime→YYYY-MM-DD rồi so sánh string). Test: ngày ngoài range → BAD_REQUEST.

### 3. meeting double-book — cảnh báo, không chặn
`apps/api/src/meeting/router.ts` — `schedule` check có meeting `scheduled` khác của CÙNG student tại CÙNG `scheduledAt` chưa; nếu có, response thêm `warning?: string` nhưng vẫn tạo bình thường (CHỐT: họp là việc nhẹ, không chặn cứng). Test: meeting thứ 2 vẫn `status:'scheduled'` + có warning, DB có đủ 2 row.

### 4+5. Gift price audit + reject-after-deliver regression
| File | Thay đổi |
|---|---|
| `apps/api/src/rewards/reward-router.ts` | **Bug thật phát hiện & sửa** (không chỉ "thêm test khẳng định" như dự kiến ban đầu): `reject`'s refund dùng `reward.gift.starsRequired` — LIVE join tại thời điểm reject, không phải giá đã trừ lúc redeem. Nếu giá gift đổi giữa redeem↔reject, số hoàn SAI. Sửa: đọc lại `originalDeduction` từ `StarTransaction` (`type:'gift_redeemed', refId:reward.id`) đã snapshot đúng lúc redeem, `Math.abs()` giá trị đó làm refund amount |
| Test mới | (a) redeem giá 10 → đổi gift lên 25 → reject → assert refund=10 (không phải 25); (b) redeem→approve→deliver→reject → BAD_REQUEST (guard đã đúng từ trước, chỉ thêm test chống regress) |

### 6. multi-guardian staff soft-warning
`apps/api/src/guardian/router.ts` — `approveLink` check student đã có Guardian khác (parentAccountId khác) approved chưa TRƯỚC khi tạo Guardian mới; nếu có, response thêm `warning?: string` nhưng vẫn duyệt (multi-guardian là hợp lệ — cha/mẹ/giám hộ cùng lúc). Test: phụ huynh thứ 2 duyệt vẫn `status:'approved'` + có warning, DB có 2 Guardian row cho cùng student.

## Mục đã QUYẾT ĐỊNH không làm (theo đúng plan gốc, không phải bỏ sót)
- **Mục 7 (room `isActive` wiring):** DEFER có chủ đích — plan gốc đã chốt "chưa có nhu cầu thật + kéo theo admin UI, vượt scope BE-only phase này". Ghi nhận là latent, không code.
- **Mục 8 (frontend role-literal cleanup, 4 file admin display-only):** SKIP — plan ghi rõ "optional, có thể bỏ nếu hết ngân sách phase", không phải cổng quyền thật (mutation vẫn qua `canDo()` server-side).

## Đối chiếu Success Criteria
- [x] slots/makeup date validated; input vô lý bị chặn.
- [x] meeting double-book có cảnh báo (không chặn).
- [x] gift price audit đủ — VÀ đã sửa 1 bug thật phát hiện thêm (refund price-drift).
- [x] test reject-after-deliver có, chống regress.
- [x] staff được cảnh báo khi HS đã có giám hộ (không chặn co-parent hợp lệ).
- [x] room isActive: defer có chủ đích, ghi nhận latent (không code) — đúng theo plan.
- [x] (optional) frontend role-literal — bỏ qua theo đúng plan, không bắt buộc để phase DONE.

## Unresolved questions
Không có.
