# Tài liệu 10 — Data Model v2 (ERD + Bất biến dữ liệu)

> Xương sống dữ liệu — mọi tính năng bám vào. Rút từ 60+ model thật trong `schema.prisma`, tổ chức
> lại theo cụm, ghi rõ **bất biến** phải giữ và **thay đổi v2**. Đây là nguồn cho ERD & data dictionary.

---

## 1. ERD lõi — cụm Định danh, CRM, Tài chính, Học tập

```mermaid
erDiagram
    Facility ||--o{ AppUser : "có nhân sự"
    Facility ||--o{ Student : "quản lý"
    Facility ||--o{ ClassBatch : "mở lớp"

    Contact ||--o{ Opportunity : "sinh cơ hội"
    Opportunity ||--o| Receipt : "gợi ý tạo (không tự tạo)"

    Receipt ||--o{ RefundRecord : "hoàn (append-only)"
    Receipt ||--o| Student : "provenance (createdByReceipt)"

    Student ||--o{ Enrollment : "ghi danh"
    Student ||--o{ Guardian : "có giám hộ"
    ParentAccount ||--o{ Guardian : "là PH của"
    ParentAccount ||--o{ StudentAccount : "quản lý con"

    ClassBatch ||--o{ Enrollment : "nhận HS"
    ClassBatch ||--o{ ClassSession : "sinh buổi"
    ClassSession ||--o{ Attendance : "điểm danh"
    Enrollment ||--o{ Attendance : "theo dõi"

    AppUser ||--o{ Payslip : "nhận lương"
    AppUser ||--o{ TimePunch : "chấm công"
    AppUser ||--o{ ShiftRegistration : "đăng ký ca"
```

## 2. Từ điển thực thể (Data dictionary — cụm chính)

### Định danh
| Model | Vai trò | Khoá/Quan hệ then chốt |
|---|---|---|
| `Facility` · `FacilityNetwork` | Cơ sở · dải IP/WiFi chấm công | gốc RLS |
| `AppUser` · `EmploymentProfile` · `UserFacility` | Nhân sự · hồ sơ · gán cơ sở | `managerId` (duyệt ca) |
| `Student` | Hồ sơ HS | `facilityId`, **`createdByReceiptId`** (provenance) |
| `ParentAccount` · `StudentAccount` · `Guardian` | Login PH (email+OTP) · tài khoản con (phone+password) · quan hệ giám hộ | `phone` unique; `email` required (PH login); `GuardianRelation`; `LmsSubject.kind` |

> **product-decision 2026-07-07**: Mô hình định danh LMS thay đổi theo 2-tier. Trước đây: `ParentAccount` login bằng SĐT+OTP; không có cơ chế password riêng cho con. Hiện tại: (a) **Phụ huynh** đăng nhập bằng `email` + OTP qua email (`kind='parent'`); `ParentAccount.email` là trường bắt buộc cho luồng auth. (b) **Học sinh** đăng nhập bằng SĐT phụ huynh (`84xxx`) + mật khẩu (`kind='student'`); mật khẩu mặc định `Cmc2026@` không được ghi vào docs/code dưới dạng plain-text — chỉ lưu dạng `passwordHash` (PBKDF2-SHA256). `LmsSubject` có discriminator `kind: 'parent' | 'student'` để tách session. Tham chiếu: UI implementation plan phase 01a/01b. **BLOCKED-ON-COMMS**: email OTP chưa giao được ra ngoài (ConsoleEmailTransport stub) cho đến khi cung cấp Brevo/Graph credentials — xem TL18.

> **product-decision 2026-07-07**: Không có `studentCode`. HS được định danh bằng `fullName + SĐT phụ huynh`. Mã dạng `HS-0182` trong wireframe chỉ là tham chiếu hình ảnh, không ánh xạ sang cột dữ liệu thực. `StudentAccount` KHÔNG có `studentCode`.

### CRM & Tài chính
| Model | Vai trò | Ghi chú |
|---|---|---|
| `Contact` · `Opportunity` · `OpportunityAssignment` | Lead · cơ hội O1–O5 · phân công | `OpportunityStage`, `LostReason` |
| `Receipt` · `ReceiptCodeCounter` | Phiếu thu · bộ đếm mã | `ReceiptStatus`, `ReceiptKind`, `netAmount` (đóng băng) |
| `RefundRecord` · `Voucher` | Hoàn tiền append-only · chứng từ | cap ≤ netAmount |
| `AfterSaleCase` · `CallMetric` | Ca sau bán · số liệu gọi (Callio) | KPI sale |

