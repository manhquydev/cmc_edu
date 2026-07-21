---
phase: 7
title: "Session-done engine & auto-reschedule (TDD)"
status: pending
priority: P1
dependencies: [1]
effort: "9h"
---

# Phase 7: Session-done engine & auto-reschedule (TDD)

## Overview
Cơ chế user chốt (validation 2 vòng): buổi tự chuyển `done` khi đủ 3 điều kiện; creditFactor 24h/48h; buổi 0-HS tự cancel + **tự nối buổi bù vào đuôi khóa** (full-auto, người chỉ vào khi conflict phòng). Sau red-team R2: **BỎ event-hooks 3 router** (race crossed-tx + không có consumer real-time — R2 findings #1, Scope F2) → **sweep-only marking**; makeup +7d bị bác (lịch pre-generated — R2 #2) → tail-append.

## Requirements — điều kiện `done` (cả 3; đánh giá CHỈ cho buổi đã qua `endTime` — time gate chống gian lận R2 #7)
1. **Điểm danh**: ≥1 `Attendance` của buổi có status `present` (0 present → nhánh auto-cancel).
2. **Nhận xét**: MỌI HS `present` của buổi có `QualitativeAssessment` `classSessionId=buổi`, status `confirmed` (màn per-buổi build ở phase 5 — user chốt R2-Q1; flow: AI draft per HS present → GV confirm từng em / confirm-all).
3. **Ảnh lớp**: `SessionEvidence` `published` + ≥1 photo. **Thêm guard vào `sessionEvidence.publish`: từ chối publish 0 ảnh** (hiện publish 0 ảnh = dead-end vĩnh viễn vì addPhoto từ chối evidence đã publish — R2 #H5; session-evidence/router.ts:219-220,250).

- `doneAt` = MAX(markedAt cuối của present, confirmedAt cuối của nhận xét required, publishedAt).
- **creditFactor** (pure fn, đặt tại `packages/domain-time` cùng `ictMonthOf` — đúng tiền lệ extract ict-time, R2 Scope F4): `doneAt − endTime` ≤24h → 1.0; ≤48h → 0.5; >48h → 0. Buổi vẫn chuyển `done` khi đủ điều kiện dù muộn; chỉ credit = 0.
- **Activation**: `SESSION_DONE_ACTIVATED_AT` = **hardcoded const** trong domain-time cạnh creditFactor (KHÔNG env — sự kiện lịch sử bất biến, R2 Scope F3). Buổi endTime < activation: creditFactor = 1.0 nếu đạt done.
- **Backfill pre-activation (R2 #3)**: one-time script evaluate 3 điều kiện cho mọi buổi endTime < activation → set `done`+`doneAt`; chạy như **migration/script RIÊNG, KHÔNG cùng file với `ALTER TYPE ADD VALUE`** (invariant Postgres — tiền lệ migration 20260706160000:15-17; ADD VALUE dùng `IF NOT EXISTS` — R2 #M4).

## Sweep (worker, pattern reconcile-* — worker/index.ts:113-142) — 2 nhiệm vụ, thay thế hoàn toàn event-hooks
**A. Done-sweep**: quét buổi `planned|confirmed` có `endTime` đã qua → evaluate 3 điều kiện → đạt thì set `done`+`doneAt` bằng conditional UPDATE `WHERE id AND status IN ('planned','confirmed')`. Không hook router nào — hết race crossed-tx (R2 #1); latency 1 poll-interval, vô hại với KPI tháng.
**B. Cancel + tail-append**: buổi `planned|confirmed` quá `endTime + 24h`, 0 attendance `present` →
   - Conditional single-statement UPDATE → `cancelled` `WHERE status IN (...) AND NOT EXISTS (SELECT 1 FROM "Attendance" WHERE "classSessionId"=id AND status='present')` — chống race với GV điểm danh muộn (R2 #4); chỉ khi UPDATE count=1 mới xét bù.
   - **Tạo buổi bù NỐI ĐUÔI khóa** (user chốt R2-Q2 full-auto): sessionDate = occurrence kế tiếp của cùng `scheduleSlotId` SAU sessionDate lớn nhất hiện có của batch (thường = tuần kế sau buổi cuối); giữ `scheduleSlotId` (unique non-null bảo vệ), `isMakeup=true`, **`makeupForSessionId` = buổi bị cancel (cột mới @unique — idempotency mức DB, chống double-create đa-replica, R2 #2/#M2)**.
   - Trước khi tạo: `assertNoRoomConflict` (bắt buộc — room-conflict.ts invariant). Conflict → KHÔNG tạo, set flag báo cáo (ghi vào response sweep + UI lớp hiển thị "buổi hủy chưa xếp bù — cần xử lý") — đúng nguyên tắc user "người chỉ vào khi thực sự cần".
   - Buổi bù về sau bị 0-HS tiếp → lặp cơ chế (hội tụ vì mỗi lần nối 1 buổi).

## SessionStatus widening — consumers phải sửa (R2 #H6, bảng 11 consumers)
- `class-session-router.ts:108-110` **cancel guard: từ chối hủy buổi `done`** (bảo toàn "done một chiều" + giờ đã trả).
- Test fixtures hardcode union 3 giá trị: `apps/api/src/test/db.ts:519`, `apps/api/src/attendance/gate.test.ts:45`.
- UI `apps/admin/src/pages/classes/class-detail.tsx:70-74,141,152,161`: badge `done` + ẩn nút "Huỷ" cho buổi done (phase 5 nhận việc UI, phase 7 nhận guard API).
- Attendance gate (attendance/router.ts:96) giữ nguyên — re-mark trên buổi done hợp lệ nhưng không đổi doneAt (docs ghi: doneAt = frozen snapshot, artifacts có thể lệch sau đó).

## Related Code Files
- Modify: `packages/domain-time/src/index.ts` (+`creditFactor`, `SESSION_DONE_ACTIVATED_AT`) + test colocated
- Create: `apps/api/src/class/session-done.ts` (evaluate pure + mark helpers cho sweep/backfill) + `session-done.test.ts`
- Create: `apps/api/src/worker/session-done-sweep.ts` + `.test.ts` (2 nhiệm vụ A/B)
- Modify: `apps/api/src/worker/index.ts` (đăng ký sweep)
- Modify: `apps/api/src/session-evidence/router.ts` (publish guard ≥1 photo + test; check LMS parent flow không vỡ — evidence đã publish luôn có ảnh nên chỉ chặt hơn)
- Modify: `apps/api/src/class/class-session-router.ts` (cancel guard done)
- Create: backfill script (migration riêng hoặc `scripts/backfill-session-done.ts`)
- Modify fixtures: `apps/api/src/test/db.ts:519`, `apps/api/src/attendance/gate.test.ts:45`
- KHÔNG hook: attendance/assessment/evidence routers (quyết định R2 — sweep-only)

## Implementation Steps (TDD)
1. domain-time: creditFactor tests biên từng giây (24:00:00−1s/+1s, 48h) → implement.
2. session-done evaluate tests: đủ/thiếu từng điều kiện; 0-present không bao giờ done; doneAt=MAX đúng; time gate (điều kiện đủ TRƯỚC endTime → chưa done, sweep sau endTime mới set — R2 #C2 boundary "đủ điều kiện tại endTime−1s → chưa done").
3. Sweep tests: done-sweep set đúng + conditional; cancel race (present chen giữa → không cancel); tail-append đúng occurrence + makeupForSessionId unique idempotent (chạy 2 lần/2 replica giả lập); room-conflict → flag không tạo; publish 0 ảnh bị chặn.
4. Cancel-guard test: hủy buổi done → BAD_REQUEST.
5. Backfill script test trên fixture pre-activation.
6. `pnpm --filter @cmc/api test` + admin typecheck.

## Success Criteria
- [ ] Không còn đường race nào làm buổi đủ-điều-kiện kẹt mãi (done-sweep là nguồn chân lý duy nhất).
- [ ] Buổi bù chỉ sinh qua tail-append với makeupForSessionId unique; 0 trường hợp trùng; conflict phòng → flag chờ người.
- [ ] Không thể hủy buổi done; không thể publish evidence 0 ảnh; không thể done buổi chưa kết thúc.
- [ ] Backfill pre-activation chạy 1 lần, buổi cũ đủ điều kiện thành done với creditFactor miễn.

## Risk Assessment
- Cliff 24/48h qua lễ/cuối tuần: chính sách chặt có chủ đích; van xả GĐĐT override. QĐ docs/20.
- Tail-append kéo dài khóa qua endDate batch — ngữ nghĩa chấp nhận (khóa nợ buổi thì trả buổi), ghi QĐ docs/20; UI lớp hiển thị buổi bù rõ (isMakeup badge có sẵn).
- doneAt là snapshot đóng băng — re-mark/discard sau done không đổi credit; docs nói rõ.
