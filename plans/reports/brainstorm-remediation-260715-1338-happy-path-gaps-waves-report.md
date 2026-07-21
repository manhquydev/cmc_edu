# Brainstorm — Hướng khắc phục Happy-path Gaps (CMC EDU)

**Ngày:** 2026-07-15 · **Nguồn:** `plans/reports/ck-scenario-role-module-audit-260715-1331-happy-path-gaps-report.md` (43 phát hiện) · **Chế độ:** brainstorm (không implement) · **Bước sau:** `/ck:plan --tdd`

## Vấn đề

43 phát hiện scenario-audit cần biến thành hướng triển khai — nhưng "43 phát hiện" gây hiểu nhầm: nhiều dòng là verified-safe (không phải việc), nhiều lỗ chung 1 gốc, và 4 dòng là hành vi chủ đích (việc âm nếu "sửa"). Cần cấu trúc lại thành các cụm có đòn bẩy, đúng ưu tiên nghiệp vụ, thay vì 43 ticket rời.

## Quyết định đã chốt (với PO)

| # | Quyết định | Chốt |
|---|---|---|
| 1 | Hướng cấu trúc công việc | **Hybrid B+C**: 2 fix phẫu thuật riêng + gom pattern gốc dùng chung + xếp ưu tiên theo rủi ro thực (không thuần severity label) |
| 2 | Phạm vi | **Toàn bộ** (Critical→Low), trừ các việc âm ở #3 |
| 3 | Áp lực thời gian | Không có → **cho phép đầu tư structural** (helper/guard dùng chung, chuẩn hoá atomic-lock) |
| 4 | 3 phát hiện = thiết kế chủ đích, **GIỮ NGUYÊN, loại khỏi scope**: refund không có GĐĐT · lương reprice giữa kỳ (assemble=snapshot sống) · KPI nộp slip kỳ đã qua |
| 5 | C2 (phiếu công) | Rule 0-công **giữ nguyên** (ADR 0043 §10). Chỉ **thêm cảnh báo** khi duyệt phiếu 1-mốc (thiếu vế ra) — đưa vào Đợt 1 |

### Làm rõ C2 (quan trọng — tránh plan sai)
Đọc code xác nhận: `ensureDayTicket` (`checkin/router.ts:87-95`) **gom mọi lần bấm trong ngày** (cả trong/ngoài mạng) → sớm-nhất=checkInAt, muộn-nhất=checkOutAt. Nên:
- Checkin trong mạng + checkout ngoài mạng (và ngược lại) → phiếu **tự có đủ cặp** → duyệt xong **tính công đủ**. Code ĐÃ đúng.
- 0-công **chỉ** xảy ra khi cả ngày bấm **đúng 1 lần** (phiếu 1-mốc) — đúng ý định ADR 0043.
- → C2 rút gọn: chỉ cần **tín hiệu cảnh báo** cho người duyệt biết "phiếu thiếu vế ra, duyệt cũng 0 công". Không đụng logic ghép/tính công.

## Các hướng đã cân nhắc

| Hướng | Ưu | Nhược | Kết |
|---|---|---|---|
| A — Thang severity thuần | Đơn giản, khớp báo cáo | Tách H1/H2 dù chung gốc; lặp fix; bỏ lỡ đòn bẩy | Bác |
| B — Theo pattern gốc thuần | DRY nhất, ít regression | Không xếp theo business-impact; metric-corruption tụt sau | Bác (một phần) |
| C — Xếp lại theo rủi ro thực | Đúng ưu tiên kinh doanh | Khác thứ tự báo cáo | Bác (một phần) |
| **Hybrid B+C** | Đòn bẩy pattern gốc + ưu tiên rủi ro thực + criticals phẫu thuật | Cần design nhỉnh hơn mỗi cụm | **Chọn** |

## Giải pháp chốt — 4 đợt (+ Đợt 0 xác minh)

Sau khi loại 3 việc âm + các dòng verified-safe: **~31 việc thực**, gom thành:

