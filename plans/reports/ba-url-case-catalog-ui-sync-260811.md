# Bản đồ URL · Case · Đồng bộ giao diện (toàn admin)

**Ngày:** 2026-08-11 (refresh goal)  
**Đối tượng:** chủ dự án (không cần nhớ thuật ngữ dev)  
**Nguồn routes:** `apps/admin/src/routes/*` + `nav-registry.ts`  
**PR #110:** để sau — không ship trong goal này  

---

## 0. Thuật ngữ đơn giản

| Cần nhớ | Ý nghĩa |
|---------|---------|
| **Danh sách** | Menu → bảng các phiếu |
| **Form** | Mở 1 phiếu bằng mã UUID, làm việc + chia sẻ link |
| **Cùng vỏ màn (Đạt)** | Header chứng từ + dải tóm tắt + sheet (+ dải trạng thái nếu có vòng đời) |
| **Một phần** | Đã có form/list nhưng thiếu đủ chrome hoặc tab/workspace |
| **Mỏng** | Form/list tối thiểu |
| **List / Config / Placeholder** | Không phải form chứng từ UUID đầy đủ |
| **Console** | Bộ giao diện admin CMC (học cảm giác Odoo, không copy TEKY teal) |

**Mẫu URL**

```
Danh sách:  /khu-vực/tên
Form:       /khu-vực/tên/{mã-uuid}
Chia sẻ:    /go/{loại}/{mã-uuid}
```

**Thang vỏ (chrome grade)**  
`Đạt` · `Một phần` · `Mỏng` · `List` · `Config` · `Placeholder` · `Dashboard` · `Auth` · `Tool` · `Báo cáo` · `Ops`

---

## 1. Ma trận URL × case (mọi leaf nav + form route)

### 1.1 Tổng quan · Auth

| Case | List / màn | Form | Vỏ |
|------|------------|------|-----|
| Tổng quan | `/cockpit` | — | Dashboard |
| Đăng nhập | `/login` | — | Auth |
| Đổi mật khẩu | `/change-password` | — | Auth |
| Chia sẻ chung | `/go/{loại}/{uuid}` | → form đích | Ops |

### 1.2 Nhân sự (`/hr/*`)

| Case | List | Form | Vỏ | Ghi chú |
|------|------|------|-----|---------|
| Chấm công | `/hr/checkin` | — (thao tác tại chỗ) | **Một phần** | Thẻ chấm lớn; tab phiếu; **không** form bù ngày tự do |
| Đăng ký ca | `/hr/shifts` · `?scope=` | `/hr/shifts/{uuid}` · `/hr/shifts/new` | **Đạt** | List index-only |
| KPI | `/hr/kpi` | `/hr/kpi/{uuid}` | **Đạt** | Shared board |
| Của tôi | `/hr/my` | — | List | Self |
| Chốt lương | `/hr/payroll` | query user/period | Ops | |
| Bậc lương | `/hr/salary-tiers` | — | Config | |
| Cấu hình ca | `/admin/shift-config` | — | Config | Nav HR, path admin |

### 1.3 Tài chính & điều hành

| Case | List | Form | Vỏ |
|------|------|------|-----|
| Phiếu thu | `/finance` | `/finance/{uuid}` · `/finance/new` | **Đạt** |
| Hoàn tiền (mục lục) | `/finance/refund` | → `/finance/{uuid}` | List → form |
| Xếp lớp | `/finance/class-placement` | — | Ops |
| Doanh thu | `/ops/revenue` | — | Báo cáo |
| Đối soát | `/ops/recon` | — | Ops |

### 1.4 CRM

| Case | List | Form | Vỏ |
|------|------|------|-----|
| Pipeline / cơ hội | `/crm` | `/crm/opportunities/{uuid}` | **Đạt** |
| Nhập lead | `/crm/bulk-import` | — | Tool |
| Báo cáo tuyển sinh | `/crm/report` | — | Báo cáo |
| Họp sau bán | `/crm/post-sale-meeting` | — | List + dialog |
| Case sau bán | `/crm/aftersale` | `/crm/aftersale/{uuid}` | **Đạt** |

### 1.5 Lớp · học viên · phụ huynh

