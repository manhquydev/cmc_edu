# Tài liệu 06 — Kiến trúc URL & Routing (CMC EDU v2)

> Bạn yêu cầu URL rõ ràng cho từng thành phần, nhất là **trang chi tiết**. Tài liệu này định nghĩa
> chuẩn URL cho toàn hệ v2, phủ đủ ~30 miền + quy ước trang chi tiết + trạng thái view, deep-link
> được, và **địa chỉ hoá cho AI agent** (agent escalate → người mở đúng bản ghi).
> Bám ADR `0016` (path-based SPA) của repo. Chuẩn hiện đại 2026 (nguồn trong phần chat).

---

## 1. Vì sao KHÔNG dùng kiểu URL Odoo (hash + ID mờ)

URL tham khảo bạn đang dùng:
`erp.teky.edu.vn/web#view_type=kanban&model=hr.work.schedule&menu_id=997&action=1486`

Vấn đề của kiểu này:
- **Hash fragment** (`#…`) — trạng thái nằm sau dấu `#`, server không thấy; khó SSR, khó phân tích.
- **ID mờ** (`menu_id=997&action=1486`) — con người không đọc được, phụ thuộc registry action/menu
  nội bộ; đổi cấu hình là URL gãy.
- **Lộ schema** (`model=hr.work.schedule`) — phơi tên bảng nội bộ ra URL.
- **Không resource-oriented** — URL mô tả *cơ chế khung* (view_type/model/action), không mô tả
  *tài nguyên* người dùng đang xem.

Chuẩn hiện đại (path-based, resource-oriented): thư mục ↔ đoạn URL, trang chi tiết dùng *dynamic
segment* `[id]`; danh sách `/students`, chi tiết `/students/[id]`. Trạng thái view (kanban/lọc/
sort) để ở **query param**, cập nhật bằng history pushState nên **deep-link + back/forward chạy đúng**.

| Tiêu chí | Odoo (hash) | CMC v2 (path-based) |
|---|---|---|
| Trang chi tiết HS | `#model=res.partner&id=42&view_type=form` | `/students/42` |
| Kanban lịch ca | `#view_type=kanban&model=hr.work.schedule&action=1486` | `/hr/shifts?view=kanban` |
| Đọc được | ❌ ID mờ | ✅ tự mô tả |
| SSR / server thấy | ❌ (sau `#`) | ✅ (path + query) |
| Lộ schema | ❌ có | ✅ không |
| Chia sẻ / bookmark | Phụ thuộc registry | ✅ ổn định |

---

## 2. Ngữ pháp URL chuẩn

```
/{area}/{resource}                 → danh sách (list)
/{area}/{resource}/new             → tạo mới (hoặc modal, xem §5)
/{area}/{resource}/{id}            → chi tiết (detail) — tab mặc định
/{area}/{resource}/{id}/{tab}      → chi tiết, tab con (deep-link được)
/{area}/{resource}/{id}/{tab}/{subId}  → lồng cấp 2 khi cần
```

Quy tắc:
- **`{id}`** ưu tiên mã nghiệp vụ đọc được khi có (class code `HN-UCREA-2026-001`), không thì id ngắn.
- **Kebab-case**, số ít cho resource khi hợp lý; **không** để tên bảng/enum nội bộ ra URL.
- **Tab chính = sub-path** (bookmark được, back/forward rõ). **Trạng thái tạm = query param**
  (view/filter/sort/page/q) — vì đây là loại dữ liệu nên đọc từ `searchParams` để tải dữ liệu, còn
  lọc thuần client thì đọc bằng `useSearchParams` không re-render nặng.

**Hợp đồng query param dùng chung (mọi trang list):**
`?view=table|kanban|calendar` · `&q=` (tìm) · `&filter[status]=pending` · `&sort=-createdAt` ·
`&page=2` · `&tab=` (nếu tab để ở query thay vì path).

---

## 3. Bản đồ Route toàn hệ (đủ ~30 miền)

### A. Học tập & Giảng dạy
| Trang | URL | Chi tiết / tab |
|---|---|---|
| Lịch dạy | `/teaching/schedule?view=calendar&date=2026-07` | — |
| Điểm danh | `/teaching/attendance?session={sessionId}` | — |
| Báo cáo điểm danh | `/teaching/attendance/report?scope=class&term=` | — |
| Chấm bài | `/teaching/grading?class={classId}` | — |
| Học bạ | `/teaching/report-cards` → `/teaching/report-cards/{studentId}` | — |
| Lớp học | `/classes?view=table` → `/classes/{classId}` | `/{classId}/overview` · `/students` · `/sessions` · `/enroll` |
| Khóa học | `/courses` → `/courses/{courseId}` | — |
| Chương trình | `/curriculum` → `/curriculum/{unitId}` | — |
| **Học sinh** | `/students?q=` → `/students/{studentId}` | `/{id}/profile` · `/enrollments` · `/attendance` · `/grades` · `/guardians` |
| Phụ huynh | `/parents` → `/parents/{parentId}` | `/{id}/children` · `/receipts` |
| Họp phụ huynh | `/parent-meetings` → `/parent-meetings/{id}` | — |
| Duyệt cấp độ | `/level-progress?status=pending` | — |
| Chứng chỉ | `/certificates` → `/certificates/{id}` | — |

