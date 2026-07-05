# Tài liệu 15 — Rà soát Đồng bộ Tài liệu, Sổ đăng ký & Danh mục còn thiếu

> Kết quả rà soát *tính đồng bộ giữa các tài liệu* (không chỉ nội dung từng cái): điểm đứt gãy,
> mồ côi, chỗ chưa rõ — kèm cách sửa. Cộng sổ đăng ký toàn bộ tài liệu (trạng thái) và danh mục
> còn thiếu theo ưu tiên. Trung thực: một số lỗi nằm trong chính tài liệu mình đã viết.

---

## 1. Điểm đứt gãy / mâu thuẫn tìm thấy (kèm cách sửa)

| # | Vấn đề | Ở đâu | Đúng phải là | Trạng thái |
|---|---|---|---|---|
| **A** | Liệt kê `quan_ly`/`truong_phong` như **role** | TL01/07 | Chỉ 9 role; "quản lý" là `managerId` | ✅ **Đã sửa** (TL14/07/01/11) |
| **B** | Ghi `O4_ENROLLED` trong sơ đồ | TL02, TL17 | `O5_ENROLLED` (O4 = TESTED) | ✅ **Đã sửa** |
| **C** | Dùng `pending_payment` như enum có sẵn | TL07/10/11 | Tái dùng `reserved`, lái bởi Receipt (ADR-A) | ✅ **Đã sửa** |
| **D** | Đánh số lẫn lộn + doc luồng không số | Toàn set | Chuẩn `TL00–TL17`; doc luồng = **TL17** | ✅ Đã đánh số (ref TL1≡TL01) |
| **E** | Doc luồng cũ (role "Học vụ", tạo TK tay) | doc luồng | Provisioning tự động; 4 vai trò | ✅ **Viết lại → TL17** |
| **F** | Nhóm module lệch (TL02/05/06) | TL02/05/06 | IA 5 nhóm gốc (ADR-C) | ✅ **Đã đồng bộ** (TL02; 05/06 trỏ về ADR-C) |

**Không mâu thuẫn (đã kiểm, đồng bộ tốt):** ReceiptStatus (draft→approved→…), OpportunityStage O1–O5
(trừ lỗi B về tên hiển thị), oversightMode (TL9/TL10/TL13), agent-principal (TL4/TL10/TL13/TL14),
bất biến tiền (TL1/TL10/TL11), URL↔query↔API list input (TL6/TL11).

## 2. Mồ côi (orphan) đã đóng / còn mở

- ✅ **Vai trò không có tài liệu gốc** → đã tạo **TL14** (nguồn duy nhất).
- ⚠️ **"liên kết vai trò" mồ côi trong sơ đồ đánh số** + nội dung stale (E) → cần cập nhật/đánh số.
- ⚠️ **Tính năng nhận xét HS**: có trong glossary/data model nhưng ô Test/ADR trống (TL00 §3 đã chỉ)
  → mồ côi tới khi có Workflow Spec + test.
- ⚠️ **`quan_ly`/`head_teacher`** trong plan nhưng không trong enum (TL14 §4) → mồ côi khái niệm,
  cần ADR quyết.

## 3. Chỗ chưa rõ cần bạn quyết (open questions)

1. **EnrollmentStatus 2 bước:** thêm `pending_payment` mới, hay tái dùng `reserved` sẵn có? (ảnh
   hưởng migration + TL07/TL10/TL11).
2. **`quan_ly`/`head_teacher`:** thêm thành role thật hay giữ 9 role + `managerId`+`class.create`?
   (TL14 §4).
3. **IA chuẩn:** chốt danh sách module gốc (6? 8?) để TL2/TL05/TL06 dùng thống nhất.

## 4. Sổ đăng ký tài liệu (Document Register)

