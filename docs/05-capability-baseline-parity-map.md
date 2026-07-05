# Tài liệu 05 — Capability Baseline (Bản đồ Parity cho bản viết lại v2)

> Bạn chọn **viết lại từ đầu**. Rủi ro số một của rewrite không phải là code — mà là **đánh mất
> phần đúng đã đóng băng trong v1**. Tài liệu này chốt "đích parity": *mọi thứ v1 làm được mà v2
> KHÔNG được để mất*. Không có bản đồ này, rewrite sẽ bỏ sót mảng và tái sinh bug cũ.
> Trích từ code repo `manhquydev/CMCnew` (40 router · 37 panel · ~38 module nav) tại 2026-07-05.

---

## 0. Ba nguyên tắc để rewrite không thất bại (đọc trước)

1. **Port QUYẾT ĐỊNH, không port CODE.** Tài sản thật của v1 là 38 ADR + `DEBT.md` — chúng ghi
   *tại sao* (bất biến tiền, xử race, RLS). v2 phải **tái mã hoá các quyết định này thành spec**;
   nếu không, v2 sẽ gặp lại đúng 2 BLOCKER F1 đã fix (new-student unreachable, concurrency race).
   → Xem danh sách carry-forward ở §3.
2. **Phân pha, không big-bang.** 40 miền không rewrite cùng lúc. Ship parity **theo cụm**, mỗi cụm
   có acceptance đo được (đúng mạch F0–F4 bạn đã làm). → Xem đề xuất pha ở §4.
3. **AI-native = kiến trúc sẵn cho agent từ đầu, nhưng bật tự chủ dần.** Ngay v2 nên có: agent là
   principal (`ai_agent_*`), MCP tool layer bọc API, cột trạng thái oversight (auto/HITL/HOTL) trong
   schema. Nhưng **quyền tự chủ mở theo crawl-walk-run** (TL4 §8) — agent không tự hành động trên
   tiền/dữ liệu trẻ trước khi lõi tất định + guardrail có đủ.

---

## 1. Bản đồ miền năng lực (đích parity)

Nhóm theo khu vực nghiệp vụ. Cột "Điểm cắm AI" = nơi agent sẽ tham gia (TL4).

### A. Học tập & Giảng dạy (Academic)
| Miền (router) | Làm gì | Điểm cắm AI |
|---|---|---|
| `curriculum` · `course` · `class-batch` · `room` | Chương trình, khoá, lớp, phòng | Ops agent: auto sinh session khi tạo lớp |
| `schedule` | Lịch dạy, buổi học, buổi bù, chống trùng phòng/GV | Ops agent: xếp lịch, phát hiện xung đột |
| `enrollment` | Ghi danh: `reserved` (giữ chỗ, chưa phí) → `active` khi phiếu duyệt — lái bởi Receipt (ADR-A) | — (HITL tại duyệt phí) |
| `attendance` · `session-evidence` | Điểm danh, ảnh lớp/bằng chứng buổi học | **Người-bắt-buộc** (GV) |
| `assessment` · `grade` · `submission` · `exercise` | Nhận xét, chấm điểm, bài tập, nộp bài | Teacher-assist: draft nhận xét → GV chốt |
| `level-progress` · `certificate` | Lên cấp độ, chứng chỉ (cấp tay — QĐ 0008) | — |

### B. CRM & Kinh doanh
| Miền | Làm gì | Điểm cắm AI |
|---|---|---|
| `crm` | Contact/Opportunity O1–O5, kanban | Admissions agent: thu lead, làm giàu, tạo O1 |
| `aftersale` | Chăm sóc sau bán | Communication agent |

### C. Tài chính & Nhân sự-Lương
| Miền | Làm gì | Điểm cắm AI |
|---|---|---|
| `finance` | Phiếu thu (link CRM), duyệt (cổng tiền), hoàn tiền | **Reconciliation agent (HOTL)** = compensating control SoD |
| `compensation` · `payroll` | Cơ cấu lương, phiếu lương, phạt post-tax | HOTL: phát hiện payslip lệch |
| `check-in-out` | Chấm công theo WiFi/IP + phiếu thủ công (QĐ 0034) | Auto: tính giờ/phạt |
| `shift-config` · `shift-registration` | Danh mục ca, đăng ký & duyệt ca (QĐ 0035) | Auto: nhắc duyệt |

### D. Định danh & Con người
| Miền | Làm gì | Điểm cắm AI |
|---|---|---|
| `user` · `facility` · `facility-ip` | Nhân sự, cơ sở, IP chấm công | — |
| `student` · `guardian` | Hồ sơ HS, người giám hộ (sinh atomic tại duyệt phí) | — |
| `auth` · `lms-auth` | SSO staff · OTP/phone phụ huynh | — |

### E. Tương tác & Gắn kết
| Miền | Làm gì | Điểm cắm AI |
|---|---|---|
| `email` · `notification` · `staff-notif` | Email (Graph/Brevo outbox), thông báo | Communication agent |
| `parent-meeting` | Họp phụ huynh | Auto: nhắc/đặt lịch |
| `badge` · `leaderboard` · `rewards` | Đổi quà (sao) ✅ giữ · **Huy hiệu/bảng xếp hạng ❌ loại v2** (TL20 §8) | Auto |

### F. Nền tảng
| Miền | Làm gì |
|---|---|
| `audit` | Nhật ký kiểm toán (nền cho SoD + agent oversight) |
| `dashboard` · `search` | Tổng quan, tìm kiếm |