### B. CRM & Kinh doanh
| Trang | URL | Chi tiết / tab |
|---|---|---|
| Cơ hội (CRM) | `/crm/opportunities?view=kanban&stage=O3` → `/crm/opportunities/{oppId}` | `/{id}/timeline` · `/activities` |
| Liên hệ | `/crm/contacts` → `/crm/contacts/{id}` | — |
| Chăm sóc KH | `/crm/aftersale?queue=open` | — |

### C. Tài chính & Nhân sự–Lương
| Trang | URL | Ghi chú |
|---|---|---|
| Tài chính (phiếu thu) | `/finance/receipts?status=pending` → `/finance/receipts/{id}` | — |
| **Tạo phiếu thu từ cơ hội** | `/finance/receipts/new?opportunityId={oppId}` | Điền sẵn tên HS/SĐT/lớp (QĐ 0037) |
| Báo cáo doanh thu | `/finance/revenue-report?range=` | — |
| Đối soát theo kỳ | `/finance/reconciliation?term=` | Nơi Reconciliation agent đổ cờ |
| Hoàn tiền | `/finance/refunds` → `/finance/refunds/{id}` | — |
| Hộp thư gửi đi | `/finance/outbox` | (email outbox) |
| Nhân sự | `/hr/staff` → `/hr/staff/{id}` | `/{id}/profile` · `/payslips` · `/shifts` |
| Lương | `/hr/payroll?month=2026-07` → `/hr/payroll/{payslipId}` | — |
| KPI | `/hr/kpi?period=` | — |
| Bậc lương | `/hr/salary-tiers` | — |
| Của tôi (KPI + Lương) | `/hr/my?period=` | tab KPI / Lương |
| Chấm công | `/attendance/check-in-out` | — |
| Đăng ký ca | `/hr/shifts?scope=mine\|inbox` → `/hr/shifts/new` → `/hr/shifts/{registrationId}` | Form chi tiết phiếu (record-centric; plan 260811-1408). Không dùng `/attendance/shifts` (stale). |
| Danh mục ca | `/admin/shift-config` | — |

### D. Định danh & Quản trị
| Trang | URL |
|---|---|
| Cơ sở & Người dùng | `/admin/facilities` → `/admin/facilities/{id}` · `/admin/users` → `/admin/users/{id}` |
| IP WiFi chấm công | `/admin/network-ip` |

### E. Tương tác & Gắn kết
| Trang | URL |
|---|---|
| Huy hiệu | `/engagement/badges` → `/engagement/badges/{id}` |
| Bảng xếp hạng | `/engagement/leaderboard` |
| Đổi quà | `/engagement/rewards` |
| Thông báo | `/notifications` |

### F. Nền tảng
| Trang | URL |
|---|---|
| Tổng quan | `/` |
| Cockpit điều hành | `/cockpit` |
| Tìm kiếm | `/search?q=` |

> **LMS phụ huynh/học sinh** là app riêng (domain/subdomain riêng), cùng ngữ pháp:
> `/child/{studentId}/exercises`, `/child/{studentId}/report-card`.

> **product-decision 2026-07-07 — LMS login routes**: Auth LMS đổi sang 2-tier. Routes liên quan:
> - `/login` — màn đăng nhập LMS chính; có 2 tab: `?tab=parent` (email+OTP) và `?tab=student` (SĐT+password). Tab mặc định: `parent`.
> - `/login/change-password` — màn đổi mật khẩu bắt buộc khi `mustChangePassword=true` (học sinh).
> - `/select-child` — profile picker sau khi phụ huynh đăng nhập (≥2 con).
>
> Không còn route phone-OTP (`/login/otp-phone` hoặc tương đương) — đã loại bỏ. Nếu codebase cũ còn route này, cần xoá. **BLOCKED-ON-COMMS**: Tab phụ huynh (email OTP) chưa functional production — xem TL18/TL24.

---

## 4. Quy ước Trang chi tiết (phần bạn nhấn mạnh)

Trang chi tiết là `master → detail`: từ list bấm 1 dòng → `/{resource}/{id}`. Nguyên tắc:

