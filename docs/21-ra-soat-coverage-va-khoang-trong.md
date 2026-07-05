# Tài liệu 21 — Rà soát Coverage (Tài liệu × Codebase) & Khoảng trống còn lại

> Áp lăng kính **code-review** lên toàn bộ bộ tài liệu + codebase: đối chiếu **40 router (miền năng
> lực)** với tài liệu đã có, tìm mảng chưa khai thác. Kết luận: coverage nghiệp vụ ~đủ; khoảng trống
> còn lại là **tầng cấu trúc** (workflow spec, traceability, test, threat model, ADR cho rule-chỉ-code).

---

## 1. Ma trận coverage: 40 router × tài liệu

**✅ Đã làm rõ (có tài liệu):**

| Miền (router) | Tài liệu phủ |
|---|---|
| curriculum · course · class-batch · room* | TL19 §1–2 |
| exercise · submission · grade · assessment | TL19 §3–6 |
| schedule · attendance · session-evidence | TL19 §4–6b · TL17 |
| student · guardian · lms-auth · auth | TL19 §2,6c · TL18 |
| crm · aftersale | TL04/05/17 · TL20 §7 |
| finance · enrollment | TL01/11/16/17 · TL19 |
| check-in-out · facility-ip | TL20 §1 |
| shift-config · shift-registration | TL20 §2 |
| payroll · compensation · user · KPI | TL20 §3–4 |
| rewards · parent-meeting | TL20 §5–6 |
| notification · email · staff-notif | TL20 §8b |
| facility · audit | TL01/08/14/18 |

\* `room` phủ nhẹ (chỉ nhắc trong lớp học) — rule đơn giản (tạo/sửa/archive phòng), rủi ro thấp.

**⚠️ Phủ mỏng — rủi ro thấp (utility, không cần doc riêng lúc này):**

| Miền | Ghi chú |
|---|---|
| `dashboard` | Tổng hợp số liệu — không có rule nghiệp vụ mới; đặc tả khi thiết kế màn |
| `search` | Tìm kiếm — cross-cutting; đặc tả ở UX/API |
| `index` | Router gốc (util), n/a |

**❌ Đã LOẠI khỏi scope v2 (không cần doc):**

| Miền | Quyết định |
|---|---|
| `badge` · `leaderboard` | Loại (TL20 §8) — giữ bảng DB, không build |
| `certificate` · `level-progress` | Loại (TL19 §6d) — cấp chứng chỉ tay / duyệt lên cấp bỏ ở v2 |

→ **Coverage nghiệp vụ: gần như đủ.** Không còn miền nghiệp vụ lớn nào chưa khai thác.

---

## 2. Khoảng trống CÒN LẠI — ở tầng cấu trúc (quan trọng)

Đây mới là phần "chưa khai thác" thật sự để **build không hỏi lại**:

| # | Khoảng trống | Vì sao cần | Ưu tiên |
|---|---|---|---|
| G1 | **ADR cho các rule "chỉ-trong-code"** | Logic tinh vi (mở bài tập theo buổi — TL19 §4; cổng chấm công IP; ca sale-vs-GV `selectionMode`; provisioning atomic) **chưa có ADR** → rewrite dễ làm mất | **P0** |
| G2 | **Workflow Spec P0–P4** (swimlane + **state machine** + ngoại lệ) | Tầng chi tiết nhất dev/agent bám để code từng luồng | **P0** |
| G3 | **Ma trận Truy vết điền đầy** (Vai trò→WF→Story→API→UI→Test→ADR) | Chứng minh khép kín, không mồ côi (TL00 §3) | **P0** |
| G4 | **Test Plan + coverage target** | Contract→Test; bồi đáy unit hàm tiền/lương | P1 |
| G5 | **Threat Model v2 (STRIDE)** | Hệ chạm tiền + dữ liệu trẻ | P1 |
| G6 | **Phased Build Plan** (P0→P5 + acceptance) | Trình tự build | P1 |

## 3. Lăng kính code-review lên codebase (đã có ở TL03 — nhắc lại)

Các phát hiện code-review về *bản thân codebase* đã nằm ở **TL03 (audit điểm đứt gãy)**:
- **Security/correctness:** role-array hardcode phía client (authz drift); provisioning trong
  transaction tiền (race abort); PII plaintext.
- **Durability:** backup chỉ trên VPS; blob không backup.
- **Test:** e2e gãy ESM/CJS; đáy unit mỏng.

→ Với **bản viết lại v2**, đây là danh sách "trả nợ ngay từ thiết kế" (TL05 §0, TL03 §5).

## 4. Đánh giá tổng & khuyến nghị

- **Nghiệp vụ:** sau TL19 + TL20 (+ guardian/notification/session-evidence bổ sung), **không còn
  miền lớn nào chưa khai thác**. Các mảng mỏng (dashboard/search/room) rủi ro thấp, đặc tả khi làm màn.
- **Cấu trúc:** khoảng trống thật nằm ở G1–G6. **Việc đáng làm nhất tiếp theo là G1 (nâng rule
  chỉ-code thành ADR)** — vì bạn viết lại từ đầu, mất các rule tinh vi này là rủi ro lớn nhất; và
  **G2 (Workflow Spec)** sẽ tự kéo theo phần rule còn lại của từng cụm.

**Đề xuất trình tự:** G1 (ADR hoá rule chỉ-code) → G2 (Workflow Spec P1, gom rule cụm) → G3 (traceability)
→ G5 (threat model) → G4/G6.

## 5. Sổ đăng ký cập nhật

Bộ hiện **22 tài liệu (TL00–TL21)**. TL15 (register) là index trạng thái; tài liệu này (TL21) là
rà soát coverage. Nghiệp vụ: TL19 (P1) + TL20 (P2) phủ đủ; descoped: badge/leaderboard/certificate/
level-progress.

> Liên kết: TL15 (register) · TL19/20 (business rules) · TL03 (code audit) · TL00 §3 (traceability).