### Đợt 0 — Xác minh chặn (rẻ, làm trước, có thể promote việc)
- **V1** Grep toàn bộ `lmsProcedure`/`requireLmsStudent` → xác nhận có thủ tục nào quên `assertPasswordNotExpired` (NS #9). Có → promote lên Đợt 1.
- **V2** Scan `apps/admin` + `apps/lms` → xác minh role-array hardcode phía client (`opportunity-detail.tsx`, `checkin-panel.tsx`, `attendance-roster.tsx`) còn tồn tại không (điểm mù audit, `docs/03` từng nêu).

### Đợt 1 — Critical + lỗ hổng phân quyền (stop bleeding)
- **C1** `finance/router.ts:754-776` + `provision-from-receipt.ts:271-304`: re-check `receipt.status` cuối provisioning (bỏ qua nếu đã cancelled) **+** nới filter `reconcile-orphaned-receipts.ts:96` để bắt trạng thái "cancelled-nhưng-đã-provisioned". *(bug Critical duy nhất còn lại sau khi C2 rút gọn)*
- **Cụm phân quyền theo lớp** (H1+H2+Học vụ #3): 1 helper `assertTeacherAssignedToClass` áp cho `attendance.mark/markAll`, `submission.grade`, `assessment.draft/confirm`, `sessionEvidence.upsert/publish`; sửa fail-open (`attendance/router.ts:230-231`) → fail-closed.
- **C2-cảnh báo**: `manualPunch.approve` (`checkin/router.ts:264`) trả cờ cảnh báo (kiểu `warning: 'SINGLE_PUNCH_NO_CREDIT'`) khi duyệt phiếu `checkOutAt=null`; bảng lương phân biệt "duyệt-nhưng-0-công". Không đổi rule.

### Đợt 2 — Guard hệ thống (pattern gốc, structural)
- **Cụm status/lifecycle guard**: buổi `cancelled` → chặn session-evidence write (Học vụ #8), dọn/flag attendance khi huỷ buổi (#9), chặn đổi `curriculumUnitId` khi session `done` (#7); học sinh `withdrawn` → meeting (Gắn kết #3), guardian-approve + filter `approved-children` (NS #5).
- **Cụm chuẩn hoá atomic-lock**: `submission.grade` dùng `updateMany`-claim như `assessment.confirm` (Học vụ #5); OTP-request dedup/lock (NS #6, #7 — kèm rate-limit theo identifier); `ReconciliationFlag` thêm `@@unique([facilityId,receiptId,kind])` để P2002-catch có thật (H5); email-reaper phân biệt slow-vs-crashed (Gắn kết #2).

### Đợt 3 — Toàn vẹn số liệu (sai báo cáo/tiền âm thầm)
- Duplicate student + renewal-mislabel (CRM #2, #3): dedup theo student-scope, tính `kind` đúng.
- FinalGrade stale sau sửa điểm danh (Học vụ H3): trigger recompute từ `attendance.mark`.
- `closedAt` bị ghi đè khi opp đã O5 (CRM #4); reconcile dùng `approvedAt` thay `updatedAt` (CRM #6).
- Submit sau khi exercise đóng (Học vụ #6); Tier B thiếu time-gate (H4).

### Đợt 4 — Low / hygiene
- slots max-cap (Học vụ #10); addMakeup date-range (#11); room `isActive` wiring (#12); meeting double-book check (Gắn kết #5); gift price snapshot (#4); test hồi quy reject-after-deliver (#6); cảnh báo staff khi HS đã có giám hộ (NS #8).

## Rủi ro & lưu ý triển khai
- **Đợt 2 động nhiều file 1 lúc** (helper/guard dùng chung) — blast radius lớn nhất. "Không áp lực thời gian" cho phép làm cẩn thận + test kỹ.
- Các fix động **money/auth/payroll logic có 532 test sẵn** → plan kiểu **tests-first (TDD)** để khoá hành vi hiện tại trước khi đổi. Đây là lý do chọn `/ck:plan --tdd`.
- C1: nhớ cả 2 vế (guard cuối provisioning **và** nới filter reconcile) — thiếu 1 vế thì trạng thái xấu vẫn vô hình.
- Thứ tự đợt phản ánh Hybrid B+C: Đợt 1 = rủi ro cao/blast thật; Đợt 3 = "sai âm thầm trong vận hành bình thường" (ưu tiên kinh doanh cao dù nhãn Medium).

## Loại khỏi scope (chủ đích, giữ nguyên)
Refund không có GĐĐT · lương reprice giữa kỳ · KPI nộp slip kỳ đã qua · rule 0-công phiếu 1-mốc (chỉ thêm cảnh báo, không đổi rule).

## Tiêu chí thành công
- C1: không thể tồn tại receipt `cancelled` mà vẫn có Enrollment active/StudentAccount; reconcile bắt được nếu có.
- Phân quyền lớp: giáo viên A không ghi được điểm danh/chấm bài/evidence của lớp giáo viên B (test FORBIDDEN).
- Guard status/lifecycle: không tạo được evidence/meeting cho buổi cancelled/HS withdrawn.
- Atomic-lock: test đua (2 người cùng thao tác) chỉ 1 thành công; không tạo cờ đối soát trùng.
- Metric: renewal/new phân loại đúng; FinalGrade tự refresh sau sửa điểm danh.

## Câu hỏi mở
1. Đợt 0-V2: nếu frontend role-array hardcode còn nhiều → có thể tách thành sub-plan riêng (frontend authz sweep) thay vì nhồi vào đợt này.
2. Cụm status/lifecycle: cần chốt "dọn attendance khi huỷ buổi" là xoá, void, hay chỉ flag — quyết định lúc plan phase đó.

## Bước tiếp theo
`/ck:plan --tdd` với báo cáo này làm input — sinh plan theo pha (mỗi đợt ≥1 phase), tests-first, để khoá 532 test hiện có trước khi sửa logic nghiệp vụ trọng yếu.
