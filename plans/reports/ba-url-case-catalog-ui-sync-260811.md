# Bản đồ URL · Case · Đồng bộ giao diện (toàn admin)

**Ngày:** 2026-08-11  
**Đối tượng:** chủ dự án (không cần nhớ thuật ngữ dev)  
**Mục đích:** biết **mỗi màn ở đâu**, **làm gì**, **đã giống form chứng từ chưa**, **làm tiếp cái gì**  
**PR #110:** để sau — không ship trong đợt này  

---

## 0. Thuật ngữ đơn giản (thay dev jargon)

| Thuật ngữ cũ (dev) | Cách nói BA |
|--------------------|-------------|
| Resource-centric | **Một loại phiếu = một menu + một danh sách + form mở bằng mã** |
| Form-depth | **Mở chi tiết bằng link UUID**, làm việc trên form, chia sẻ được |
| List index-only | **Danh sách chỉ để mở phiếu**, không duyệt hàng loạt trên list |
| Console grammar / densify | **Cùng “vỏ” màn**: header chứng từ · dải trạng thái · dải số tóm tắt · sheet thông tin |
| WorkflowStatusbar | **Dải bước trạng thái** (Soạn → Chờ duyệt → …) |
| EntityHeader | **Tiêu đề chứng từ + nút chính** |
| HighlightStrip | **Dải tóm tắt** (giá trị / trạng thái / ngày) |
| HITL | **Người bấm nút trên form** (duyệt, xác nhận…) |
| Design system Console | **Bộ khung giao diện admin CMC** (học Odoo, màu token CMC) |

**Mẫu URL chuẩn**

```
Danh sách:  /khu-vuc/ten-chung-tu
Soạn mới:   /khu-vuc/ten-chung-tu/new     (khi cần)
Form:       /khu-vuc/ten-chung-tu/{mã-uuid}
Chia sẻ:    /go/{loại}/{mã-uuid}  → nhảy vào form
```

---

## 1. Tình trạng thật (advise nhanh)

| Nhóm | Đã có form/link? | Vỏ form Console? | Luật nghiệp vụ |
|------|------------------|------------------|----------------|
| Ca · KPI · Phiếu thu · Aftersale · Cơ hội CRM | Có | **Đạt** (densify) | Giữ |
| Phụ huynh | Có form | **Mỏng** → wave này densify | Giữ email/LMS |
| Buổi học | Có form + tab | **Mỏng** → wave này densify header | Giữ tab điểm danh/nhận xét |
| Học viên · Lớp | Có form | **Một phần** (đã strip/sheet) | Giữ lifecycle |
| Chấm công | Màn thao tác (không form UUID) | Thẻ chấm **đã polish** | ADR punch |
| Nhiều list/config (bậc lương, quà, users…) | List / config | Chưa cần form Odoo | Không ép form giả |
| Bảng công tháng / kanban bù TEKY | Không | — | **Cấm product** nếu phá công–lương |

---

## 2. Ma trận URL toàn admin (case × URL)

**Cột “Vỏ”:** Đạt = statusbar/header/strip/sheet; Một phần; Mỏng; List; Config; Placeholder.

### 2.1 Tổng quan

| Case | URL | Vỏ | Ghi chú BA |
|------|-----|-----|-----------|
| Tổng quan | `/cockpit` | Dashboard | Không form chứng từ |

### 2.2 Nhân sự

| Case | URL list | URL form | Vỏ | Luật chốt |
|------|----------|----------|-----|-----------|
| Chấm vào/ra | `/hr/checkin` | — (thao tác tại chỗ) | Thẻ chấm **đạt cảm giác** | Punch + offsite reason; **cấm** bù ngày tự do |
| Phiếu bù (của tôi / hàng chờ) | cùng `/hr/checkin` (tab) | — | List + badge | Ticket đóng băng sau nộp; **không** kanban TEKY |
| Đăng ký ca | `/hr/shifts` · `?scope=mine\|inbox` | `/hr/shifts/{uuid}` · `/hr/shifts/new` | **Đạt** | Duyệt trên form; list chỉ mở phiếu; track GĐ |
| KPI | `/hr/kpi` | `/hr/kpi/{uuid}` | **Đạt** | Xác nhận = QL trực tiếp; duyệt cuối bulk GĐ |
| Của tôi | `/hr/my` | — | List tóm tắt | Self-scope |
| Chốt lương | `/hr/payroll` | (query user/period) | List/ops | Không form-depth wave này |
| Bậc lương | `/hr/salary-tiers` | — | Config | |
| Cấu hình ca | `/admin/shift-config` | — | Config | GĐ manage |

### 2.3 Tài chính & điều hành

| Case | URL list | URL form | Vỏ | Luật chốt |
|------|----------|----------|-----|-----------|
| Phiếu thu | `/finance` | `/finance/{uuid}` · `/finance/new` | **Đạt** | Money-gate; duyệt / hoàn / huỷ trên form |
| Hoàn tiền (mục lục) | `/finance/refund` | mở `/finance/{uuid}` | Index → form | Chỉ phiếu đã duyệt; cap remaining |
| Xếp lớp | `/finance/class-placement` | — | Ops | enrollment.enroll |
| Doanh thu | `/ops/revenue` | — | Báo cáo | |
| Đối soát | `/ops/recon` | — | Ops | |

### 2.4 CRM / sau bán

| Case | URL list | URL form | Vỏ | Luật chốt |
|------|----------|----------|-----|-----------|
| Pipeline / cơ hội | `/crm` | `/crm/opportunities/{uuid}` | **Đạt** | Stage pipeline |
| Nhập lead hàng loạt | `/crm/bulk-import` | — | Tool | |
| Báo cáo tuyển sinh | `/crm/report` | — | Báo cáo | |
| Họp sau bán | `/crm/post-sale-meeting` | — | List + dialog | |
| Case sau bán | `/crm/aftersale` | `/crm/aftersale/{uuid}` | **Đạt** | open→…→closed trên form |