1. **Mỗi bản ghi có URL riêng ổn định** — chia sẻ được cho đồng nghiệp, bookmark được, agent
   link được.
2. **Tab chính là sub-path**, không phải state ẩn: `/students/42/grades` chứ không `?tab=grades`
   ẩn. → back/forward đi giữa các tab đúng như người dùng mong đợi.
3. **Tab mặc định** = `/students/42` tự map về tab đầu (vd `/profile`) — không để trang trắng.
4. **Trạng thái lọc trong tab** vẫn ở query: `/students/42/attendance?month=2026-06`.
5. **Không dùng ID mờ** ở URL chi tiết nếu có mã đọc được (ưu tiên `class code` hơn uuid).

---

## 5. Modal, "tạo mới", và deep-link

- **Tạo mới**: nếu là form lớn (phiếu thu) → route riêng `/finance/receipts/new` (deep-link, F5 an
  toàn). Nếu là thao tác nhỏ → modal, phản ánh bằng query `?modal=create` để vẫn share/back được.
- **Xem nhanh trong list**: modal chi tiết vẫn đổi URL sang `/students/42` (nền list giữ nguyên);
  F5 vào thẳng trang chi tiết đầy đủ. (Với react-router v7: render modal theo URL + giữ nền; nếu
  dùng Next.js thì đây là *intercepting route*.)
- **Deep-link luôn phải "cold-start được"**: dán URL vào tab mới phải ra đúng trạng thái, không
  phụ thuộc điều hướng trước đó.

---

## 6. URL địa chỉ hoá cho AI Agent (nối HITL ↔ routing)

Khi agent escalate lên người (TL4), nó **gửi kèm URL sâu tới đúng bản ghi + cờ lý do**:
- Reconciliation agent phát hiện phiếu tự-duyệt bất thường →
  `/finance/receipts/{id}?flag=self-approved-over-threshold`
- Admissions agent tạo O1 chờ sale →
  `/crm/opportunities/{id}?flag=new-lead`

Người bấm là **tới thẳng nơi cần quyết định**, không phải đi tìm. URL vì thế là *giao diện chung*
giữa người và agent — thêm một lý do để URL phải rõ ràng, ổn định, đọc được.

---

## 7. Ánh xạ sang route config (React + react-router-dom v7 — stack thật)

Stack thật là **Vite + React 19 + react-router-dom v7** (không Next.js — xem TL18). URL grammar §1–6
**độc lập framework**; triển khai bằng route config lồng nhau, `:id` = param động, layout lồng cho
tab, `useSearchParams` cho view-state.

```tsx
// routes.tsx (react-router-dom v7)
const routes = [
  { path: '/', element: <DashboardLayout/>, children: [   // shell + nav (permission-aware)
    { index: true, element: <Overview/> },                //  /
    { path: 'students', children: [
      { index: true, element: <StudentList/> },            //  /students
      { path: ':studentId', element: <StudentDetail/>, children: [  // detail shell (tabs)
        { index: true, element: <Navigate to="profile"/> },//  /students/:id → profile
        { path: 'profile', element: <StudentProfile/> },   //  /students/:id/profile
        { path: 'grades',  element: <StudentGrades/> },    //  /students/:id/grades
      ]},
    ]},
    { path: 'finance/receipts', children: [
      { index: true, element: <ReceiptList/> },            //  /finance/receipts
      { path: 'new',  element: <ReceiptCreate/> },         //  /finance/receipts/new
      { path: ':id', element: <ReceiptDetail/> },          //  /finance/receipts/:id
    ]},
  ]},
];
```

Mỗi route/layout **gọi cùng `can()`** để gate quyền → route + phân quyền là một (không render được
trang không có quyền). Khớp Ma trận Truy vết (TL00): mỗi URL ↔ màn ↔ permission ↔ test. (Nếu v2 chọn
Next.js — TL18 §6 (b) — thì đổi sang App Router `app/…/page.tsx`; grammar URL không đổi.)

---

## 8. Checklist chuẩn hoá URL (đưa vào cổng DoR)

Mỗi màn mới, trước khi build, phải điền:
- [ ] URL list + URL detail (+ sub-tab) theo ngữ pháp §2.
- [ ] Query param nào là view-state (deep-link được).
- [ ] Permission gate của route (khớp RBAC).
- [ ] Deep-link cold-start được (F5/tab mới ra đúng trạng thái).
- [ ] (Nếu có agent) cờ escalate → URL sâu tương ứng (§6).

> Liên kết: TL00 (index) · TL05 (miền năng lực — nguồn của bản đồ route) · TL2 (UX/IA) ·
> TL4 (agent escalation URL).
