# Tài liệu 11 — API Contract & Documentation (tRPC) — CMC EDU v2

> Hợp đồng FE↔BE (và agent↔BE). Đây là "contract chain": test viết theo hợp đồng này, không theo
> giả định. Mã nguồn `apps/api/src/routers/*` là nguồn sự thật; tài liệu này chuẩn hoá **quy ước,
> mô hình lỗi, phân quyền, phân trang** và catalog procedure chính.

---

## 1. Quy ước procedure

API là **tRPC** (type-safe end-to-end). Mỗi endpoint là một *procedure* thuộc một *router* (miền).

| Loại procedure | Ý nghĩa | Dùng khi |
|---|---|---|
| `publicProcedure` | Không cần đăng nhập | Rất hiếm (health, public lead intake) |
| `protectedProcedure` | Cần session staff hợp lệ | Đọc chung đã đăng nhập |
| `lmsProcedure` | Cần session LMS (PH/HS), **không** SYSTEM bypass | Cổng phụ huynh/học sinh |
| `requirePermission('module','action')` | Gate theo RBAC registry | **Mặc định cho mọi nghiệp vụ** |

- **Đặt tên:** `module.action` (vd `finance.receiptApprove`, `enrollment.enroll`).
- **query vs mutation:** `query` = đọc (không side-effect); `mutation` = ghi.
- **Validate input:** bắt buộc `zod` (`z.object({...})`) — id là `z.string().uuid()` hoặc
  `z.number().int().positive()` cho facilityId.
- **Nguồn phân quyền duy nhất:** `requirePermission` đọc `@cmc/auth` registry — **cùng `can()` mà nav
  và UI dùng** (không hardcode role — nợ TL3).

## 2. Mô hình lỗi (Error model)

Dùng `TRPCError` với 5 mã (theo tần suất thật trong repo):

| Mã | Khi nào | Ví dụ |
|---|---|---|
| `BAD_REQUEST` | Input sai / vi phạm rule nghiệp vụ | refund vượt cap, ngày ca trong quá khứ |
| `FORBIDDEN` | Không đủ quyền | sale gọi `receiptApprove` |
| `CONFLICT` | Xung đột trạng thái/đồng thời | trùng phòng/GV, duplicate SĐT, race |
| `NOT_FOUND` | Không tồn tại / ngoài RLS | id không thuộc facility caller |
| `UNAUTHORIZED` | Chưa đăng nhập / session hỏng | thiếu session |

**Kết quả cảnh báo (không lỗi):** một số procedure trả *discriminated union*
`{ status: 'success' | 'warning', ... }` (vd `receiptCreate` khi trùng SĐT — QĐ 0037). FE **phải
narrow `status==='success'`** trước khi đọc payload. Đây là hợp đồng, không phải tuỳ chọn.

**`data.appCode` (HR remediation phase 4):** `errorFormatter` (apps/api/src/trpc.ts) additive-only
copy `appCode` từ `AppCodeError` (apps/api/src/errors.ts) sang `shape.data.appCode` khi lỗi mang mã
máy-đọc-được cụ thể hơn `code` chuẩn (vd `OFFSITE_REASON_REQUIRED`, `COOLDOWN` — `checkInOut.punch`). Lỗi
thường (`TRPCError`/Prisma rethrow) không có `appCode` — FE kiểm `data?.appCode` optional, không suy
diễn từ message.

## 3. Phân trang, lọc, sắp xếp (khớp URL query — TL6)

- Input list chuẩn: `{ q?, filter?, sort?, page?, pageSize? }` — ánh xạ 1-1 với query param URL.
- Trả về: `{ items, total, page, pageSize }` (cursor cho danh sách rất lớn).
- Server đọc các param này để tải dữ liệu → deep-link ra đúng trạng thái (TL6 §2).

## 4. Idempotency (bắt buộc cho mutation agent gọi)

- Mutation có side-effect tiền/định danh phải **idempotent** hoặc có `idempotencyKey` — vì agent
  (consumer outbox) có thể gọi lại khi retry (TL4, TL8 §2).
- Provisioning: `find-or-create` theo `phone`, xử `unique_violation` bằng SAVEPOINT/ON CONFLICT.

## 5. Catalog procedure chính (theo miền)

