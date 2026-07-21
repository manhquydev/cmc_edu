# Scenario Audit — Happy-path gaps theo module & vai trò (CMC EDU)

**Ngày:** 2026-07-15 · **Phương pháp:** `/ck-scenario` one-shot, 4 scout agent song song đọc trực tiếp `apps/api/src/**` (không đọc theo docs cũ) · **Phạm vi:** toàn bộ 36 thủ tục tRPC / 7 miền nghiệp vụ, cross-check với 5 vai trò ERP thật + 2 vai trò LMS (theo ma trận phân quyền đã dựng trước đó trong phiên).

## Tóm tắt

| Miền | Critical | High | Medium | Low | Tổng |
|---|---|---|---|---|---|
| CRM & Tài chính | 1 | 0 | 4 | 8 | 13 |
| Nhân sự & Định danh | 1 | 1 | 5 | 2 | 9 |
| Học vụ & Giảng dạy | 0 | 3 | 8 | 3 | 14 |
| Gắn kết & Worker nền | 0 | 1 | 3 | 3 | 7 |
| **Tổng** | **2** | **5** | **20** | **16** | **43** |

Kết luận chung: luồng "vàng" (happy path) đã được test khá kỹ (nhiều ✓ "verified-safe" dưới đây là do đọc code xác nhận, không phải đoán). Vấn đề nằm ở **các bước rẽ nhánh sau khi tách atomic/idempotent** — đúng kiểu lỗi "chỉ lộ ra ngoài happy case" mà bạn đoán.

---

## 🔴 2 phát hiện Critical — nên xử lý trước

### C1 — Duyệt phiếu xong bị huỷ giữa chừng vẫn có thể cấp tài khoản LMS
**File:** `apps/api/src/finance/router.ts:754-776` (receiptApprove) + `provisioning/provision-from-receipt.ts:271-304` · **Miền:** CRM & Tài chính · **Vai trò:** GĐKD (duyệt), GĐĐT (huỷ)

`receiptApprove` commit tiền xong rồi gọi `provisionFromReceipt` **ngoài** transaction/lock. Nếu đúng lúc đó có người gọi `receiptCancel` (chỉ cần điều kiện `status==='approved'`, lúc này đã đúng), phiếu chuyển `cancelled` — nhưng `provisionFromReceipt` không đọc lại `status`, vẫn chạy tiếp bằng snapshot cũ → tạo Student/Guardian/**Enrollment active**/StudentAccount cho một phiếu đã bị huỷ. Tệ hơn: `reconcile-orphaned-receipts.ts` chỉ quét `status='approved'` (dòng 96) nên trạng thái "huỷ nhưng vẫn có tài khoản" này **vô hình vĩnh viễn** với cơ chế tự phục hồi hiện có.
→ Học sinh/phụ huynh vẫn đăng nhập được LMS dù tiền đã bị đảo ngược.

### C2 — Duyệt phiếu công thiếu giờ ra vẫn báo "đã duyệt" nhưng 0 công
**File:** `apps/api/src/checkin/router.ts:94-95,111` + `attendance/resolve-day-credit.ts:43-55` · **Miền:** Nhân sự & Định danh · **Vai trò:** sale/giáo viên (chấm công), GĐ (duyệt)

Nhân viên chấm công ngoài mạng, quên bấm ra (`checkOutAt=null`). Giám đốc duyệt phiếu (`manualPunch.approve` không chặn phiếu thiếu giờ ra). `resolveDayCredit` đòi cả `checkInAt` lẫn `checkOutAt` mới tính công → rơi vào `NOT_VALID`, **0 công** cho ngày đó — nhưng không có cảnh báo nào ở bước duyệt hay trong bảng lương phân biệt "đã duyệt nhưng không tính được công" với "đã duyệt và có công". Giám đốc tưởng đã xử lý xong.

---

## 🟠 5 phát hiện High

