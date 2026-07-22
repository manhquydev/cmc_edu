# CMC EDU — Bộ Tài liệu Thiết kế & Xây dựng lại (v2)

> Đây là **điểm vào** của bộ tài liệu (32 file, TL00–TL31) cho bản viết lại ERP/LMS CMC EDU. Mục tiêu:
> đủ để build **không phải hỏi lại**, chứng minh hệ thống **khép kín, không phần nào mồ côi**.
> Nguồn sự thật: repo `manhquydev/CMCnew`. Ngôn ngữ: tiếng Việt. Cập nhật: 2026-07-05.

---

## 1. Đọc theo vai trò (đường vào nhanh)

| Bạn là… | Đọc theo thứ tự |
|---|---|
| **PO / Lead** (nắm toàn cảnh) | TL00 → TL16 (quyết định) → TL31 (lộ trình) → TL15 (trạng thái) |
| **Backend dev** | TL01 (bất biến) → TL10 (data) → TL11 (API) → TL22 (ADR rule) → Workflow cụm liên quan |
| **Frontend dev** | TL02 (UX) → TL06 (URL) → TL12 (design) → TL18 (stack) → Workflow cụm liên quan |
| **AI engineer** | TL04 (chiến lược) → TL13 (LLM integration) → TL08 §7 (dữ liệu trẻ) → TL30 (threat) |
| **QA / Security** | TL25 (traceability) → TL29 (test) → TL30 (threat) → TL01 (bất biến) |
| **Bắt đầu build** | **TL31 (Phased Build Plan) → P0**, dùng TL25 + TL29 làm acceptance |

---

## 2. Bản đồ tài liệu (32 file, theo nhóm)

### Định hướng & Trạng thái
- **TL00** `00-ke-hoach-tai-lieu-va-lo-trinh` — Kế hoạch bộ tài liệu, cổng DoR, khái niệm khép kín *(khởi đầu — trạng thái sống ở TL15)*
- **TL05** `05-capability-baseline-parity-map` — Đích parity ~30 miền năng lực
- **TL15** `15-ra-soat-dong-bo-va-register` — **Sổ đăng ký + trạng thái sống** + audit đồng bộ
- **TL21** `21-ra-soat-coverage-va-khoang-trong` — Rà soát coverage 40 router × tài liệu

### Nền (ngôn ngữ · ràng buộc · kiến trúc · dữ liệu)
- **TL07** `07-glossary-san-pham` — Glossary / ngôn ngữ chung (bám enum thật)
- **TL08** `08-nfr-va-du-lieu-tre-em` — NFR + **ràng buộc dữ liệu trẻ em**
- **TL09** `09-kien-truc-c4-v2` — Kiến trúc C4 (có tầng AI agent + MCP)
- **TL10** `10-data-model-v2` — Data model / ERD + bất biến dữ liệu
- **TL18** `18-tech-stack-va-chuan-ky-thuat` — Tech stack (Vite+React+tRPC+Prisma…) + chuẩn code

### Thiết kế (UX · URL · API · design · AI)
- **TL02** `02-thiet-ke-lai-giao-dien-ux` — Thiết kế lại UX (task-first)
- **TL06** `06-kien-truc-url-routing` — Kiến trúc URL & routing (path-based, deep-link)
- **TL11** `11-api-contract` — API contract (tRPC procedure + lỗi + phân trang)
- **TL12** `12-design-system-ui` — Design system & đặc tả UI
- **TL13** `13-ai-agent-llm-integration` — Tích hợp AI agent (LLM qua API, guardrail, eval)

### Vai trò · Bất biến · Nợ · Chiến lược AI
- **TL01** `01-thiet-ke-he-thong-va-ra-soat-backend` — Bất biến backend (I1–I11) + checklist rà soát
- **TL03** `03-audit-diem-dut-gay-chuan-hoa` — Audit điểm đứt gãy / nợ kỹ thuật
- **TL04** `04-van-hanh-tu-dong-va-ai-agent` — Chiến lược AI agent (auto/HITL/HOTL)
- **TL14** `14-danh-muc-vai-tro-phan-quyen` — **Danh mục vai trò & phân quyền (nguồn duy nhất)**
- **TL17** `17-lien-ket-vai-tro-va-luong` — Liên kết vai trò & luồng (mô hình 4 vai trò)

### Quyết định (ADR)
- **TL16** `16-brief-quyet-dinh-thiet-ke-adr` — **ADR A–D** (enrollment · cổng tiền · IA · phạm vi vai trò)
- **TL22** `22-adr-rule-chi-code-0038-0041` — **ADR 0038–0041** (mở bài tập · chấm công IP · ca sale-vs-GV · provisioning)

### Quy tắc nghiệp vụ chi tiết
- **TL19** `19-quy-tac-nghiep-vu-chi-tiet` — Mã tự sinh · chương trình · **bài PDF (annotation)** · cổng thời gian
- **TL20** `20-quy-tac-nghiep-vu-van-hanh` — Chấm công · ca · lương · KPI · đổi quà · họp PH · after-sale

