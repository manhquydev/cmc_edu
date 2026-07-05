# Tài liệu 00 — Kế hoạch Tài liệu, Cổng "Sẵn sàng Build" & Khép kín hệ thống (CMC EDU)

> Đây là **tài liệu gốc (index)** của cả bộ. Nó trả lời 3 câu của bạn: (1) có nên build lại từ
> đầu không; (2) một dự án cần *những* tài liệu gì để build mà không phải hỏi lại; (3) làm sao
> chứng minh hệ thống **khép kín, không phần nào mồ côi**, luồng rõ ràng.
> Bám thực tế repo `manhquydev/CMCnew` tại 2026-07-05.

> ⚠️ **Lưu ý đọc:** TL00 là tài liệu *khởi đầu* — bảng trạng thái §2 và "bước tiếp theo" §6 phản ánh
> thời điểm mới bắt đầu (nhiều mục 🔴/🟡). Phần lớn đã hoàn thành từ đó. **Trạng thái sống hiện tại
> xem TL15 (Sổ đăng ký)**; điều hướng toàn bộ xem `README.md`.

---

## 1. Trả lời thẳng: KHÔNG nên build lại từ đầu (nuke & rewrite)

Cảm giác "viết lại sẽ sạch hơn" là bẫy kinh điển nhất trong kỹ thuật phần mềm — và trong trường
hợp của bạn, bằng chứng ngay trong repo cho thấy **bạn đã làm đúng cách rồi**, chỉ chưa gọi tên nó:

- Bạn **đã thực hiện một cuộc rebuild có cấu trúc** — plan `erp-rebuild-f0-f4` **đã COMPLETE + E2E
  thật 19/19**, 210 integration test. Điểm mấu chốt: nó **giữ nguyên backend** (auth SSO,
  provisioning atomic, outbox — ghi rõ "KHÔNG làm lại") và **chỉ dựng lại bề mặt** (RBAC registry,
  gộp frontend, 6 primitive UI). Đây *chính xác* là chiến lược đúng: giữ phần lõi đã đúng, làm mới
  phần mặt tiền đang rối.

- Nuke & rewrite sẽ **vứt bỏ F0–F4 đã verify** và **tái sinh đúng những blocker bạn đã tốn công
  tìm & fix**: F1 từng phát hiện 2 BLOCKER ("UI new-student unreachable", "concurrency race") + 2
  HIGH (sibling dedupe, facility filter) — viết lại từ đầu = gặp lại chúng từ đầu. Đây là "sai lầm
  chiến lược tệ nhất" mà ngành đã đúc kết: bạn ném đi *hàng trăm quyết định đúng đã đóng băng trong
  code* (bất biến tiền, xử race, RLS) để đổi lấy cảm giác sạch.

- Friction bạn đang thấy **đã được chẩn đoán & CHỐT hôm nay** (brainstorm 2026-07-05, 4 quyết định
  với PO). Đây là **việc thực thi + tài liệu hoá**, không phải lý do để đập đi xây lại.

**Khuyến nghị:** tiếp tục **rebuild tăng tiến trên backend ổn định** (đúng mạch F0–F4). Cái "sạch"
bạn muốn đạt được bằng **chuẩn hoá tài liệu + dọn bề mặt**, không bằng xoá codebase. Bộ tài liệu
dưới đây là thứ khiến con đường tăng tiến này *build được mà không phải hỏi lại* — và cũng là thứ
sẽ cứu bạn nếu sau này thật sự cần viết lại một phần (vì nó mã hoá lại các quyết định).

---

## 2. Một dự án cần những tài liệu gì để build "không phải hỏi lại"

Chuẩn ngành: các tài liệu tạo thành một **DAG** — đầu ra của khâu trước là đầu vào của khâu sau,
không lặp ngược. Ba chuỗi xương sống: **Yêu cầu** (PRD → Thiết kế hệ thống → ADR) · **Hợp đồng**
(API contract → Test plan) · **Học hỏi** (Sự cố → Postmortem → Runbook). Mỗi pha có một *Minimum
Viable Artifact* — tối thiểu để đi tiếp mà không rủi ro.

Đối chiếu với repo (phân biệt **tài liệu sản phẩm** vs **tài liệu harness/dev-tooling** — nhiều
file `HARNESS_*`, `CK_*`, `TRACE_SPEC`, `SESSION_LOOP` là công cụ AI-dev của bạn, KHÔNG phải doc sản phẩm):