| # | Miền | File:line | Vai trò | Kịch bản |
|---|---|---|---|---|
| H1 | Học vụ | `attendance/router.ts:125-224` | giáo_viên | `mark`/`markAll` không kiểm tra giáo viên có phụ trách đúng lớp — bất kỳ ai có quyền `attendance.mark` ghi được điểm danh cho **mọi** lớp trong cơ sở, không riêng lớp mình. (Việc kiểm tra chỉ có ở `listBySession` — một API đọc, chưa lan sang các API ghi.) |
| H2 | Học vụ | `submission/router.ts:283`, `assessment/router.ts:180`, `session-evidence/router.ts:159` | giáo_viên | Cùng lỗ hổng như H1 lan sang chấm bài, chốt nhận xét AI, đăng/publish ảnh buổi học — không giáo viên nào bị chặn thao tác trên lớp không phụ trách. |
| H3 | Học vụ | `submission/router.ts:150-203` vs `attendance/router.ts` | giáo_viên/GĐĐT | Sửa điểm danh (vắng→có mặt) sau khi `FinalGrade.score` tháng đó đã tính xong — không có cơ chế tính lại. Trong khi đó `attendanceRate` ở report card lại luôn tính live → phụ huynh thấy điểm danh mới nhưng điểm số cũ, lệch nhau ngay trên cùng 1 màn hình. |
| H4 | Học vụ | `exercise/open-tier.ts:110-124` | học_sinh/phụ_huynh | Bài tập "Tier B" (học bù) không kiểm tra buổi học đã kết thúc chưa — chỉ cần buổi chưa bị huỷ. Đánh dấu điểm danh cho một buổi bù **trong tương lai** là mở khoá bài tập ngay lập tức, trước khi buổi học thực sự diễn ra. |
| H5 | Gắn kết & Worker | `worker/reconcile-finance-flags.ts:66-72` | worker nền | Comment code khẳng định có unique constraint chặn trùng cờ đối soát (`ReconciliationFlag`), nhưng schema chỉ có index thường, không có `@@unique`. Hai lượt quét worker chạy chồng nhau tạo được **cờ trùng** cho cùng 1 phiếu — làm nhiễu hàng đợi soát bất thường. |

---

## Theo miền — bảng đầy đủ

### 1. Học vụ & Giảng dạy (14 phát hiện — 0C · 3H · 8M · 3L)

| # | File:line | Vai trò | Kịch bản | Mức |
|---|---|---|---|---|
| 1–2 | (xem H1, H2) | | | High |
| 3 | `attendance/router.ts:230-231,250` | giáo_viên | Cơ chế chống-chéo-lớp (H4 cũ) tự mở khi thiếu liên kết AppUser: "let through to avoid breaking tests" — fail-open thay vì fail-closed. | Medium |
| 4 | `class/room-conflict.ts:16-19` | GĐĐT | Tự nhận trong comment: check READ-COMMITTED không có constraint chặn ở DB — 2 lệnh tạo lớp cùng phòng/giờ đồng thời vẫn có thể double-book. | Medium |
| 5 | `submission/router.ts:283-330` | giáo_viên | `grade` dùng `findFirst`+`update` thường, không giống `assessment.confirm` (có `updateMany` atomic phát hiện conflict) — 2 giáo viên chấm cùng bài, người sau ghi đè âm thầm. | Medium |
| 6 | `submission/router.ts:254-276` | học_sinh | `submit()` không kiểm tra lại `exercise.status` (khác `saveDraft` có gọi `assertExerciseOpenForStudent`) — nộp được bài nháp cũ dù bài đã đóng. | Medium |
| 7 | `class/class-session-router.ts:213-238` | GĐĐT | Đổi `curriculumUnitId` của buổi học đã `done` không bị chặn — mở nhầm/đóng nhầm bài tập cho cả lớp hồi tố. | Medium |
| 8 | `session-evidence/router.ts:159-309` | giáo_viên | Không kiểm tra buổi học đã `cancelled` — vẫn đăng/publish được ảnh cho buổi học "chưa từng diễn ra" theo hệ thống. | Medium |
| 9 | `class/class-session-router.ts` cancel | GĐĐT/giáo_viên | Huỷ buổi học không dọn Attendance đã ghi — phụ huynh thấy lịch sử điểm danh mồ côi, lệch với báo cáo tổng hợp (đã loại buổi huỷ). | Medium |
| 10 | `class/class-batch-router.ts:16-25` | GĐĐT | `slots` không giới hạn số lượng tối đa (khác `markAllInput` có `.max(200)`) — 1 lệnh tạo lớp có thể sinh hàng chục nghìn `ClassSession`. | Low |
| 11 | `class/class-session-router.ts:167-205` | GĐĐT | `addMakeup` không kiểm tra ngày buổi bù nằm trong khoảng của lớp — đặt được buổi bù cách xa vòng đời lớp. | Low |
| 12 | `room/router.ts:26-56` | GĐĐT | `isActive` tồn tại trong model nhưng chưa route nào ghi được — chưa dùng được thật, tiềm ẩn (chưa phải bug hiện tại). | Low |

