# Code review — live-suite EDGE specs 12–16 (production-readiness)

**Date:** 2026-08-17 · **Branch:** `feat/back-before-design` · **Mode:** staff-engineer review (read-only)
**Scope:** `apps/e2e/tests/live/12-ops-finance-edge.spec.ts` … `16-ops-meeting-doublebook.spec.ts`, 
`apps/e2e/src/live/live-evidence.ts` (isBenignHttpError user.create 403), supporting helpers 
(`live-trcp.ts`, `live-state.ts`, `live-spec-utils.ts`).

---

## 1. Verdict tóm tắt

**APPROVE_WITH_NOTES.** Cả 5 edge spec đều khớp contract server (đã grep-verify từng cái bên dưới), 
typecheck `pnpm --filter @cmc/e2e typecheck` → exit 0, suite chạy 17/17 (0 error mọi collector, theo 
run report). Không có finding nào chặn merge. 2 finding mức Medium về độ *nghĩa của assertion* 
(phantom window ở 12-I3 và 15-lifecycle) + 1 loạt ghi chú nhỏ — nên sửa trước khi đưa suite làm 
regression gate chính thức, nhưng không phải điều kiện để chạy tiếp.

---

## 2. Spec compliance — đối chiếu contract server (grep-verified)

| # | Spec | Contract server | Bằng chứng | Khớp? |
|---|------|-----------------|------------|-------|
| 12 | Second-eye >20tr: GĐKD chặn → GĐĐT duyệt | `APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000`, `SECOND_EYE_ROLES = ['giam_doc_dao_tao','super_admin']`; `canApprove = notSelf && secondEyeOk && can(receiptApprove)` | `apps/api/src/finance/router.ts:41,47,196-202`; unit: `can-approve.test.ts:83-96`, `approve.test.ts:423-447`; server còn chặn cứng qua forbidden (`router.ts:288-295`) | ✅ |
| 12 | I3 revert: huỷ phiếu duy nhất → opp O5→O4 | `receiptCancel` revert O5→O4 + clear closedAt **chỉ khi** là phiếu approved duy nhất | `finance/router.ts:505+`; unit: `cancel-refund.test.ts:88-113` | ✅ (nhưng xem M1) |
| 13 | shift.reject reason ≥3, validation disabled khi ngắn | `rejectInput.reason = z.string().min(3)`; chỉ `submitted` mới reject được; anti-self + group-type gate | `apps/api/src/shift/router.ts:84-87,349-372`; `assertCanReview` :107-130; unit `register-approve.test.ts:310` (reason 'ab' bị chặn) | ✅ |
| 14 | user.create escalation guard (403) | Chỉ super_admin tạo được super_admin; GĐKD giữ `user.manage` | `apps/api/src/user/router.ts:161-164`; `packages/auth/src/index.ts:139` (user.manage = gdkd+gddt); `ACTIVE_ROLES` gồm super_admin (`:27-33`) nên option có trong dialog | ✅ |
| 15 | student.setLifecycle active→blocked_lms→active | `requirePermission('student','setLifecycle')` — roster gdkd+gddt (QĐ0027); enum active|blocked_lms|withdrawn | `apps/api/src/student/router.ts:121-159`; `packages/auth/src/index.ts:181` | ✅ (xem M2) |
| 16 | parentMeeting.schedule trùng giờ → warning mềm, vẫn tạo | schedule luôn succeed; trùng slot trả `warning` string trên success payload, không block | `apps/api/src/meeting/router.ts:75-108` (doubleBooked → warning); unit `parent-meeting.test.ts:134-140` (warning /trùng giờ|double.?book/i) | ✅ |

**UI labels spec phụ thuộc — đã verify khớp:** `Duyệt & Kích hoạt` / `Huỷ phiếu thu` / `Lý do huỷ (bắt buộc)` 
(`apps/admin/src/pages/finance/receipt-detail.tsx:332,360,579,676,714`); `Đổi trạng thái`/`Khóa LMS`/`Áp dụng` 
(`apps/admin/src/pages/students/student-detail.tsx:33,184,193`); `Đặt lịch họp`/`Đã đặt lịch — trùng giờ`/`Đóng` 
(`apps/admin/src/pages/crm/schedule-parent-meeting-dialog.tsx:54,60,76`); `Từ chối đăng ký ca`/`Lý do từ chối`/`Đã từ chối` 
(`apps/admin/src/pages/attendance/shifts-detail.tsx:478,488`); users dialog (`apps/admin/src/pages/admin/users.tsx:379-427`). 
Nav `Tài chính & Điều hành → CRM / Họp sau bán` (`nav-registry.ts:60-81`); `/go/shiftRegistration/:id` resolver 
(`apps/admin/src/routes/go.routes.tsx`). **Nhóm 'Quản trị' super_admin-only** đúng như spec 14 mô tả.

---

## 3. Findings

