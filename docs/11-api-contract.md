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

### HR / Payroll / Shift
| Procedure | Loại | Quyền | Ghi chú |
|---|---|---|---|
| `checkInOut.punch` | mutation | `checkInOut.punch` | trong WiFi/IP facility |
| `checkInOut.monthlyReport` | query | giám đốc | aggregate server-side |
| `payroll.assembleSlip` | query/mutation | `payroll.*` | self-healing từ punch live; phạt post-tax |
| `shiftRegistration.submit` | mutation | `shift.register` | ticket-lock 1 phiếu |
| `shiftRegistration.approve` | mutation | managerId/HR/GĐ | `assertAssignedApprover`, chống tự-duyệt |

### Identity / Platform
| Procedure | Loại | Quyền | Ghi chú |
|---|---|---|---|
| `auth.*` / `lmsAuth.*` | — | — | SSO staff / OTP-phone PH |
| `student.*` · `guardian.*` | mutation/query | role-gate | không có UI tạo student mồ côi |
| `audit.*` | query | giám sát | nền SoD + agent oversight |
| `search.*` · `dashboard.*` | query | protected | tìm kiếm, tổng quan |

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