*(Đã verify AN TOÀN, không phải gap: chống tự-duyệt, RLS liên-cơ-sở, consent ảnh buổi học đã test kỹ.)*

### 2. CRM & Tài chính (13 phát hiện — 1C · 0H · 4M · 8L)

| # | File:line | Vai trò | Kịch bản | Mức |
|---|---|---|---|---|
| 1 | (xem C1) | | | Critical |
| 2 | `finance/router.ts:668-676` | sale | Tạo phiếu 2 cho cùng SĐT nhưng học sinh khác (song sinh, hoặc trùng SĐT ngẫu nhiên) mà quên gán `studentId` — cảnh báo trùng SĐT chỉ là soft warning, không chặn — tạo nhầm hồ sơ học sinh thứ 2. | Medium |
| 3 | `packages/domain-finance/src/receipt-kind.ts:13-15` | — | Cùng kịch bản #2: phiếu bị gắn nhãn `renewal` sai dù thực chất là học sinh mới → lệch báo cáo gia hạn vs khách mới. | Medium |
| 4 | `finance/router.ts:640-653` | GĐKD/sale | Tạo phiếu thu cho cơ hội đã `O5_ENROLLED` — duyệt vẫn ghi đè `closedAt`, làm mờ mốc thời gian đóng cơ hội thật. | Medium |
| 5 | `packages/auth/src/index.ts:64` | GĐĐT | `finance.refundCreate` chỉ có GĐKD — GĐĐT (người duy nhất đủ quyền duyệt phiếu >20 triệu) lại không hoàn được tiền chính phiếu mình duyệt. Có thể là chủ đích, cần xác nhận với PO. | Medium |
| 6 | `worker/reconcile-finance-flags.ts:182-196` | worker | Comment nói "`approvedAt` không tồn tại, dùng `updatedAt` thay" — nhưng field `approvedAt` **đã tồn tại** trong schema hiện tại. Comment stale, rule đối soát đang dùng field sai chỗ, tạm thời vô hại nhưng giòn nếu có thay đổi khác động vào `updatedAt`. | Medium |
| 7–14 | — | — | 8 mục đã **verify an toàn**: 2 giám đốc duyệt cùng lúc (atomic claim đúng), trùng SĐT khi tạo mới (đã fix bằng unique constraint + refetch), sale gọi thẳng API duyệt bị chặn, RLS liên-cơ-sở đúng, GĐKD một mình duyệt phiếu >20 triệu bị chặn đúng, worker khôi phục sau crash bắt đủ 4 mảnh (Student/Guardian/Enrollment/StudentAccount), hoàn tiền đua nhau vẫn tôn trọng cap, thiếu `classBatchId` là rủi ro đã biết & chấp nhận. | — |

### 3. Nhân sự & Định danh (9 phát hiện — 1C · 1H · 5M · 2L)