> **Tổng: ~30 miền sản phẩm** (đã lọc bỏ router hạ tầng). Đây là toàn bộ "vô vàn mảng" bạn nhắc —
> nay đã bounded và đếm được.

---

## 2. ⚠️ Tách SẢN PHẨM khỏi HARNESS — đừng port nhầm

Nhiều thứ trong repo là **harness phát triển bằng AI** của bạn, KHÔNG phải hệ vận hành CMC EDU:
- ADR `0001–0009, 0017, 0018` (Harness-First, Seed Spec, ClaudeKit, SQLite durable…) → **harness**.
- File `HARNESS_*`, `CK_*`, `SESSION_LOOP`, `TRACE_SPEC`, `TOOL_REGISTRY`, `IMPROVEMENT_PROTOCOL`,
  `GLOSSARY.md` (bản hiện tại) → **harness**.

→ v2 chỉ mang **ADR sản phẩm** (mục §3). Đừng để harness lẫn vào scope hệ vận hành.

---

## 3. Quyết định phải MANG SANG v2 (carry-forward spec)

Đây là "linh hồn" v1 — v2 phải tái hiện các bất biến này (chi tiết ở TL1):

| QĐ | Bất biến mang sang |
|---|---|
| 0033 | Student sinh atomic tại `receiptApprove`; không có UI tạo student mồ côi; login PH = phone 84xxx |
| 0024 | Cổng tiền tách tạo/duyệt; auto-O5 + closedAt; kind tính trước update stage |
| 0037 | CRM↔Finance: phone lookup + cảnh báo trùng (soft); `opportunityLookup` tách `opportunityList` |
| 0028 | Refund append-only, cap `FOR UPDATE`; netAmount đóng băng |
| 0025 · 0034 | Phạt post-tax; override field riêng; payslip self-healing; phiếu công thủ công theo ngày |
| 0027 · 0020 · 0035 | Duyệt ca: chống tự-duyệt; managerId validate; ticket-lock 1 phiếu |
| 0011 | KPI auto + override theo cây quyền + audit |
| 0031 · 0013 · 0030 | SSO + password break-glass; email Graph nội bộ / Brevo ngoài |
| 0036 | Class code = Facility-Program-Year-Seq |
| DEBT | Mọi khoản nợ đang mở (backup off-box, mã hoá PII, role-array…) — **cơ hội trả luôn khi rewrite** |

**Lợi thế rewrite:** đây là lúc trả sạch các nợ TL3 (backup off-box, bỏ role-array hardcode, tách
provisioning khỏi tx tiền, mã hoá PII) *ngay từ thiết kế* thay vì vá sau.

---

## 4. Đề xuất pha rewrite (parity theo cụm, không big-bang)

Mỗi pha ship parity một cụm + acceptance đo được. Thứ tự theo phụ thuộc dữ liệu:

- **P0 — Nền:** auth/SSO · RBAC registry + **agent-as-principal** · audit · facility · MCP tool layer
  skeleton · design system + primitive UI. (AI-native móng đặt ở đây.)
- **P1 — Định danh & Ghi danh:** student/guardian · CRM O1–O5 · finance (phiếu thu + cổng tiền +
  provisioning atomic tách idempotent) · enrollment 2 bước. → *Admissions + Reconciliation agent (draft/HOTL).*
- **P2 — Vận hành lớp:** class-batch/course/curriculum/room · schedule (auto session) · attendance ·
  session-evidence. → *Ops agent; Teacher-assist draft.*
- **P3 — Đánh giá & Gắn kết:** assessment/grade/submission/exercise · certificate/level-progress ·
  badge/leaderboard/rewards · parent-meeting · notification/email.
- **P4 — Chấm công & Lương:** check-in-out · shift-config/registration · payroll/compensation · KPI.
  → *HOTL giám sát lệch.*
- **P5 — Mở tự chủ AI:** nâng agent từ draft/HOTL lên auto theo ngưỡng, theo số liệu eval.

Mỗi pha đi qua **cổng DoR** (TL00 §5) và điền đủ **Ma trận Truy vết** (TL00 §3) trước khi coi là xong.

---

## 5. Bước tiếp theo mình đề xuất làm cùng bạn

Với hướng rewrite + full scope + AI-native, trình tự tài liệu nên là:
1. **Chuẩn hoá foundation dùng chung mọi miền:** Glossary sản phẩm · NFR hợp nhất (kèm ràng buộc dữ
   liệu trẻ em) · Kiến trúc C4 v2 (có agent + MCP layer) · Data model v2.
2. **Workflow Spec + state machine cho từng cụm P1→P4** (swimlane + tag auto/HITL/HOTL + ngoại lệ).
3. **Ma trận Truy vết** dựng dần theo mỗi cụm — đảm bảo không mồ côi.
4. **Phased Build Plan** chi tiết hoá §4 thành acceptance từng pha.

> Mình đề nghị bắt đầu từ **P0 + P1** (nền + ghi danh) vì đó là nơi bạn đang đau nhất và mọi mảng
> khác phụ thuộc vào định danh/ghi danh. Bạn muốn mình viết trước **cụm nào** trong số này?

> Liên kết: TL00 (index/plan) · TL1 (bất biến) · TL2 (UX) · TL3 (audit) · TL4 (AI agent) · TL17 (luồng).