> Đây là các procedure trọng yếu (đã xác minh/đại diện). Code là nguồn đầy đủ; bảng này chốt *hợp
> đồng + quyền* để test & FE bám.

### Finance
| Procedure | Loại | Quyền | Input (rút gọn) | Trả về / hệ quả |
|---|---|---|---|---|
| `finance.receiptCreate` | mutation | `finance.receiptCreate` (sale=nháp) | `{ opportunityId?, studentName, parentPhone, amount, classBatchId? }` | `{status:'success'|'warning', receipt}` |
| `finance.receiptApprove` | mutation | `finance.receiptApprove` (v2: GĐKD — ke_toan deferred) | `{ receiptId }` | **Cổng tiền**: auto-O5 + provisioning + outbox email |
| `finance.receiptCancel` | mutation | `finance.receiptApprove` | `{ receiptId, reason }` | revert O4, rollback provisioning |
| `finance.refundCreate` | mutation | `finance.refundCreate` | `{ receiptId, amount }` | append RefundRecord (cap FOR UPDATE) |
| `finance.receiptList` | query | `finance.receiptList` (roster = `receiptApprove`, K3) | `{ status?, page?, pageSize? }` | `{items,total,page,pageSize}` — hàng đợi duyệt phiếu |
| `finance.receiptGet` | query | `finance.receiptGet` (roster = `receiptApprove`, K3) | `{ receiptId }` | 1 receipt (facility-scoped) |
| `crm.opportunityLookup` | query | `crm.opportunityLookup` | `{ phone }` | tồn tại opp? (hẹp, không mở CRM) |

### Enrollment / Academic
| Procedure | Loại | Quyền | Input | Trả về |
|---|---|---|---|---|
| `enrollment.enroll` | mutation | `enrollment.enroll` | `{ facilityId, classBatchId, studentId, opportunityId? }` | Enrollment `reserved` (→`active` khi phiếu thu duyệt — ADR-A) |
| `enrollment.mine` | query | `lmsProcedure` | — | ghi danh của con caller (LMS) |
| `classBatch.create` | mutation | `class.create` (GĐĐT) | `{ ..., startDate, endDate, slots[] }` | tạo lớp **+ auto sinh session** |
| `schedule.generateSessions` | mutation | `schedule.generate` | `{ classBatchId }` | re-generate (mở rộng/đổi lịch) |
| `attendance.mark` / `markAll` | mutation | `attendance.mark` | `{ sessionId, studentId, status }` | cần ClassSession tồn tại |
| `assessment.*` | mutation | `assessment.*` | `{ studentId, sessionId, content }` | draft agent → GV chốt |
| `assessment.listBySession` | query | `assessment.draft` | `{ sessionId }` | staff read — nhận xét định tính của 1 buổi (HR remediation phase 5) |
| `classBatch.assignTeacher` | mutation | `class.create` (GĐĐT) | `{ classBatchId, teacherAppUserId }` | gán GV dạy lớp (FK `teacherAppUserId`, thay `teacherId` free-text) |

### HR / Payroll / Shift — auto-score + salary-tier lifecycle (docs/20, ADR 0044)
> `kpi.submit` / `kpi.approve` (đơn lẻ) / `kpi.getForUser` / `compensation.upsertRate` đã **BỎ**
> (HR remediation): lifecycle auto-score thay thế nhập tay; `approved` chỉ đạt được qua `bulkApprove`;
> baseSalary/unitRate/quota nguồn duy nhất là `SalaryTier` catalog qua `assignTier`.