| # | File:line | Vai trò | Kịch bản | Mức |
|---|---|---|---|---|
| 1 | (xem C2) | | | Critical |
| 2 | `checkin/router.ts:206-208` + `payroll/router.ts:347-354` | sale/giáo_viên | Chấm công qua nửa đêm giờ VN — giờ vào/ra bị chia vào 2 "ngày ICT" khác nhau ở 2 chỗ tính độc lập → mất công cả ca dù thực tế có làm, không có đường sửa cho ca làm việc onsite qua đêm. | High |
| 3 | `kpi/router.ts:150-217` | sale/giáo_viên | `submitSlip` chỉ chặn nộp sớm, không chặn nộp trễ — nộp KPI cho kỳ đã qua nhiều tháng bất kỳ lúc nào, dùng dữ liệu doanh thu hiện tại (đã trôi so với kỳ đó). | Medium |
| 4 | `payroll/router.ts:178-190,321-324` | GĐKD/GĐĐT | Đổi bậc lương giữa tháng (vd thăng chức ngày 20) rồi chốt lương — cả tháng bị tính lại theo bậc mới, không chia tỷ lệ ngày cũ/mới, không cảnh báo. | Medium |
| 5 | `guardian/router.ts:124-171` + `approved-children.ts:47-59` | staff/phụ_huynh | Duyệt liên kết PH không kiểm tra `Student.lifecycle` — học sinh `withdrawn` (khác `blocked_lms`) vẫn hiện trong danh sách chọn con của phụ huynh trên LMS. | Medium |
| 6 | `lms-auth/router.ts:186-209,299-327` | phụ_huynh | 2 lệnh xin OTP đồng thời cho cùng SĐT/email không khoá nhau (khác `checkin.punch` có `FOR UPDATE`) — có thể tồn tại 2 mã OTP `pending`, chỉ mã mới nhất còn hiệu lực, người dùng dùng mã cũ (SMS đến trễ) sẽ báo lỗi khó hiểu. | Medium |
| 7 | `lms-auth/router.ts:56,70,244-256` | phụ_huynh (attacker) | Giới hạn 5 lần thử/mã nhưng không giới hạn số lần **xin mã mới** theo SĐT/email — có thể xin mã liên tục mỗi 30s để dò không giới hạn tổng số lần thử. | Medium |
| 8 | `guardian/router.ts:96-118` | phụ_huynh | 2 phụ huynh khác nhau cùng xin liên kết 1 học sinh — hệ thống cho qua (đúng thiết kế đa giám hộ) nhưng không cảnh báo cho staff biết học sinh đã có người giám hộ khi duyệt yêu cầu thứ 2 — dựa hoàn toàn vào đối chiếu thủ công. | Low |
| 9 | `trpc.ts:203-221` | học_sinh | `assertPasswordNotExpired` là hàm phải tự gọi ở từng thủ tục, không phải cổng chặn tự động như `requireLmsStudent` — rủi ro cấu trúc: chỉ cần 1 thủ tục quên gọi là bỏ qua được yêu cầu đổi mật khẩu lần đầu. Chưa xác nhận được có thủ tục nào thực sự bỏ sót (cần grep riêng). | Chưa xác định |

*(Đã verify an toàn: 2 giám đốc duyệt/từ chối phiếu công cùng lúc, tự-duyệt ca làm bị chặn, chu trình chốt→mở lại→chốt lương lần 1 được test.)*

### 4. Gắn kết & Worker nền (7 phát hiện — 0C · 1H · 3M · 3L)

