# P2-Foundation — Vận hành lớp (nền) + đóng seam P1↔P2

> Scope A đã chốt: data model lớp + `classBatch.create` auto-sinh session + `classBatchId` FK/validate + enrollment reserved-hold operable.
> Defer: điểm danh, bài tập PDF, chấm/sao, nhận xét AI, ảnh lớp (P2-Teaching sau).
> Nguồn: TL26 WF-P2-01 · TL19 §1–2 · TL10 · QĐ0036 (mã lớp) · ADR0042 (RLS). Nền P1 đã merge main.

## Bất biến/quy tắc giữ
- Mã lớp `{facility.code}-{program}-{year}-{seq}` (QĐ0036), counter atomic per facility+program+year.
- Auto-sinh `ClassSession` cho mỗi ngày×slot trong [startDate,endDate] trong transaction tạo lớp (TL26 WF-P2-01).
- **Seam:** `Receipt.classBatchId` + `Enrollment.classBatchId` → **FK thật** tới `ClassBatch`; `receiptCreate`/`enrollment.enroll` **validate classBatchId trỏ lớp có thật trong facility** (NOT_FOUND nếu không) — không ghi danh vào lớp không tồn tại.
- Mọi model lớp facility-scoped → thêm RLS policy + grant `cmc_app` (ADR0042, qua `withFacility`).
- timestamptz cho ngày/giờ (ICT); dev-auth fail-closed; authz `can()`; zod; 5-mã lỗi; ESM.

## Data model (Prisma — tối thiểu, YAGNI)
- Enum: `Program {UCREA,BRIGHT_IG,BLACK_HOLE}`, `SessionStatus {planned,confirmed,cancelled}`.
- `Course` (facilityId, program, name) — định nghĩa khoá (tối thiểu).
- `Room` (facilityId, code, name, isActive) — cho chống trùng phòng.
- `ClassBatch` (facilityId, code unique-per-facility, courseId→Course, program, startDate, endDate, roomId?→Room, teacherId? [scalar — AppUser chưa có], status, createdBy scalar).
- `ScheduleSlot` (classBatchId→ClassBatch, weekday 0-6, startTime, endTime) — khung định kỳ của lớp.
- `ClassSession` (classBatchId→ClassBatch, scheduleSlotId?→ScheduleSlot, sessionDate, startTime, endTime, status default planned, isMakeup default false, curriculumUnitId? [defer]).
- `ClassBatchCodeCounter` (facilityId+program+year → seq) atomic.
- FK: `Receipt.classBatchId?`→ClassBatch, `Enrollment.classBatchId`→ClassBatch (nullable-FK để migration greenfield an toàn; app vẫn require ở receiptCreate).

## Procedures (WF-P2-01)
- `course.create` / `course.list` (perm `course.manage` — GĐĐT/super_admin).
- `room.create` / `room.list` (perm `room.manage`).
- `classBatch.create` (perm **`class.create`** — GĐĐT): input `{courseId, startDate, endDate, roomId?, slots:[{weekday,startTime,endTime}], teacherId?}` → gen mã (QĐ0036) + auto-create ClassSession per ngày×slot **trong 1 transaction** (`withFacility`). Chống trùng phòng/slot.
- `classBatch.list` / `classBatch.get` · `schedule.generateSessions` (perm `schedule.generate`) re-gen (idempotent, giữ buổi đã có điểm danh — điểm danh ở phase sau nên hiện chỉ giữ buổi đã confirmed).
- Registry: thêm `course.manage`, `room.manage`, `class.create`, `schedule.generate` (TL14 §5 — GĐĐT/super_admin).

## Edge cases / scenarios (≡ /ck-scenario — phủ test)
1. **Auto-session:** đếm đúng số buổi = số ngày trong [start,end] khớp weekday của slot × số slot; không sinh ngoài range; start>end → BAD_REQUEST; range rỗng → 0 buổi + cảnh báo.
2. **Re-generate idempotent:** `schedule.generateSessions` không nhân đôi buổi đã có; thêm buổi mới khi mở rộng range.
3. **Mã lớp:** đúng format `HN-UCREA-2026-001`; year từ startDate; counter atomic per facility+program+year; tạo đồng thời → không trùng mã (test race).
4. **Trùng phòng:** 2 lớp cùng room + slot chồng giờ → CONFLICT.
5. **Seam validate:** receiptCreate/enroll với classBatchId không tồn tại → NOT_FOUND; classBatchId **cơ sở khác** → NOT_FOUND (RLS); classBatchId hợp lệ → ok.
6. **Reserved-hold operable:** `enrollment.enroll` giữ chỗ `reserved` vào lớp thật; rồi `receiptApprove` → `active` (nối trọn P1 với lớp thật). Enrollment partial-unique vẫn chặn trùng active/reserved.
7. **RLS:** cơ sở B không thấy/tạo/sửa lớp cơ sở A (test âm tính) — kể cả bỏ app-filter (DB chặn).
8. **timestamptz/ICT:** biên ngày buổi theo ICT.
9. **Migration greenfield:** thêm FK `classBatchId`; hàng test P1 cũ (free-string) — dev DB recreate; FK nullable để không vỡ; app require ở receiptCreate.

## Acceptance
- Tạo lớp → mã đúng + buổi auto-sinh đủ ngày×slot; re-gen không nhân đôi; trùng phòng chặn.
- receiptCreate/enroll reject classBatchId không thật/chéo cơ sở; enroll reserved→(receiptApprove) active với lớp thật.
- RLS lớp fail-closed (test bỏ app-filter vẫn chặn). Toàn bộ test cũ (~207) + test P2 mới xanh; typecheck/build green; coverage giữ ngưỡng.

## Ngoài phạm vi (P2-Teaching sau)
Điểm danh (WF-P2-02) · bài tập PDF/annotation/chấm/sao (03-06) · nhận xét AI (07) · ảnh lớp (08) · CurriculumUnit mapping cho ADR0038.