### Workflow Spec (28 luồng, 4 cụm) + Truy vết
- **TL23** `23-workflow-spec-template-va-p1-plan` — Khuôn Workflow Spec + kế hoạch P1 (+ WF-P1-03 mẫu)
- **TL24** `24-workflow-spec-p1` — Cụm **P1** Định danh & Ghi danh (9 luồng)
- **TL26** `26-workflow-spec-p2` — Cụm **P2** Vận hành lớp (8 luồng)
- **TL27** `27-workflow-spec-p3` — Cụm **P3** HR/Ca/Lương (6 luồng)
- **TL28** `28-workflow-spec-p4` — Cụm **P4** Đổi quà/Họp PH/After-sale (5 luồng)
- **TL25** `25-ma-tran-truy-vet-p1` — **Ma trận Truy vết (đóng hoàn toàn P1–P4)**

### Chất lượng · Bảo mật · Lộ trình
- **TL29** `29-test-plan` — Test Plan (pyramid, coverage target, eval agent, CI)
- **TL30** `30-threat-model-v2` — Threat Model STRIDE (tiền + dữ liệu trẻ + agent)
- **TL31** `31-phased-build-plan` — **Phased Build Plan (P0→P5 + acceptance)**

### Harness (quy trình làm việc — ngoài bộ TL00–TL31)

Do Harness core quản lý, cập nhật qua `scripts/bin/harness update`:

- `WORKFLOW.md` — luồng xử lý yêu cầu chuẩn của Harness (đọc trước khi thực thi)
- `templates/exec-plan.md` — mẫu execution plan
- `plans/` — thư mục Harness-managed. **Không ghi plan vào đây**; plan của dự án
  nằm ở `plans/` ở gốc repo (xem `AGENTS.md`, mục Project Context)

Tài liệu Harness của dự án (không do core quản lý): `HARNESS.md`,
`CONTEXT_RULES.md`, `FEATURE_INTAKE.md`, `TRACE_SPEC.md`, `GLOSSARY.md`.

---

## 3. Quyết định chốt — tra nhanh

| ADR | Nội dung |
|---|---|
| **A** | Enrollment: tái dùng `reserved`→`active`, **lái bởi Receipt** (`active ⇔ phiếu approved`) |
| **B** | Cổng tiền do **GĐKD** (ke_toan deferred); SoD + Reconciliation agent (HOTL) + ngưỡng → GĐĐT |
| **C** | IA = **5 nhóm chức năng**, lọc theo vai trò (≤7 mục) |
| **D** | ERP = **4 vai trò active + IT** (GĐKD·GĐĐT·sale·giáo viên); LMS = phụ huynh/học sinh; 5 role gác |
| **0038** | Mở bài tập theo tiến độ: buổi dạy unit kết thúc (ICT) — Tier A cả lớp / Tier B buổi bù riêng HS |
| **0039** | Chấm công qua khớp **IP dải cơ sở** (CIDR) — ip/manual; không GPS |
| **0040** | Ca **sale vs giáo viên** khác nhau qua `ShiftGroup.selectionMode` (SINGLE/MULTIPLE) |
| **0041** | Provisioning **atomic + idempotent** (tách khỏi transaction tiền); không student mồ côi |

**Loại khỏi v2:** huy hiệu · bảng xếp hạng · chứng chỉ (cấp tay) · duyệt lên cấp. **Giữ:** đổi quà (sao).

---

## 4. Quy ước

- **Đánh số:** `TLxx` (hai chữ số; `TL1` ≡ `TL01`). ADR nội bộ dùng chữ **A–D**; ADR bỏ vào repo dùng
  số tiếp **`0038`+** (`docs/decisions/`).
- **Nguồn sự thật đơn:** vai trò/RBAC → **TL14**; IA → **ADR-C (TL16)**; glossary → **TL07**; trạng
  thái tài liệu → **TL15**. Các doc khác **trỏ về**, không định nghĩa lại.
- **Chuỗi khép kín:** rule (TL19/20) → ADR (TL16/22) → workflow (TL23/24/26/27/28) → traceability
  (TL25) → test/threat/build (TL29/30/31).

---

## 5. Trạng thái & bước tiếp

- **Nghiệp vụ + kiến trúc + workflow P1–P4 + traceability: đóng hoàn toàn.** Chi tiết trạng thái từng
  file: **TL15**.
- **Bắt đầu xây:** theo **TL31 → P0** (nền: monorepo, RBAC registry, RLS, design tokens, backup
  off-box, CI), dùng **TL25** (traceability) + **TL29** (test) làm acceptance.
- **Việc còn để lại cho lúc build:** viết các test-spec thật (ô Test trong TL25), hiện thực từng pha.

> Bộ tài liệu này là "bản đồ port quyết định" cho bản viết lại — đọc ADR/rule/workflow của một mảng
> **trước khi** code mảng đó.