| # | File:line | Vai trò | Kịch bản | Mức |
|---|---|---|---|---|
| 1 | (xem H5) | | | High |
| 2 | `worker/relay-email-outbox.ts:164-174` | worker | Cơ chế "reap" coi email kẹt >5 phút là do crash và gửi lại — nhưng nếu Brevo/Graph chỉ đơn giản chậm (chưa crash), có thể gửi trùng email cho phụ huynh. | Medium |
| 3 | `meeting/router.ts:28-47` | sale/GĐ | Đặt lịch họp không kiểm tra `Student.lifecycle` — vẫn đặt/hoàn tất được lịch họp cho học sinh đã nghỉ học. | Medium |
| 4 | `rewards/gift-router.ts:36-49` | GĐ | Sửa giá/tồn kho quà tặng không ảnh hưởng các lượt đổi đang chờ xử lý theo giá cũ — không lưu snapshot giá tại thời điểm đổi, khó truy vết khi có tranh chấp. | Medium |
| 5 | `meeting/router.ts:28-47` | sale/GĐ | Không có kiểm tra trùng giờ — 2 lịch họp cho cùng học sinh cùng khung giờ vẫn tạo được. | Low |
| 6 | `rewards/reward-router.ts:184-242` | GĐ | Không có test riêng cho "từ chối quà đã giao" dù code đã chặn đúng — nên thêm test hồi quy vì đây là 1 dòng guard dễ bị regress. | Low |
| 7 | — | — | 4 mục đã **verify an toàn**: outbox không gửi trùng khi nhiều worker chạy song song (atomic claim đúng), worker khôi phục đơn hàng mồ côi hội tụ an toàn nhờ unique constraint, hàng đợi không bị chặn bởi 1 email lỗi vĩnh viễn, không có đua giữa xoá OTP và đăng nhập. | — |

---

## Pattern xuyên miền (đáng chú ý hơn từng lỗi riêng lẻ)

1. **Một số nơi áp dụng "atomic claim/lock" rất chuẩn** (duyệt phiếu thu, duyệt phiếu công, đổi sao lấy quà) **nhưng anh em gần giống lại thiếu** (đối soát tài chính, chấm bài, xin OTP). Đây là lỗi hệ thống hoá — nên audit lại toàn bộ chỗ nào cần lock/atomic-update và chuẩn hoá thành 1 pattern dùng chung, thay vì từng router tự quyết.
2. **Kiểm tra `status`/`lifecycle` không lan truyền hết** — buổi học `cancelled`, học sinh `withdrawn` bị bỏ sót ở nhiều nơi liên quan (session-evidence, meeting, guardian-approve) dù model đã có field đó.
3. **Tách bước để idempotent (đúng chủ đích) nhưng thiếu "re-check trạng thái nguồn" ở bước sau** — đây chính là nguyên nhân của cả 2 lỗi Critical (C1: provisioning không đọc lại status phiếu; C2: duyệt phiếu công không đọc lại có đủ cặp giờ vào/ra).
4. **Phân quyền theo cơ sở (facility) rất chắc, nhưng phân quyền theo "lớp mình phụ trách" (giáo viên) gần như chưa có** — H1/H2 là cùng 1 lỗ hổng lặp ở 4+ router khác nhau.

---

## Câu hỏi chưa có lời đáp (từ các scout)

1. C2 (duyệt phiếu công thiếu giờ ra) — có phải rủi ro đã được PO chấp nhận theo ADR 0043 hay là gap chưa ai để ý? Cần hỏi lại chủ sản phẩm.
2. Có thủ tục nào phía học sinh (exercise/reward) thực sự quên gọi `assertPasswordNotExpired` không? Cần grep riêng toàn bộ `lmsProcedure`/`requireLmsStudent`.
3. Định giá lương giữa kỳ không chia tỷ lệ ngày — là thiết kế chủ đích ("assemble = snapshot sống") hay yêu cầu bị bỏ sót?
4. `finance.refundCreate` không có GĐĐT — chủ đích hay thiếu sót khi thêm ADR-B?

## Không nằm trong phạm vi lần này
Chưa quét `apps/admin`/`apps/lms` (frontend) — đặc biệt mục "C. CODE — hardcode role-array phía client" mà `docs/03-audit-diem-dut-gay-chuan-hoa.md` từng nêu (`opportunity-detail.tsx`, `checkin-panel.tsx`, `attendance-roster.tsx`) chưa được xác minh lại là còn tồn tại hay đã sửa.
