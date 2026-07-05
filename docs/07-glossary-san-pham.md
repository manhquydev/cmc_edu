# Tài liệu 07 — Glossary Sản phẩm (Ubiquitous Language) — CMC EDU

> Một ngôn ngữ chung, dùng thống nhất trong code, UI, tài liệu và khi giao việc cho AI agent.
> Chống mơ hồ thuật ngữ — đây là "từ điển gốc" mọi tài liệu khác trỏ về.
> Bám enum & model thật trong `packages/db/prisma/schema.prisma`.

---

## 1. Vai trò & tổ chức

| Thuật ngữ | Định nghĩa |
|---|---|
| **Facility (Cơ sở)** | Một chi nhánh CMC EDU. Dữ liệu cô lập theo `facilityId` (RLS). Các cơ sở là *chi nhánh liên kết*, KHÔNG phải silo — định danh HS/PH dùng chung toàn hệ. |
| **Role** | 9 khoá enum: `super_admin`, `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale`, `giao_vien`, `ke_toan`, `cskh`, `ctv_mkt`, `hr`. **v2 active 4 + IT** (GĐKD, GĐĐT, sale, giáo viên, super_admin); 5 còn lại tạm gác (ADR-D). "Quản lý" = `managerId`, KHÔNG phải role. Nguồn duy nhất: **TL14**. |
| **Đội-nhiều-mũ** | Một nhân sự giữ nhiều role cùng lúc (vd sale kiêm thu). Nền tảng phải chịu được (xem SoD, TL3). |
| **Agent principal** | AI agent là một *chủ thể* hạng nhất (`ai_agent_*`) chịu cùng RBAC/RLS/audit như người (TL4). |

## 2. Chương trình & Học tập

| Thuật ngữ | Định nghĩa |
|---|---|
| **Program** | Chương trình học: `UCREA`, `BRIGHT_IG`, `BLACK_HOLE`. |
| **CurriculumUnit** | Đơn vị chương trình (bài/chủ đề). Bảng global, không RLS (QĐ 0021). |
| **Course / ClassBatch** | Khoá học (định nghĩa) / Lớp (một lần mở cụ thể, có mã lớp). |
| **Class code** | Mã lớp đọc được: `Facility-Program-Year-Seq` (QĐ 0036), vd `HN-UCREA-2026-001`. |
| **ScheduleSlot / ClassSession** | Khung lịch định kỳ / một buổi học cụ thể (`SessionStatus`). Session **tự sinh** khi tạo lớp đủ ngày+slot (quyết định 2026-07-05). |
| **Enrollment** | Ghi danh HS vào lớp. `EnrollmentStatus` (enum sẵn có, KHÔNG thêm mới): **`reserved`** = giữ chỗ, chưa kích hoạt bằng phí → **`active`** = đã có phiếu thu duyệt, đang học (được điểm danh/đánh giá). Trạng thái **lái bởi Receipt**, không sửa tay: `active ⇔ có Receipt approved` (ADR-A, TL16). |
| **`reserved` (nghĩa CMC)** | Giữ chỗ trong lớp, **chưa đóng phí**. Lưu ý: khác nghĩa "ghế giữ theo nhóm" trong SIS đại học — ở CMC `reserved` chỉ mang nghĩa chờ-phí. |
| **Attendance** | Điểm danh (`AttendanceStatus`). Bắt buộc có `ClassSession`. |
| **ManualAttendanceTicket** | Phiếu chấm công/điểm danh thủ công theo NGÀY khi ngoài WiFi (QĐ 0034). |
| **Assessment / Grade / Submission / Exercise** | Nhận xét (QualitativeAssessment/SessionStudentComment) · điểm (FinalGrade/GradingTemplate) · bài nộp · bài tập. |
| **Certificate / LevelProgress** | Chứng chỉ (cấp tay — QĐ 0008) · lên cấp độ. **Cả hai đã LOẠI khỏi v2** (TL19 §6d). |

## 3. CRM & Bán hàng