### Học tập
| Model | Vai trò |
|---|---|
| `Course` · `CoursePrice` · `CurriculumUnit` · `AcademicTerm` | Khoá · giá · đơn vị CT · học kỳ |
| `ClassBatch` · `ScheduleSlot` · `ClassSession` · `Room` | Lớp · khung lịch · buổi học · phòng |
| `Enrollment` | Ghi danh — **`EnrollmentStatus` 2 bước** (xem §3) |
| `Attendance` · `ManualAttendanceTicket` · `SessionEvidence` · `SessionEvidencePhoto` | Điểm danh · phiếu thủ công · bằng chứng buổi · ảnh lớp |
| `QualitativeAssessment` · `SessionStudentComment` · `Grade` · `FinalGrade` · `GradingTemplate` | Nhận xét · điểm |
| `Exercise` · `Submission` · `Certificate` · `LevelProgress` | Bài tập · nộp · chứng chỉ · lên cấp |

### Nhân sự – Lương – Ca – Gắn kết
| Model | Vai trò |
|---|---|
| `Payslip` · `SalaryRate` · `SalaryTier` · `CompensationPolicy` · `KpiScore` · `TimePunch` | Lương · gán bậc · catalog bậc lương · chính sách phạt · KPI · chấm công |
| `ShiftTemplate` · `ShiftGroup` · `ShiftRegistration` · `ShiftRegistrationEntry` | Ca · nhóm ca · đăng ký · dòng đăng ký |
| `Badge` · `StudentBadge` · `Reward` · `Gift` · `StarTransaction` · `Notification` · `EmailOutbox` · `ParentMeeting` | Huy hiệu · quà · sao · thông báo · outbox · họp PH |
| `RecordEvent` · `RecordFollower` · `Audit`(log) | Chatter · follower · kiểm toán |

## 3. Thay đổi v2 (khác v1 — chốt theo quyết định gần đây)

| # | Thay đổi | Nguồn |
|---|---|---|
| V1 | Ghi danh 2 bước dùng enum **sẵn có**: `reserved` (chưa phí) → `active` khi phiếu duyệt; **lái bởi Receipt** (`active ⇔ Receipt approved`), KHÔNG thêm `pending_payment` | ADR-A (TL16) |
| V2 | Session **tự sinh** trong transaction tạo `ClassBatch` (nút thủ công = re-generate) | quyết định 2026-07-05 |
| V3 | Bỏ đường tạo `Student` thủ công khỏi UI ghi danh (break-glass tách trang quản trị riêng) | quyết định 2026-07-05 |
| V4 | **Provisioning tách khỏi transaction tiền** (bước idempotent theo `phone`) | TL3 §A |
| V5 | Thêm `oversightMode` + trường cờ escalate trên các thực thể agent chạm (receipt, opportunity) | TL4 |
| V6 | Mã hoá cột PII (`nationalId`, `bankAccount`) | trả nợ QĐ 0026 |
| V7 | `AI Agent` như principal: bảng `AgentPrincipal` + role `ai_agent_*` + audit actor | TL4 §4 |
| V8 | **Mô hình lương bậc greenfield**: `SalaryTier` (catalog `baseSalary`/`unitRate`/`requiredShifts`/`requiredMetric` theo `type` KINH_DOANH\|GIAO_VIEN, `@@unique([facilityId,name])`) + `SalaryRate.tierId` (FK, gán qua `compensation.assignTier`). 3 cột cũ trên `SalaryRate` (`baseSalary`, `variablePayRate`, `kpiMax`) **nullable-deprecated** — không writer mới ghi, giữ lại chỉ để đọc dữ liệu cũ. `CompensationPolicy` (per-facility `penaltyRatePerLateMinute`/`penaltyRatePerEarlyMinute`, fallback 500/1000đ khi chưa có row) | docs/20, docs/22 ADR 0042 |
| V9 | `KpiScore` mở rộng cho công thức auto-score: `metricValue`/`quotaSnapshot`/`shiftActual`/`shiftRequired`/`unitRateSnapshot`/`tierIdSnapshot` (snapshot tại thời điểm `kpi.refresh` — không đổi khi tier đổi sau đó); `kpiMax` cũ chuyển **nullable, retired**. `Payslip.kpiBonus` tái dụng làm "Phần KPI" (= `KpiScore.value` khi status confirmed\|approved); `Payslip.variablePay` **deprecated, luôn 0** (`assembleSlip`, @cmc/domain-payroll) | docs/20, docs/22 ADR 0042 |
| V10 | `ShiftGroup`/`ShiftTemplate` có `@@unique` natural key (`[facilityId,name]` / `[shiftGroupId,name]`) cho idempotent catalog seed. `ShiftRegistration` thêm status `rejected` + cột `rejectReason` (bắt buộc khi `shift.reject`) — `rejected` KHÔNG tính vào ticket-lock (unique partial index `WHERE status='submitted'`) lẫn overlap-range guard, cho phép nộp lại ngay | docs/20 |
| V11 | `Receipt.approvedAt` (timestamp riêng, ghi bởi `finance.receiptApprove`) — nguồn duy nhất `kpi.refresh`'s `collectSaleRevenue` dùng để bucket doanh thu vào đúng kỳ ICT, tách khỏi `updatedAt`. `ClassSession`/`SessionStatus` thêm `done` + `doneAt` (đóng băng tại thời điểm session-done engine đánh giá) + `makeupForSessionId` (buổi bù trỏ về buổi gốc) | docs/20, docs/22 ADR 0042 |
| V12 | **Chấm công cặp vào/ra mỗi ngày**: `TimePunch.withinNetwork Boolean @default(true)` (thêm cạnh `ip`/`method` cũ — cột quyết định logic mới, cơ sở chưa khai báo `FacilityNetwork` nào mặc định `true`). `ManualAttendanceTicket.checkInAt`/`checkOutAt DateTime?` (mốc đầu/cuối ngày, đóng băng khi phiếu rời `pending`/`resubmitted`) + `@@unique([appUserId, ticketDate])` (chặn 2 phiếu cùng ngày — nền tảng cho `manualPunch.resubmit` ghi đè dòng cũ thay vì tạo dòng mới). Xoá hẳn đường tạo phiếu thủ công nhập ngày tùy ý (`manualPunch.create`) | docs/decisions/0043-attendance-daily-inout-pairing.md |