| # | Tài liệu (chuẩn) | Vai trò | Trạng thái repo |
|---|---|---|---|
| **Nền — ngôn ngữ chung** ||||
| 0.1 | Vision & Operating Model (đột phá vận hành, ranh giới người-bắt-buộc) | Vì sao & mô hình vận hành | 🟡 rải rác (charter + TL4) → **hợp nhất** |
| 0.2 | Glossary sản phẩm / Ubiquitous Language (O1–O5, receipt, opp, facility, role) | Chống mơ hồ thuật ngữ | 🔴 GLOSSARY.md hiện là harness → **viết bản sản phẩm** |
| **Chuỗi Yêu cầu** ||||
| 1.1 | PRD (ai/cái gì/vì sao + success metric) | Phạm vi sản phẩm | 🟡 có `flow/03-prd.md`, `project-charter.md` → **chuẩn hoá + metric** |
| 1.2 | User Stories + Acceptance Criteria (mỗi workflow) | Đơn vị build kiểm thử được | 🟡 có `docs/stories/` → **phủ đủ workflow** |
| 1.3 | NFR (hiệu năng, bảo mật, sẵn sàng, **dữ liệu trẻ em**) | Ràng buộc chất lượng | 🔴 nằm rải trong decisions → **gom 1 tài liệu** |
| 1.4 | Workflow Spec + State machine (swimlane, tag auto/HITL/HOTL) | Luồng rõ, khép kín | 🟡 TL17 (luồng) + TL4 → **thêm state machine + trạng thái ngoại lệ** |
| 1.5 | RBAC + **ma trận SoD** | Ai làm gì + kiểm soát tiền | 🟡 TL1 + audit → **lập ma trận SoD chính thức** |
| **Chuỗi Thiết kế** ||||
| 2.1 | Kiến trúc **C4** (Context→Container→Component) | Bản đồ hệ thống | 🟡 `ARCHITECTURE.md`+ADR 0001 → **vẽ 3 tầng C4** |
| 2.2 | ADRs | Quyết định + hệ quả | 🟢 38 bản (rất tốt) → **sửa trùng `0032`** |
| 2.3 | Data Model / ERD + Data Dictionary | Cấu trúc dữ liệu | 🟡 Prisma là nguồn → **xuất ERD + từ điển** |
| 2.4 | API Contract (tRPC procedures) | Hợp đồng FE↔BE | 🟡 code là nguồn → **doc hoá procedure + input/output** |
| 2.5 | UX/UI Spec + IA + Design System + Wireframe | Bản vẽ giao diện | 🟡 TL2 + `design-system.md` + IA plan → **wireframe màn lõi** |
| 2.6 | **AI Agent Design** (catalog, tool-scope, oversight) | Tự động hoá + AI | 🟢 TL4 → **đồng bộ về dạng spec (xem §4)** |
| **Chuỗi Hợp đồng** ||||
| 3.1 | Test Plan + coverage target (pyramid) | Bảo chứng chất lượng | 🟡 `TEST_MATRIX` + int-heavy → **bồi unit, đặt target** |
| 3.2 | AI Eval Plan (độ chính xác, tỉ lệ override) | Đo agent | 🔴 → **viết mới khi tới pha AI** |
| **Enablement build** ||||
| 4.1 | **Phased Build Plan** (pha tuần tự, phụ thuộc, acceptance đo được) | Build không kẹt | 🟢 mạch `plans/*` rất mạnh → **áp cho 4 quyết định đã chốt** |
| 4.2 | **Ma trận Truy vết** (khép kín, không mồ côi) | Chứng minh đủ & liền mạch | 🔴 → **viết mới (xem §3)** ⭐ |
| 4.3 | Definition of Ready / Done | Cổng chất lượng | 🟡 `FEATURE_INTAKE` + DoD → **chuẩn hoá cổng (xem §5)** |
| **Chuỗi Vận hành** ||||
| 5.1 | Deploy / Runbook | Lên production | 🟢 có `prod-deploy-security-runbook`, `dev-prod-cicd-runbook` |
| 5.2 | Migration & Seed | Dữ liệu | 🟢 có migrations + seed-curriculum |
| 5.3 | Incident / Postmortem template | Vòng học hỏi | 🔴 → **thêm template** |

> Đọc bảng: 🟢 có & tốt · 🟡 có nhưng cần chuẩn hoá/hợp nhất · 🔴 thiếu. Bạn **không thiếu nhiều
> như bạn nghĩ** — phần lớn là *chuẩn hoá & hợp nhất*, cộng vài artifact khép-kín còn thiếu.

---

## 3. Khép kín & "không phần nào mồ côi" — Ma trận Truy vết ⭐

Đây là artifact trả lời trực tiếp lo lắng lớn nhất của bạn. Nguyên tắc: **mỗi hàng phải đủ mọi cột;
một ô trống = một phần mồ côi**. Bảng nối: Vai trò → Workflow → User Story → API → Màn UI → Test → ADR.

Ví dụ (số liệu thật trong repo):

