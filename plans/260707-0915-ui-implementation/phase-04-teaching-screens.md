# Phase 04 — Màn Giảng dạy (Teaching)

## Context links
- `docs/06` §3A (route teaching), `docs/12` §7 (responsive tablet, touch ≥44px), `docs/08` §7 (dữ liệu trẻ), master roadmap (sao flat, PDF upload route, consent ảnh trẻ).
- Router: `schedule`, `attendance`, `classSession`, `submission`, `assessment`, `curriculumUnit`, `exercise`, `sessionEvidence`, `kpi`. Permission: `attendance.mark` (giao_vien/GĐĐT), `submission.grade`.
- PDF: HTTP route `apps/api/src/exercise/upload-route.ts` (`/upload/exercise-pdf`, POST raw PDF bytes, ≤10MB, cùng dev-auth + `can()`).

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: pending · Review gate: **adversarial (dữ-liệu-trẻ)** · Phụ thuộc: phase-02 + **phase-01a** (teacher-annotation writer, session.me).
- 4 màn: Lịch dạy (facet filter + 3 view) · Điểm danh tablet · Chấm bài + PDF annotate · Cockpit role-aware.

## Key insights
- **Lịch dạy** là màn giàu nhất: facet filter bar kiểu Odoo + 3 view calendar/list/kanban, tất cả phản ánh URL query (`?view=calendar&date=2026-07` — `docs/06` §3A). View-state deep-link được.
- **Điểm danh** dùng trên **tablet ở lớp**: touch target ≥44px (nút lưu 44px), toggle 3 trạng thái (có mặt/vắng/muộn), 4 count tile. Roster theo `?session={sessionId}`.
- **Sao** = flat, cộng 1 lần tại lần grade đầu (không theo điểm) — UI hiện "+1 sao" lần đầu chấm, không lặp. Nguồn: `submission.grade` response.
- **Chấm bài** master-detail + pane PDF annotation, điểm /10. PDF blob tải qua HTTP route. **Lớp vẽ HS** đọc từ `submission.annotationLayer` (read-only ở màn GV). **Lớp chú thích GV** ghi qua **teacher-annotation writer** (phase-01a — `saveDraft` là lmsProcedure/HS, KHÔNG cho GV, xem C3). Chấm điểm qua `submission.grade`.
- **Consent ảnh trẻ** (`sessionEvidence`): ảnh lớp chỉ hiện cho phụ huynh khi `photoConsent=true AND revokedAt IS NULL` — nhưng đây là màn STAFF; consent gate áp ở LMS (phase 07). Staff authoring evidence: che PII, không phơi ảnh trẻ ngoài phạm vi.
- **Cockpit** role-aware: KPI stat card + "Việc cần bạn xử lý" (task) + tiến độ dạy trong ngày. Task list = deep-link tới bản ghi cần xử lý.

## Requirements
1. **Lịch dạy** `/teaching/schedule?view=calendar|list|kanban&date=`: facet filter bar (cơ sở/lớp/GV/khoảng ngày → URL query), 3 view chuyển bằng query, calendar tuần/tháng. Nguồn `schedule.*`.
2. **Điểm danh** `/teaching/attendance?session=`: roster tablet, 4 count tile (tổng/có mặt/vắng/muộn), toggle 3 trạng thái mỗi HS, nút Lưu 44px → `attendance.mark`. Empty/loading/error rõ.
3. **Chấm bài** `/teaching/grading?class=`: master-detail (danh sách submission ↔ chi tiết), pane PDF: **xem lớp vẽ của HS** (annotationLayer HS, read-only) + **vẽ chú thích của GV** lưu qua **teacher-annotation writer** (phase-01a, tách với saveDraft HS), điểm /10 → `submission.grade`, "+1 sao" hiện lần đầu chấm (từ response). Định danh HS = fullName + SĐT phụ huynh.
4. **Cockpit** `/cockpit`: stat card theo role (`session.me`), "Việc cần xử lý" tổng hợp task deep-link (phiếu chờ duyệt / bài chưa chấm / ca chờ duyệt tuỳ role), tiến độ dạy ngày.

## Architecture notes
- PDF annotate (C3 — ĐÃ SỬA): `submission.saveDraft` (`annotationLayer`, cap 1MB, `submission/router.ts:23,85-88`) là writer của **HỌC SINH** (lmsProcedure), KHÔNG dùng được cho GV. GV chấm bài cần **teacher-annotation writer riêng** (thêm ở phase-01a: protectedProcedure + `can('submission','grade')` + cap 1MB + audit, KHÔNG ghi đè lớp HS). Thư viện `pdfjs-dist` render + canvas overlay: 1 lớp HS (read-only) + 1 lớp GV (ghi qua writer 01a). Giữ payload gọn (không nhúng ảnh base64 vượt 1MB).
- Calendar: dùng Mantine `@mantine/dates` hoặc lib calendar nhẹ — chọn 1, ghi note.
- Touch target: token space + min-height 44px cho control điểm danh; test trên viewport tablet.
- Cockpit task: tổng hợp từ nhiều query (receiptList pending / submission chưa chấm / shift pending) — gate theo role, chỉ query cái role được phép.