## 4. Bất biến dữ liệu phải giữ (từ TL1)

- `Student.createdByReceiptId` bắt buộc có khi student sinh qua provisioning — **không student mồ côi**.
- `Receipt.netAmount` bất biến sau duyệt; `SUM(RefundRecord.amount) ≤ netAmount` (khoá `FOR UPDATE`).
- `ParentAccount.phone` unique toàn hệ (find-or-create; xử `unique_violation` bằng SAVEPOINT/ON CONFLICT).
- `StudentAccount` chứa: `passwordHash` (PBKDF2-SHA256, không plain-text), `mustChangePassword` (true khi dùng default), `loginAttempts`, `loginLockedUntil`. Các trường này **KHÔNG** nằm trên `ParentAccount`.
- `ParentAccount.email` bắt buộc khi tài khoản dùng cho auth email+OTP.
- `Opportunity.stage=O5` ⇔ có phiếu đã duyệt auto-advance; cancel ⇒ revert O4 + clear `closedAt`.
- Mọi bảng nghiệp vụ có `facilityId` (RLS); bảng curriculum/exercise global (không RLS — QĐ 0021/0022).
- Sổ tiền append-only: sửa = thêm dòng.
- `KpiScore`/`Payslip`/`CompensationPolicy`/`SalaryTier`/`ManualAttendanceTicket`/`TimePunch` append-like: `cmc_app` không có quyền DELETE (chỉ SELECT/INSERT/UPDATE) — sửa = tạo bản ghi mới hoặc UPDATE tại chỗ, không xoá.
- `payslip.assemble` từ chối chạy khi `AppUser` chưa có `SalaryRate.tierId` (FORBIDDEN, không fallback legacy — greenfield). GĐ/super_admin không có `KpiScore`/`Payslip` (lương ngoài hệ thống, docs/20).

## 5. Quy ước & migration

- **Kiểu khoá:** uuid cho định danh; mã đọc được (class/receipt/employee code) qua `*CodeCounter`.
- **Thời gian:** lưu UTC, bucket/hiển thị theo ICT (UTC+7) — nhất là biên tháng lương (QĐ 0025).
- **Migration v1→v2:** backfill `EnrollmentStatus=active` cho enrollment cũ (không phá điểm danh
  đang chạy); backfill `createdByReceiptId` nếu import; đặt default `oversightMode` cho bản ghi cũ.
- **Seed:** curriculum UCREA/Bright I.G. theo `seed-curriculum` đã có.

> Liên kết: TL07 (glossary) · TL09 (C4) · TL1 (bất biến) · TL05 (miền) · TL6 (routing map theo model).