| Procedure | Loại | Quyền | Ghi chú |
|---|---|---|---|
| `checkInOut.punch` | mutation | `checkInOut.punch` | `{ reason?: string }` — ghi mốc vào/ra ngày (ADR 0043); ngoài mạng lần đầu trong ngày (có ca đăng ký, chưa có phiếu) mà thiếu `reason` → `appCode: OFFSITE_REASON_REQUIRED`; double-tap <10s → `appCode: COOLDOWN` |
| `manualPunch.resubmit` | mutation | `manualPunch.resubmit` | `{ ticketId, reason }` — chỉ chủ phiếu, chỉ khi `rejected`; cập nhật dòng cũ (không tạo dòng mới) |
| `manualPunch.approve` / `reject` | mutation | `manualPunch.approve` | GĐ theo track của chủ phiếu (sale→`giam_doc_kinh_doanh`, giáo viên→`giam_doc_dao_tao`, `super_admin` mọi phiếu); anti-self-approve; TOCTOU-safe (`updateMany WHERE status IN (pending,resubmitted)`); `approve` trả thêm `warnings: string[]` (rỗng khi không có) — `PAYSLIP_FINALIZED` và/hoặc `SINGLE_PUNCH_NO_CREDIT` (phiếu 1-mốc, `checkOutAt=null`, vẫn approved nhưng KHÔNG có công — rule không đổi, chỉ thêm tín hiệu) |
| `manualPunch.list` | query | protected | `{ scope: 'inbox'\|'mine', status? }` — inbox = phiếu track caller có quyền duyệt (hoặc mọi ticket nếu super_admin) |
| `shift.createGroup` / `createTemplate` | mutation | `shift.manage` (GĐKD/GĐĐT) | catalog ShiftGroup/ShiftTemplate |
| `shift.submit` | mutation | `shift.submit` | `{ shiftGroupId, fromDate, toDate, entries[] }` — ticket-lock 1 `submitted`/appUser, `fromDate` phải tương lai, group-type khớp `resolveShiftGroup(position)` |
| `shift.approve` / `reject` | mutation | `shift.approve` | anti-self + gate group-type (GIAO_VIEN↔`giam_doc_dao_tao`, KINH_DOANH↔`giam_doc_kinh_doanh`, super_admin bypass); `reject` bắt buộc `reason` (≥3 ký tự), ghi `rejectReason`, giải phóng ticket-lock + overlap |
| `shift.listGroups` | query | protected | catalog nhóm ca + template lồng nhau |
| `shift.myRegistrations` | query | protected (self) | phiếu đăng ký của chính caller + `rejectReason` nếu bị từ chối |
| `shift.pendingForApproval` | query | `shift.approve` | hàng đợi `submitted`, scoped theo group-type quyền caller |
| `salaryTier.list` / `create` / `update` | query/mutation | `salaryTier.manage` (GĐKD/GĐĐT) | catalog bậc lương (`baseSalary`, `unitRate`, `requiredShifts`, `requiredMetric`, `type`) |
| `compensation.assignTier` | mutation | `salaryTier.manage` | `{ appUserId, tierId }` — target phải sale/giao_vien, tier.type phải khớp role |
| `compensationPolicy.get` / `upsert` | query/mutation | `compensationPolicy.manage` (super_admin) | `{ penaltyRatePerLateMinute, penaltyRatePerEarlyMinute }` per-facility |
| `kpi.refresh` | mutation | `kpi.refresh` | `{ period, appUserId? }` — recompute + upsert draft (idempotent); tự = mình, khác người cần role director |
| `kpi.submitSlip` | mutation | `kpi.submitSlip` | `{ period }` — chủ phiếu tự nộp, mở từ ngày 3 tháng kế tiếp ICT; tự refresh trước khi nộp |
| `kpi.confirm` | mutation | `kpi.confirm` | `{ kpiScoreId }` — direct manager xác nhận (submitted→confirmed), anti-self |
| `kpi.override` (khoá quyền `kpi.approve`) | mutation | `kpi.approve` | `{ kpiScoreId, value, overrideReason }` — director set trực tiếp; sửa slip `approved` chỉ super_admin khi payslip đã reopen |
| `kpi.bulkApprove` | mutation | `kpi.bulkApprove` | `{ period }` — 2 GĐ tất toán mọi `confirmed` có Payslip `finalized`, branch-scope theo ROLE (không theo `position`), loại trừ phiếu của chính mình |
| `kpi.list` | query | protected (director) | `{ period, status? }` — inbox branch-scope theo ROLE |
| `kpi.myScore` | query | protected (self) | `{ period }` — đọc phiếu KPI của chính mình |
| `payslip.assemble` | mutation | `payslip.assemble` (GĐKD/GĐĐT) | `{ appUserId, period }` — base(tier) + %côngca×%chỉ-số×đơnGiá − phạt, từ chối nếu chưa gán tier |
| `payslip.finalize` / `reopen` | mutation | `payslip.finalize`/`reopen` | khoá/mở lại bảng lương tháng |
| `payslip.getForUser` | query | protected | `{ appUserId, period }` — riêng tư: chủ sở hữu hoặc director |
| `payslip.my` | query | protected (self) | `{ period }` — bảng lương của chính mình, `null` nếu chưa assemble |