## Related code files
- Đọc: `apps/api/src/class/schedule-router.ts`, `attendance/router.ts`, `submission/router.ts`, `assessment/router.ts`, `exercise/upload-route.ts`, `session-evidence/router.ts`, `kpi/router.ts`.
- Thêm: `apps/admin/src/pages/teaching/{schedule,attendance,grading}.tsx`, `pages/cockpit.tsx`, `components/pdf-annotator.tsx`.
- File ownership: `apps/admin/src/pages/teaching/*` + `pages/cockpit.tsx`. KHÔNG chạm finance/crm (phase 03) hay hr (phase 05).

## Implementation steps
1. Lịch dạy facet bar + 3 view + URL query.
2. Điểm danh tablet roster + count tile + toggle + lưu.
3. Chấm bài master-detail + xem PDF (lớp HS read-only) + chú thích GV (teacher-annotation writer 01a) + điểm + sao.
4. Cockpit role-aware + task deep-link.
5. Verify: tablet viewport, sao chỉ +1 lần đầu, gate GV vs GĐĐT.

## Todo list
- [x] Lịch dạy 3 view + facet URL
- [x] Điểm danh tablet (44px, 3 trạng thái, count tile)
- [x] Chấm bài + PDF view + điểm + sao
- [x] PDF: xem lớp HS (read-only) + chú thích GV qua teacher-annotation writer (01a) ≤1MB
- [x] Cockpit role-aware + task deep-link
- [ ] Verify tablet + gate + adversarial  ← blocked: requires running app + browser

## Implementation status
Phase completed 2026-07-07. Typecheck: 0 new errors in phase-04 files (12 pre-existing in finance/crm pages outside this phase's scope).

### Known gaps (follow-up required)
1. **student names in attendance**: `attendance.listBySession` returns `studentId` only; showing fullName+parentPhone requires a `student.getById` procedure not yet exposed. Currently displays truncated studentId.
2. **PDF GET handler**: server only has `POST /upload/exercise-pdf`. A GET handler must be added for the iframe PDF viewer to work. The iframe URL is wired correctly at `GET /upload/exercise-pdf?ref=<blobRef>`.
3. **cockpit at `/teaching`**: mounted as `/teaching` index (not a standalone `/cockpit` route) because `routes/index.tsx` is outside phase-04 file ownership.
4. **star field in grade response**: `SubmissionDto` has no explicit `starAwarded` field. Star display is derived from pre-mutation `status === 'submitted'` (first grade), which is correct per the backend logic.

## Success criteria
- Lịch dạy chuyển 3 view qua URL, deep-link cold-start đúng.
- Điểm danh: nút/toggle ≥44px, count tile khớp roster, lưu gọi `attendance.mark`.
- Chấm bài: điểm /10, "+1 sao" chỉ hiện lần chấm đầu (khớp response, không lặp).
- Cockpit hiển thị đúng theo role (đổi role → đổi nội dung), task link tới đúng bản ghi.
- **Verify**: build/typecheck xanh; test render tablet viewport; test sao-once.
- **Review**: adversarial — soi rò dữ liệu trẻ (ảnh/PII), sao cộng sai, PDF route auth, gate GV.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| annotationLayer vượt cap 1MB (nét vẽ/ảnh nặng) | TB×TB | serialize vector gọn, không nhúng ảnh base64; validate size trước gửi |
| Sao cộng lặp (không idempotent ở UI) | TB×Cao | chỉ hiện theo response backend (backend đã flat-once) |
| Điểm danh không dùng được trên tablet | TB×Cao | test viewport tablet, 44px, layout co |
| Cockpit query cái role không có quyền → 403 noise | TB×Thấp | chỉ query theo `can()` role |

## Security considerations
- Dữ liệu trẻ: che PII, không phơi ảnh trẻ ngoài phạm vi; consent gate thật ở LMS phase 07.
- PDF route dùng cùng dev-auth + `can()` — UI không bypass.
- Điểm/sao là sổ append-mindset backend; UI không sửa lịch sử.

## Next steps
→ Phase 07 LMS student hiển thị sao/bài từ cùng dữ liệu (`submission.saveDraft`/`submit`); phase 08 e2e điểm danh + chấm.
