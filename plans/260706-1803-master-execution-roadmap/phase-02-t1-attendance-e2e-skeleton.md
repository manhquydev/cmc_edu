# Phase T1 — Điểm danh + session lifecycle (WF-P2-02) + e2e skeleton + CI (v2)

## Goal
GV điểm danh với đủ cổng nghiệp vụ; buổi học quản trị được (huỷ, buổi bù — trả C1 red-team); e2e + CI vào từ đây.

## Nguồn spec
TL26 WF-P2-02 (+WF-P2-01 phần makeup/cancel) · TL19 §5 · ADR 0038 (dữ liệu Tier B) · TL25 P2-02.

## Scope

### Session lifecycle (C1 fix — phần không cần CurriculumUnit; assignUnit ở T2)
- `classSession.cancel` (perm `schedule.generate` — GĐĐT/super_admin): planned/confirmed → cancelled; audit. Buổi cancelled không điểm danh được (test).
- `classSession.addMakeup` (perm `schedule.generate`): tạo buổi `isMakeup=true` cho batch (date/time/room; check trùng phòng như generate). → dữ liệu nền Tier B.
- `classSession.confirm` (planned→confirmed) — rẻ, cùng chỗ.

### Attendance
- Schema: `AttendanceStatus {present,absent,late}` · `Attendance` (facilityId, classSessionId FK, enrollmentId FK, studentId FK, status, markedById scalar, markedAt) · unique `(classSessionId, enrollmentId)` · RLS + GRANT.
- `attendance.mark` (perm `attendance.mark` — giao_vien/GĐĐT/super_admin): **UPSERT — re-mark cho phép, last-write-wins, mỗi lần ghi audit** (pre-resolved). `attendance.markAll`: input `{sessionId, entries:[{enrollmentId,status}]}` — cùng cổng, atomic.
- `attendance.listBySession` (query — **reuse roster `attendance.mark`**).
- **5 cổng (TL19 §5, mỗi cổng 1 test):** (1) session tồn tại & không cancelled → BAD_REQUEST; (2) `enrollment.classBatchId === session.classBatchId`; (3) enrollment `active` (reserved/withdrawn chặn — ADR-A); (4) facilityId suy từ session server-side + RLS negative; (5) bucket tháng ICT theo giờ kết thúc buổi.

### e2e skeleton (`apps/e2e`)
- Playwright API-driven; **server tự spawn (port ephemeral), `APP_DATABASE_URL` từ env, facility riêng per-run + cleanup afterAll** (pre-resolved). ESM config đúng từ đầu (bài học v1).
- 2 flow: (1) ghi danh end-to-end (facility→course→class→opp O4→receipt→approve→PH OTP→thấy con); (2) điểm danh hợp lệ + buổi cancelled bị chặn.

### CI-lite (kéo lên từ PD — validator)
- GitHub Actions: PR → postgres service (tạo role cmc_app qua migration) → typecheck + test. Chặn merge khi đỏ. (e2e vào CI ở PD.)

## Review gate
**Adversarial scoped** (child-data write — nâng từ spot-check theo validate).

## Harness
Intake high-risk · US-012 (attendance+session lifecycle, verify=`vitest run src/attendance/gate.test.ts`) · US-013 (e2e+CI, verify=`pnpm --filter @cmc/e2e test`).

## Acceptance
5 cổng + cancel/addMakeup/upsert-re-mark có test · unique chống trùng · RLS negative · e2e 2 flow xanh 1 lệnh · CI chạy trên PR thật · toàn suite + coverage giữ · merge protocol.

## Risks
e2e flake (dev DB chung) → facility per-run; theo flake-policy plan.md. markedById scalar (AppUser P3-I backfill).