| Vai trò | Workflow | User Story | API | Màn UI | Test | ADR/QĐ |
|---|---|---|---|---|---|---|
| Sale | Ghi danh → tài khoản | "…ghi danh HS mới, thu phí, ít thao tác" | `finance.receiptApprove` | Ghi danh nhanh | `student-provisioning-approve.int` · `admin-receipt-provision.spec` | 0033 |
| GV | Điểm danh | "…điểm danh lớp hôm nay" | `attendance.mark` | Điểm danh lớp | `attendance.int` | 0034 |
| GV | Nhận xét HS | "…nhận xét từng HS" | `assessment.*` | Nhận xét (agent draft→GV chốt) | *(cần bổ sung)* | — |

**Cách dùng để soi mồ côi:**
- Vai trò không có workflow nào → vai trò thừa/không rõ nhiệm vụ.
- Workflow không có màn UI → tính năng "chạy backend nhưng người dùng không chạm được".
- API không có test → điểm giòn (đúng loại nợ TL3 nêu).
- Màn UI không gắn permission → lỗ hổng phân quyền.
- Story không có acceptance → không build "không hỏi lại" được.

Hàng thứ 3 ở trên tự lộ ra: nhận xét HS **chưa có test + ADR** → đây là "mồ côi" cần đóng trước
khi coi tính năng đánh giá là xong. Đây chính là công cụ để bạn *chứng minh* hệ thống khép kín,
không cảm tính.

---

## 4. Đồng bộ AI với hệ thống (không để AI thành nhánh rời)

AI phải **tham chiếu cùng nguồn sự thật** với hệ thống, nếu không nó trôi khỏi hệ thống:

- Agent hành động qua **đúng tRPC API + permission registry** (TL4 §4) — nên "AI Agent Design"
  (2.6) **trỏ thẳng** vào API Contract (2.4) và RBAC (1.5), không định nghĩa lại.
- Mỗi agent gắn vào **đúng ô trong Ma trận Truy vết** (§3) như một "vai trò" `ai_agent_*`: có
  workflow, có API được phép, có test/eval. → AI không mồ côi, nằm trong cùng bản đồ khép kín.
- Workflow Spec (1.4) là nơi **duy nhất** khai báo khâu nào auto / HITL / HOTL — cả người lẫn agent
  đọc cùng một chỗ. Đổi chế độ = sửa 1 tài liệu, không sửa rải rác.

Kết quả: "đưa AI vào" = *thêm hàng vào cùng ma trận*, không phải dựng hệ song song.

---

## 5. Cổng "Sẵn sàng Build" (Definition of Ready) — để build không phải hỏi lại

Một hạng mục **chỉ được vào build** khi đạt đủ (chuẩn ngành, đã lọc cho dự án bạn):

1. **User & mục tiêu rõ** — vai trò chính không mơ hồ; nêu được "việc con người thật sự cần làm".
2. **Success metric có baseline + target** — ví dụ "thời gian lead→ghi danh giảm từ X còn Y".
3. **Phạm vi v1 tường minh** — không còn câu hỏi mở; ngoại lệ liệt kê.
4. **Acceptance kiểm thử được** — mỗi story có tiêu chí pass/fail.
5. **Kế hoạch rollback cho mọi thứ chạm tiền / luồng lõi** — bắt buộc (đây là ranh giới cứng: đụng
   thanh toán mà không có rollback = **chưa sẵn sàng**).
6. **Đã map đủ hàng Ma trận Truy vết** (§3) — không ô trống.

Đây là "hợp đồng" giúp bạn (hoặc AI coding agent) build tuần tự mà không phải quay lại hỏi — đúng
mục tiêu bạn đặt ra. Thực hành spec-driven: chia việc thành **pha tuần tự, phụ thuộc rõ, đầu ra
kiểm thử được** thì cả người lẫn agent code đều theo được đáng tin cậy; và **luôn có người rà** bản
nháp do AI sinh trước khi chốt.

---

## 6. Bước tiếp theo (đề xuất trình tự)

1. **Chốt hướng** (build tiếp tăng tiến — khuyến nghị §1) & phạm vi v1.
2. Viết **3 artifact khép-kín còn thiếu**: Glossary sản phẩm (0.2), NFR hợp nhất (1.3), Ma trận
   Truy vết (4.2).
3. Chuẩn hoá **Workflow Spec + state machine** (1.4) cho 4 quyết định đã chốt hôm nay (ghi danh 2
   bước, auto sinh session, nút tạo phiếu từ O5, tách tạo-HS khỏi enroll).
4. Áp **cổng DoR** (§5) rồi mới build từng pha.
5. Khi nền vững → mở pha AI theo crawl-walk-run (TL4 §8), gắn vào cùng ma trận.

> Bộ tài liệu liên quan: TL1 (backend/bất biến) · TL2 (UX rebuild) · TL3 (audit/điểm đứt gãy) ·
> TL4 (AI agent) · TL17 (luồng). Tài liệu 00 này là index nối tất cả.