### 2.5 Lớp · học viên · phụ huynh

| Case | URL list | URL form | Vỏ | Luật chốt |
|------|----------|----------|-----|-----------|
| Học viên | `/admin/students` | `/admin/students/{uuid}` | **Một phần** | lifecycle |
| Lớp học | `/admin/classes` | `/admin/classes/{uuid}` | **Một phần** | |
| Khoá học | `/admin/courses` | — | List/config | |
| Phụ huynh | `/admin/parents` | `/admin/parents/{uuid}` | **Mỏng → densify** | email LMS · khóa LMS · con link |

### 2.6 Giảng dạy

| Case | URL list | URL form | Vỏ | Luật chốt |
|------|----------|----------|-----|-----------|
| Lịch dạy | `/teaching/schedule` | → buổi | Calendar | |
| Buổi học | (từ lịch) | `/teaching/sessions/{uuid}?tab=` | **Mỏng → densify** | tab điểm danh/nhận xét/nhật ký |
| Điểm danh (workspace) | `/teaching/attendance` | query session | Ops | |
| Chấm bài | `/teaching/grading` | query submission | Ops | |
| Nhật ký / nhận xét (menu) | `/teaching/session-evidence` · `session-assessment` | — | Ops | |
| Bài tập | `/teaching/exercises` | — | Ops | |
| Báo cáo AI | `/admin/report-cards` | — | Ops | path lệch teaching — note |

### 2.7 Gắn kết · Quản trị · Khác

| Case | URL | Vỏ |
|------|-----|-----|
| Quà tặng | `/admin/engagement/gifts` | Config |
| Đổi thưởng | `/admin/engagement/rewards` | Queue |
| Bảng xếp hạng | `/admin/engagement/leaderboard` | Placeholder |
| Người dùng / cơ sở / IP / audit | `/admin/users` … | Config |
| Chia sẻ chung | `/go/{loại}/{uuid}` | Resolver → form |
| Đổi mật khẩu | `/change-password` | Auth |
| Login | `/login` | Auth |

### 2.8 Link chia sẻ đã đăng ký (`/go/...`)

| Loại (entity) | Form đích |
|---------------|-----------|
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

## 3. Đối soát luật (tránh sai lệnh sau triển khai)

| Luật đã chốt | Kỳ vọng | Kết luận |
|--------------|---------|----------|
| Một chứng từ = một menu, không “Duyệt …” | Nav theo resource | **Khớp** |
| Form = nơi quyết định (duyệt ca, confirm KPI…) | Nút trên form | **Khớp** |
| KPI confirm = quản lý; approved = bulk GĐ | Cờ server | **Khớp** |
| Chấm: punch append; cấm bù tự do | UI không form bù | **Khớp** |
| Không kanban ticket TEKY | Không product mới | **Khớp** |
| Hoàn/huỷ trên form phiếu thu | UI có | **Khớp** · **chưa UAT** |
| Console design, không skin TEKY teal | Token CMC | **Đang kéo đồng bộ** |
| Ảnh Odoo/TEKY = cảm giác, không = luật | — | **Nhắc** |

---

## 4. Học 4 ảnh (giữ)

1. **Chấm thẻ lớn** → đã gần tại `/hr/checkin`  
2. **Kanban ticket** → **không** product; dùng tab + badge  
3. **Bảng công tháng** → **defer**  
4. **KPI sheet + statusbar** → đã densify; **không** chatter  

---

## 5. Hàng đợi đồng bộ giao diện (toàn dự án)

### Wave đã xong
- B1 chấm · B2 ca · B3 KPI · B4 aftersale · receipt form  

### Wave **đang làm** (session này)
| # | Case | URL form | Việc |
|---|------|----------|------|
| **B5** | Phụ huynh | `/admin/parents/{uuid}` | Cùng vỏ form (strip + sheet + nút header) |
| **B6** | Buổi học | `/teaching/sessions/{uuid}` | EntityHeader + strip + sheet tổng quan |

### Wave tiếp (sau B5–B6)
| # | Case | Việc | Ưu tiên |
|---|------|------|---------|
| B7 | Học viên form | Thêm statusbar lifecycle nếu cần | Cao |
| B8 | Lớp form | Đồng bộ header/sheet | Trung |
| B9 | List pages (ca · KPI · aftersale · phiếu thu · parents) | Cùng ListPage + FilterBar density | Trung |
| B10 | Chấm công residual | Impeccable polish token | Thấp |
| B11 | Bảng công tháng | Chỉ khi có nguồn số | Defer |
| Ship | PR #110 | Owner | Defer |

**Song song an toàn:** B5 ∥ B6 (parents vs teaching files).  
**Cấm song song:** đổi domain permission + densify cùng lúc không review.

---

## 6. Điều phối ak / agent

| Bước | Việc | Ai |
|------|------|-----|
| 1 | Catalog URL (file này) | main |
| 2 | Cook B5 parents | cook + impeccable |
| 3 | Cook B6 session | cook + impeccable |
| 4 | Test unit form | vitest admin |
| 5 | Review “chỉ vỏ, không đổi luật” | code-review nhẹ |
| 6 | PR 110 | **owner sau** |

---

## 7. Một câu chốt

**Toàn dự án đã có menu + URL cho hầu hết case; lớp “vỏ form giống Odoo/Console” đã đạt trên ca · KPI · phiếu thu · CRM · aftersale — wave này kéo phụ huynh + buổi học; list/config còn lại đồng bộ dần; PR #110 và bảng công tháng để sau.**