| Sev | Finding | Verdict |
|-----|---------|---------|
| **Med** | **M1 — 12: assertion I3 revert có phantom window** (middle O5 không được assert) | Sửa nên làm |
| **Med** | **M2 — 15: assertion trạng thái có thể khớp vào Selector thay vì StatusBadge** | Sửa nên làm |
| Low | L1 — escapeRegExp duplicate local trong 12 | DRY nhỏ |
| Low | L2 — created-log thiếu receipt 16 / student 12 / template 13 | Ghi chú |
| Low | L3 — comment precondition 16 stale (tự tạo student riêng) | Ghi chú |
| Low | L4 — benign-filter user.create 403 toàn cục theo procedure-name | Chấp nhận, note |
| Info | L5 — bằng chứng run 12–16 chưa được copy về repo | Ghi chú |

### M1 (Medium) — 12-ops-finance-edge: vòng I3 chỉ chứng minh nửa đường

12-ops-finance-edge.spec.ts:78-84 gọi `receiptCreate` qua tRPC **không truyền `opportunityId`** 
(schema cho phép optional — `finance/router.ts:94`). Nhờ đó ở bước duyệt, server chạy walk-in auto-link 
(`finance/router.ts:355-395`): resolve Contact theo SĐT chuẩn hoá (`crm/find-or-create-contact.ts:34-46` — 
cùng SĐT với lead tạo bằng UI, nên tìm đúng contact), rồi link vào **opp mở gần nhất** — chính là opp 
O4 sale tạo — và advance lên O5. Vì vậy cancel thật sự revert opp đó về O4, và assertion cuối 
(nút 'Ghi danh' visible, dòng 140) **hôm nay là có nghĩa**.

Nhưng spec **không bao giờ assert trạng thái trung gian**: sau khi GĐĐT duyệt (step 3) không kiểm tra 
card mất nút 'Ghi danh' (tức opp đã lên O5 — UI O5 là cột 'Đã ghi danh', `crm/pipeline.tsx:79,230`). 
Nếu auto-link đổi hành vi (vd. không còn resolve opp mở, hoặc tạo walk-in opp mới), opp sale sẽ đứng 
nguyên O4 và **assertion cuối pass một cách rỗng** (Ghi danh lúc nào cũng hiện). Cúpling này là gián 
tiếp và không được comment trong spec (comment chỉ nói "receipt tạo qua tRPC").

**Đề xuất:** (a) sau bước GĐĐT duyệt, assert card edgeName **không còn** nút 'Ghi danh' 
(`toHaveCount(0)` với timeout) — chứng minh O5 thật, khép phantom window; và/hoặc (b) resolve opp id 
qua staff read (`crm.opportunityList`/lookup) rồi truyền `opportunityId` tường minh vào receiptCreate 
— làm linkage deterministic, không phụ thuộc auto-link; đồng thời ghi rõ ý định trong comment.

### M2 (Medium) — 15-ops-lifecycle: text assertion có thể khớp vào Selector, không phải badge

UI lifecycle (`apps/admin/src/pages/students/student-detail.tsx:183-198`): Selector hiển thị 
`pendingLifecycle` (giá trị vừa chọn) chứ không phải trạng thái server; chỉ khi `onSuccess` mới reset 
về placeholder. Spec 15 assert text 'Khóa LMS'/'Đang học' (exact) ngay sau khi click Xác nhận — tại thời 
điểm đó Selector **đang hiển thị chính giá trị vừa chọn**, nên assertion pass được ngay cả trước khi 
mutation settle, và thậm chí pass khi server reject (pendingLifecycle không reset trên error). Tấm chắn 
thật của spec là `assertNoErrorsAll` (student.setLifecycle KHÔNG nằm trong benign list → 4xx/5xx làm 
fail spec), nên spec không hề "xanh giả" trước server lỗi — nhưng bản thân text assertion không chứng 
minh trạng thái đã được áp dụng.

**Đề xuất:** assert vào `StatusBadge` cụ thể (header KeyValueList, `student-detail.tsx:156-160` — scoped 
locator thay vì .first()), hoặc assert sau khi Selector trở về placeholder 'Chọn trạng thái…'.

### L1 (Low) — escapeRegExp duplicate

12-ops-finance-edge.spec.ts:27-30 định nghĩa local `escapeRegExp`; commit 9f9b7b2 đã hoisted pattern 
tương tự cho 10/11. Nên đưa vào `live-spec-utils.ts` và import chung.

### L2 (Low) — created-log thiếu entity

- **16**: receipt 5.000.001 (tạo + approve qua tRPC, 16-ops-meeting-doublebook.spec.ts:58-72) **không** 
  được `recordCreated` — coordinator cleanup không thấy receipt id.
- **12**: provisioning sau approve tạo thêm Student + ParentAccount + Enrollment (classBatchId có), không 
  được log (chỉ log opportunity + receipt).
- **13**: template name không log (chỉ group name).
Không phải lỗi chạy; chỉ làm cleanup log thiếu sót.

### L3 (Low) — comment precondition 16 stale

Header 16 nói "Precondition: 02 provisioned a student (state.contactName)" nhưng spec **tự tạo student 
riêng** qua real money chain và không đọc liveState. Chính **15** mới là spec phụ thuộc 02 
(`readLiveState().contactName`, skip-guard hợp lý). Sửa comment 16 cho khỏi hiểu nhầm.