| Case | List | Form | Vỏ |
|------|------|------|-----|
| Học viên | `/admin/students` | `/admin/students/{uuid}` | **Đạt** (goal densify) |
| Lớp học | `/admin/classes` | `/admin/classes/{uuid}` | **Đạt** (goal densify) |
| Khoá học | `/admin/courses` | — | List/Config |
| Phụ huynh | `/admin/parents` | `/admin/parents/{uuid}` | **Đạt** |

### 1.6 Giảng dạy

| Case | List / màn | Form | Vỏ |
|------|------------|------|-----|
| Lịch dạy | `/teaching/schedule` | → buổi | Ops (calendar) |
| Buổi học | (từ lịch) | `/teaching/sessions/{uuid}?tab=` | **Đạt** |
| Điểm danh workspace | `/teaching/attendance` | query | Ops |
| Chấm bài | `/teaching/grading` | query | Ops |
| Nhật ký buổi (menu) | `/teaching/session-evidence` | — | Ops |
| Nhận xét buổi (menu) | `/teaching/session-assessment` | — | Ops |
| Bài tập | `/teaching/exercises` | — | Ops |
| Báo cáo AI | `/admin/report-cards` | — | Ops (path lệch teaching) |

### 1.7 Gắn kết · Quản trị

| Case | URL | Vỏ |
|------|-----|-----|
| Quà tặng | `/admin/engagement/gifts` | Config |
| Đổi thưởng | `/admin/engagement/rewards` | List/Queue |
| Bảng xếp hạng | `/admin/engagement/leaderboard` | Placeholder |
| Người dùng | `/admin/users` | Config |
| Cơ sở | `/admin/facilities` | Config |
| IP mạng | `/admin/network-ip` | Config |
| Nhật ký hệ thống | `/admin/audit-log` | Config |
| Design lab | `/design` | Tool (dev) |

### 1.8 Link chia sẻ `/go/...`

| Entity | Form đích |
|--------|-----------|
| opportunity | `/crm/opportunities/{id}` |
| receipt | `/finance/{id}` |
| student | `/admin/students/{id}` |
| classBatch | `/admin/classes/{id}` |
| shiftRegistration | `/hr/shifts/{id}` |
| kpiScore | `/hr/kpi/{id}` |
| afterSaleCase | `/crm/aftersale/{id}` |
| parentAccount | `/admin/parents/{id}` |
| classSession | `/teaching/sessions/{id}` |

---

## 2. Form chứng từ — grade sau goal

| Form | URL | Grade | Primary actions |
|------|-----|-------|-----------------|
| Ca | `/hr/shifts/{id}` | Đạt | Duyệt / Từ chối / Hủy |
| KPI | `/hr/kpi/{id}` | Đạt | Xác nhận / Ghi đè |
| Phiếu thu | `/finance/{id}` | Đạt | Duyệt / Hoàn / Huỷ |
| Aftersale | `/crm/aftersale/{id}` | Đạt | Tiếp nhận / Giải quyết / Đóng |
| Cơ hội | `/crm/opportunities/{id}` | Đạt | Stage actions |
| Phụ huynh | `/admin/parents/{id}` | Đạt | Email / Khóa LMS |
| Buổi học | `/teaching/sessions/{id}` | Đạt | Tab hub |
| Học viên | `/admin/students/{id}` | **Đạt** | setLifecycle |
| Lớp | `/admin/classes/{id}` | **Đạt** | assignTeacher · sessions |

---

## 3. Học 4 ảnh TEKY/Odoo (cảm giác ≠ luật)

| Ảnh | Học | Không học |
|-----|-----|-----------|
| 1 Chấm thẻ lớn | CTA một nút | Skin teal TEKY |
| 2 Kanban ticket | Nhìn trạng thái | Product kanban bù tự do |
| 3 Bảng công tháng | Cột dày | Wave này **defer** |
| 4 KPI form | Statusbar + sheet | Chatter |

---

## 4. Hàng đợi tiếp (sau goal)

1. Đồng bộ **mật độ list** (ListPage + FilterBar) ca/KPI/aftersale/phiếu/PH  
2. Impeccable polish residual chấm công  
3. Owner: PR #110  
4. **Không:** bảng công tháng · kanban TEKY · chatter · LMS portal  