| Thuật ngữ | Định nghĩa |
|---|---|
| **Contact** | Liên hệ (lead thô). Khác Opportunity. |
| **Opportunity (Cơ hội / "opp")** | Cơ hội bán. `OpportunityStage`: O1→O5. O5 = trạng thái business "đã ghi danh", KHÔNG tự tạo Receipt. |
| **O1–O5** | Các giai đoạn phễu: O1 lead → … → O5_ENROLLED. `LostReason` khi mất. |
| **AfterSaleCase** | Ca chăm sóc sau bán (`CaseStatus`, `CasePriority`). |

## 4. Tài chính & Định danh

| Thuật ngữ | Định nghĩa |
|---|---|
| **Receipt (Phiếu thu)** | Phiếu học phí. `ReceiptStatus` (nháp→duyệt). `ReceiptKind`: new/renewal (tính TRƯỚC update stage). |
| **netAmount** | Số tiền-vào đóng băng sau duyệt, KHÔNG mutate (QĐ 0028). |
| **Cổng tiền (money gate)** | `receiptApprove` — v2 do **GĐKD** (ke_toan deferred — ADR-B/D); tách khỏi tạo phiếu (QĐ 0024). |
| **Provisioning** | Sinh tài khoản atomic tại `receiptApprove`: Student + ParentAccount + Enrollment + StudentAccount (QĐ 0033). |
| **createdByReceipt (provenance)** | `Student.createdByReceiptId` — dấu vết student sinh từ phiếu nào (không có UI tạo student mồ côi). |
| **ParentAccount / Guardian** | Tài khoản PH (login = phone `84xxx`, QĐ 0033) / quan hệ giám hộ (`GuardianRelation`). |
| **Voucher / RefundRecord** | Chứng từ / sổ hoàn tiền append-only, cap ≤ netAmount (QĐ 0028). |
| **StudentLifecycle** | Vòng đời HS (active/withdrawn…). Hoàn-tiền-thật giữ HS; void-nhầm → archive+withdraw (QĐ 0024). |

## 5. Nhân sự – Lương – Ca

| Thuật ngữ | Định nghĩa |
|---|---|
| **TimePunch / check-in-out** | Chấm công theo WiFi/IP cơ sở (`FacilityNetwork`). |
| **Payslip** | Phiếu lương (`PayslipStatus`). Phạt trừ **post-tax**; self-healing từ punch live (QĐ 0025). |
| **SalaryRate / CompensationPolicy** | Mức lương / chính sách lương (sửa được qua UI — QĐ 0012). |
| **ShiftRegistration** | Đăng ký ca. Ticket-lock: 1 phiếu Nháp/Chờ duyệt tại 1 thời điểm (QĐ 0035). Duyệt: managerId/HR/giám đốc, chống tự-duyệt (QĐ 0027). |
| **KpiScore** | Điểm KPI auto + override theo cây quyền + audit (QĐ 0011). |

## 6. Nền tảng & Vận hành

| Thuật ngữ | Định nghĩa |
|---|---|
| **RLS** | Row-Level Security theo `facilityId` — cô lập dữ liệu cơ sở. |
| **EmailOutbox** | Bảng outbox: ghi email trong cùng transaction rồi relay (đảm bảo gửi ít nhất một lần). `EmailTransport`: Graph (nội bộ) / Brevo (ngoài) — QĐ 0013, 0030. |
| **RecordEvent / RecordFollower** | Nhật ký hoạt động bản ghi (chatter) / người theo dõi. |
| **Audit** | Nhật ký kiểm toán — nền cho SoD & giám sát agent. |
| **Oversight mode** | Chế độ giám sát một khâu: **auto** (ngoài vòng) / **HITL** (trong vòng, người duyệt) / **HOTL** (trên vòng, người giám sát) — TL4. |

> Quy tắc: khi thêm thuật ngữ mới, thêm vào đây trước; code/UI/agent dùng đúng từ này.
> Liên kết: TL05 (miền) · TL10 (data model) · TL1 (bất biến).