### L4 (Low) — benign-filter user.create 403 toàn cục

live-evidence.ts:244-246 exempt mọi 403 trên URL chứa 'user.create' — đúng mục đích cho 14 (escalation 
guard chủ động gây lỗi, xác nhận bởi commit f96ea64). Nhưng filter là toàn cục theo procedure-name: 
nếu sau này spec khác (hoặc chính 14) chạy user.create 403 vì **regression thật**, collector sẽ nuốt 
im lặng. Hôm nay chỉ 14 kích hoạt case này, và bước 2 của 14 (tạo sale) vẫn fail bằng assertion chức 
năng nếu user.create hỏng — nên chấp nhận được. Ghi chú để giữ scope khi suite mở rộng.

### L5 (Info) — bằng chứng run 12–16 chưa có trong repo

Các bản copy evidence (`plans/reports/uat-live-20260817-final-kd|final-otp|final2`) là run 00–11 + 
OTP rerun (runDir 02:55–03:16 UTC, **trước** các commit edge 10:48–11:09 +0700); không có artifact nào 
trong repo chứng minh collector-zero của chính run 12–16. Con số 17/17 dựa trên evidence trên VPS 
(`/root/cmc-edu/plans/reports/uat-live-20260817-*`). Nên copy full-run evidence về repo sau mỗi run 
để audit được.

---

## 4. Assertions & evidence — checklist

- ✅ `assertNoErrorsAll` gọi ở cả 5 spec (12:147, 13:105, 14:100, 15:70, 16:112); collector attach đủ 
  các page chính (12 gắn sale/gdkd/gddt/gdkd2; 16 gắn gd; tRPC Node-side failures throw → fail spec).
- ✅ `recordCreated` đầy đủ về mặt luồng chính (opp, receipt, shift, staff, lifecycle, meeting); không 
  secret/password nào vào evidence (14 chỉ log email).
- ✅ Skip-guard hợp lý: 15 skip khi 02 chưa provision student; 13 dùng day+2 tránh overlap với 06 
  (overlap guard chỉ tính submitted|approved — `shift/router.ts:248-250`; rejected không block, 
  `reject-validate.test.ts:186`).
- ✅ 13 có network assertion thật: `waitForResponse` shift.reject 200 trước khi click confirm.
- ✅ 12 dùng đúng pattern `toHaveCount(0)` cho nút ẩn (chờ "vắng mặt", không phải "có rồi biến mất").

## 5. Trust boundaries

- Không ghi DB trực tiếp (chỉ đọc EmailOutbox OTP qua docker exec — config gate `PLAYWRIGHT_LIVE=1`).
- UAT data được tạo qua **real API/UI** và log vào created ledger; 12/16 dùng tRPC seed exception 
  (createLiveClass) đúng phạm vi PO-approved như 02/03 — không có DB write ngoài luồng.
- Cookie session từ credentials file, không in ra; mật khẩu không bao giờ log.

## 6. Robustness / flakiness tiềm ẩn

- **Rerun một phần (12–16 không qua 00):** runId giữ nguyên → email user.create trong 14 trùng (P2002 → 
  badRequest rõ ràng, spec fail có message tốt); toàn campaign an toàn vì `00-setup-roles` gọi 
  `rotateRun()` (00:41) → runId mới. Ghi chú vận hành, không phải lỗi.
- **13 crash giữa chừng:** registration để lại 'submitted' → ticket-lock chặn submit lần sau 
  (`shift/router.ts:232`, message hướng dẫn cancel) — cần reset nếu campaign chết dở.
- **14** `waitForTimeout(500)` trước `findInList` là thừa (findInList tự poll 10s) — vô hại.
- **12** nên cân nhắc assert thêm banner "Phiếu vượt ngưỡng — cần GĐĐT/Quản trị hệ thống duyệt" 
  (`receipt-detail.tsx:230`) thay vì chỉ `toHaveCount(0)` (không phân biệt "bị chặn vì threshold" 
  với "nút không render vì lý do khác").
- Timeout: các bước chờ đều có timeout 15–20s hợp lý; workers=1 loại trừ chạy song song.

## 7. Verification performed

- `pnpm --filter @cmc/e2e typecheck` → **exit 0** (chạy lại trong phiên review).
- Grep đối chiếu contract: second-eye threshold/roles/canApprove, receiptCancel I3, shift.reject min(3), 
  user.create guard, setLifecycle roster/enum, parentMeeting warning — tất cả khớp (mục 2).
- Grep UI labels mà spec phụ thuộc — khớp (mục 2).
- Evidence run: base suite 00–11 pass 0 collector error (final-kd); run 12–16 theo report (L5).

## Ship risk

**Thấp.** Không đổi runtime/API/CI. Các note M1/M2 là cải thiện assertion rigor — nên làm trước khi 
dùng suite làm regression gate chính thức, không phải điều kiện chặn chạy.

---

Status: APPROVE_WITH_NOTES