### Identity / Platform
| Procedure | Loại | Quyền | Ghi chú |
|---|---|---|---|
| `auth.*` / `lmsAuth.*` | — | — | SSO staff / 2-tier LMS auth (xem decision note bên dưới) |

> **product-decision 2026-07-07**: Auth LMS đảo 2 tầng — ngược với QĐ0033/WF-P1-07 cũ (phone+OTP đơn tài khoản). Hành vi trước đây: phụ huynh đăng nhập bằng SĐT + OTP SMS/phone. Hành vi hiện tại: (a) **Phụ huynh** (`kind='parent'`) đăng nhập bằng **email + OTP qua email**; procedure: `lmsAuth.requestEmailOtp` / `lmsAuth.verifyEmailOtp`. (b) **Học sinh** (`kind='student'`) đăng nhập bằng **SĐT phụ huynh + password**; procedure: `lmsAuth.studentLogin`. `LmsSubject.kind` là discriminator phân tách session. Tham chiếu: UI implementation plan phase 01a/01b.
>
> **BLOCKED-ON-COMMS**: Luồng (a) email OTP **chưa hoạt động trong production** — `ConsoleEmailTransport` chỉ ghi log, không gửi email thật. Sẽ được mở khoá khi cung cấp Brevo API key hoặc MS Graph credentials. Không được tài liệu hoá luồng email OTP PH như đang chạy trong production cho đến khi dependency này được giải quyết.
| `student.lookup` | query | `student.lookup` (staff-only, K4) | `{ phone?, name? }` → `{id, fullName, lifecycle}[]`; facility-scoped, mỗi kết quả không rỗng được audit (docs/08 §7). Nguồn `studentId` hợp lệ cho renewal (`receiptCreate.studentId`) / `enrollment.enroll.studentId`. |
| `guardian.listPendingLinks` | query | `guardian.listPendingLinks` (roster = `approveLink`, K3) | `{ status?='pending', page?, pageSize? }` | hàng đợi `GuardianLinkRequest` cho staff duyệt |
| `student.*` (khác) · `guardian.*` (khác) | mutation/query | role-gate | không có UI tạo student mồ côi |
| `facility.create` | mutation | `facility.create` (super_admin only, K7) | `{ name }` | tạo `Facility` — chỉ super_admin (registry không có role nào khác) |
| `facility.list` | query | `facility.list` (super_admin only, K7) | `{ page?, pageSize? }` | `{items,total,page,pageSize}` |
| `audit.*` | query | giám sát | nền SoD + agent oversight |
| `search.*` · `dashboard.*` | query | protected | tìm kiếm, tổng quan |

> **K7 boundary note:** mọi request qua `protectedProcedure` (staff) giờ bị chặn nếu `facilityId` đã
> resolve không khớp một `Facility` thật (`requireValidFacility`, apps/api/src/trpc.ts) — một
> facilityId giả/gõ sai không còn âm thầm tạo "tenant vô hình". Dev seed: `pnpm --filter @cmc/db run db:seed`.

## 6. Agent tiêu thụ API qua MCP

Mỗi procedure được **bọc thành một MCP tool** (TL4, TL9-K5). Agent gọi tool → thực thi qua **đúng
tRPC procedure** → chịu đúng `requirePermission` + RLS + audit. Không có tool nào chạm DB trực tiếp.
Tool schema = input zod của procedure; kết quả = output procedure.

## 7. Hợp đồng → Test

Mỗi procedure nghiệp vụ có **≥1 integration test** (RLS/flow) + unit cho hàm thuần bên trong. Ô
"Test" trong Ma trận Truy vết (TL00) trỏ tới đúng file test của procedure. Không procedure nào
được coi "xong" nếu ô Test trống.

> Liên kết: TL10 (data model — input/output entity) · TL6 (query param ↔ list input) · TL1 (bất biến
> procedure phải giữ) · TL4/TL13 (agent dùng API).
