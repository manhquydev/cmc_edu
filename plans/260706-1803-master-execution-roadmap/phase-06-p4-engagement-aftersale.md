# Phase P4 — Đổi quà / Họp PH / Lịch test / After-sale (WF-P4-01..05)

## Goal
Cụm gắn kết & sau bán — 5 luồng nhẹ, pattern đã lập. Phụ thuộc: sao từ T2 (StarTransaction đã có).

## Nguồn spec
TL28 WF-P4-01..05 (đủ chi tiết) · TL20 §5-7 · TL25 hàng P4-01..05. Badge/leaderboard/certificate/level-progress: **LOẠI** (đã quyết TL19/20).

## Scope

### P4a — Đổi quà (WF-P4-01/02)
- Schema: `Gift` (name, imageUrl blobRef?, `starsRequired`, `stock` -1=vô hạn, isActive — **`minLevel` BỎ**: LevelProgress đã descope, không có nguồn level; deviation vs TL20 §5 ghi nhận) · `Reward` (**facilityId + RLS**, studentId, giftId, status pending|approved|delivered|rejected) + GRANT.
- `rewards.redeem` (lms — HS): check đủ sao (SUM StarTransaction) + minLevel + stock; **trừ sao ngay (gift_redeemed) atomic với tạo Reward pending** (race: 2 redeem đồng thời không âm sao — FOR UPDATE/atomic). `rewards.approve/deliver/reject` (staff): **reject → hoàn sao `gift_rejected_refund` đúng 1 lần**; delivered giảm stock.
- `gift.upsert/archive` (roster pinned: **GĐKD+GĐĐT+super_admin**): archive không xoá cứng; isActive=false ẩn khỏi HS.

### P4b — Họp PH + Lịch test (WF-P4-03/04)
- `ParentMeeting` (scheduled|done|cancelled; kết quả khi done) — `parentMeeting.schedule/complete/cancel`. **Nhắc lịch: rule mới trong worker** (quét meeting scheduled trong 24h chưa nhắc → enqueue EmailOutbox, đánh dấu remindedAt — relay worker gửi; pre-resolved fix validate).
- `TestAppointment` (type entrance|periodic; scheduled|done|no_show) — `testAppointment.schedule/complete/noShow`; **entrance nối CRM O3: chỉ ANNOTATE opp (audit/record note), KHÔNG BAO GIỜ mutate stage** (bảo vệ bất biến O5⇔receipt — fix red-team).

### P4c — After-sale (WF-P4-05)
- `AfterSaleCase` (open|in_progress|resolved|closed; priority low|normal|high) — `afterSale.create/advance/resolve` (perm sale — cskh deferred ADR-D).
- **`student.setLifecycle`** roster pinned **GĐKD+GĐĐT+super_admin** (= roster `enrollment.blockLms` hiện hữu — hết mâu thuẫn). **`enrollment.blockLms` GIỮ NGUYÊN** (procedure + permission + test không xoá); setLifecycle là mutation tổng quát (active/blocked_lms/withdrawn), blockLms là alias chuyên biệt còn dùng được.

## Tests trọng yếu
Thiếu sao/level/stock chặn · redeem race không âm sao · reject hoàn sao 1 lần (idempotent) · stock -1 vô hạn · archive không mất lịch sử · entrance-test nối O3 · lifecycle chỉ GĐ · RLS negative · LMS: HS chỉ redeem cho chính mình.

## Review gate
**P4a adversarial BẮT BUỘC** (sao = tiền mềm — theo chính quy tắc money của plan; fix red-team/validate). P4b/P4c spot-check.

## Harness
Intake high-risk (P4a) · US-025 (redeem/reward, verify=`vitest run src/rewards/redeem-refund.test.ts`) · US-026 (gift catalog) · US-027 (parent-meeting) · US-028 (test-appointment) · US-029 (after-sale) — map WF-P4-01..05.

## Acceptance
5 WF pass acceptance TL28 · e2e thêm flow redeem · toàn suite xanh · merge theo protocol. Sau P4: **traceability TL25 P1-P4 = 28/28 trừ P1-09 (P5)**.