| Mã | Tài liệu | Vai trò | Trạng thái |
|---|---|---|---|
| TL00 | Kế hoạch tài liệu, DoR, Ma trận Truy vết | Index/plan | 🟢 |
| TL01 | Bất biến backend & rà soát | Backend charter | 🟢 (sửa mục A) |
| TL02 | Thiết kế lại UX | UX rebuild | 🟢 (sửa B) |
| TL03 | Audit điểm đứt gãy hệ thống | Tech-debt audit | 🟢 |
| TL04 | Chiến lược AI agent | AI strategy | 🟢 |
| TL05 | Capability Baseline (parity) | Scope | 🟢 (sửa B) |
| TL06 | URL & Routing | Frontend arch | 🟢 (chốt IA §3) |
| TL07 | Glossary sản phẩm | Ngôn ngữ chung | 🟢 (sửa A, C) |
| TL08 | NFR + dữ liệu trẻ em | Ràng buộc chất lượng | 🟢 |
| TL09 | Kiến trúc C4 v2 | Architecture | 🟢 |
| TL10 | Data Model v2 | Data | 🟢 (chốt C) |
| TL11 | API Contract | Contract | 🟢 |
| TL12 | Design System & UI | Design | 🟢 |
| TL13 | AI Agent LLM Integration | AI kỹ thuật | 🟢 |
| TL14 | Danh mục Vai trò & Phân quyền | RBAC catalog | 🟢 mới |
| TL15 | Rà soát đồng bộ & register (bản này) | QA/index | 🟢 |
| TL16 | Brief Quyết định Thiết kế (ADR A–D) | Decisions | 🟢 |
| TL17 | Liên kết Vai trò & Luồng (4 vai trò) | Flow | 🟢 (viết lại từ bản stale) |
| TL18 | Tech Stack & Chuẩn kỹ thuật | Technical | 🟢 |
| TL19 | Quy tắc Nghiệp vụ chi tiết (mã, chương trình, bài PDF, cổng thời gian) | Business rules | 🟢 |
| TL20 | Quy tắc Nghiệp vụ vận hành (chấm công, ca, lương, KPI, đổi quà, họp PH, after-sale) | Business rules | 🟢 |
| TL21 | Rà soát Coverage & khoảng trống còn lại | QA/coverage | 🟢 |
| TL22 | ADR hoá 4 rule chỉ-code (0038–0041) | Decisions | 🟢 mới |
| TL23 | Template Workflow Spec + kế hoạch cụm P1 (G2 ready) | Workflow scaffold | 🟢 |
| TL24 | Workflow Spec cụm P1 (9 luồng: WF-P1-01…09) | Workflow spec | 🟢 |
| TL25 | Ma trận Truy vết (G3) — cụm P1 + P2 khép kín | Traceability | 🟢 |
| TL26 | Workflow Spec cụm P2 (8 luồng: WF-P2-01…08) | Workflow spec | 🟢 |
| TL27 | Workflow Spec cụm P3 (HR/Ca/Lương: WF-P3-01…06) | Workflow spec | 🟢 mới |
| TL28 | Workflow Spec cụm P4 (Đổi quà/Họp PH/After-sale: WF-P4-01…05) | Workflow spec | 🟢 mới |
| TL29 | Test Plan (G4) | Test | 🟢 mới |
| TL30 | Threat Model v2 (G5, STRIDE) | Security | 🟢 mới |
| TL31 | Phased Build Plan (G6) | Roadmap | 🟢 mới |

## 5. Tài liệu CÒN THIẾU để triển khai (ưu tiên)

| Ưu tiên | Tài liệu | Vì sao cần |
|---|---|---|
| **P0** | **Workflow Spec P0–P4** (swimlane + **state machine** + ngoại lệ + hàng truy vết) | Tầng chi tiết nhất — dev/agent bám để code không hỏi lại |
| **P0** | **Ma trận Truy vết điền đầy** (Vai trò→WF→Story→API→UI→Test→ADR) | Chứng minh khép kín, không mồ côi |
| **P1** | **Test Plan + coverage target** | Contract→Test; bồi đáy unit hàm tiền |
| **P1** | **Phased Build Plan** (P0→P5 + acceptance) | Trình tự build không kẹt |
| **P1** | **Threat Model v2 (STRIDE)** | Hệ chạm tiền **và** dữ liệu trẻ — cần mô hình mối đe doạ |
| **P2** | **ADR mới cho open questions §3** | Chốt trước khi build cụm liên quan |
| **P2** | Migration & Seed plan v2 (chi tiết) | Chuyển dữ liệu an toàn |
| **P3** | Observability/Runbook v2, Incident/Postmortem template | Vận hành & vòng học hỏi |

## 6. Việc sửa nhanh nên làm ngay (housekeeping)

1. Sửa `O4_ENROLLED` → `O5_ENROLLED` trong các sơ đồ (B).
2. Đổi tên file theo `TL00–TL15`, đánh số doc "liên kết vai trò" (D) + cập nhật nội dung stale (E).
3. Chốt 3 open question (§3) → mình cập nhật TL07/TL10/TL14 cho khớp.
4. Thêm 1 bảng IA gốc (module chuẩn) rồi TL2/TL05/TL06 trỏ về (F).

> Liên kết: TL00 (index) · TL14 (vai trò) · toàn bộ set.
