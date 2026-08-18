---
title: "Brainstorm + advice: độ sâu trang chi tiết và lịch sử nghiệp vụ"
date: 2026-08-17
status: accepted-for-planning
mode: hold-scope
base: "feat/back-before-design@96b1b80"
---

# Brainstorm + advice: độ sâu trang chi tiết và lịch sử nghiệp vụ

## Outcome

CMC EDU có contract record-centric nhất quán:

- first-class business record có URL ổn định, cold-start/F5/share/back được;
- list là index; row click và create-success đi tới work surface;
- detail cho phép xem/sửa dữ liệu nghiệp vụ đã tạo, không chỉ mở popup sửa một phần;
- detail có timeline nghiệp vụ facility-safe;
- hai vai giám đốc thấy và quản lý nhân sự theo contract RBAC;
- workspace, dashboard và config-grid hợp lệ không bị ép thành detail page.

## Scope challenge

- **Đã có:** `DetailPage`, `RecordTimeline`, `@cmc/links`, `/go/:entity/:id`, nhiều detail route đã ship.
- **Thiếu trọng tâm:** Staff/AppUser không có `get`, link, detail route; nav che `/admin/users` khỏi giám đốc dù họ có `user.manage`; AuditLog toàn cục không an toàn để nhúng vào detail.
- **Minimum coherent change:** khóa taxonomy record/workspace/config; làm Staff P0; dùng `RecordEvent` cho timeline; rollout theo module, không đổi tất cả popup.
- **Complexity:** cross-module, DB/API/RBAC/routes/UI/e2e; cần deep plan và rollout tuần tự.
- **Selected mode:** HOLD SCOPE.

## Ba hướng đã so sánh

| Hướng | Ưu điểm | Rủi ro | Verdict |
|---|---|---|---|
| Big-bang generic record framework | Đồng nhất bề ngoài nhanh | type-erasure, confused-deputy auth, ép workspace/config thành record, rollback khó | Loại |
| Staff + timeline foundation, rollout tuần tự | Chữa P0 thật; chuẩn hóa bằng case khó nhất; blast radius kiểm soát | phải khóa actor-target matrix và nghĩa audit trước | **Chọn** |
| Mỗi module tự làm không governance | PR nhỏ | drift URL/get/link/RBAC/timeline; copy-paste security | Loại |

## Quyết định kiến trúc

### Hai ledger, hai mục đích

1. `AuditLog` = security/compliance ledger.
   - Giữ restricted cho `super_admin`.
   - Không nhúng trực tiếp vào detail page của giám đốc.
   - Không coi log best-effort là lịch sử nghiệp vụ hoàn chỉnh.

2. `RecordEvent` = operational per-record timeline.
   - Facility-scoped + RLS + append-only.
   - Mutation emit trong cùng transaction.
   - Payload allowlist theo domain/event kind.
   - Endpoint từng domain phải authorize record cha; không có generic router nhận tùy ý `entity/entityId`.
   - UI chia sẻ `RecordTimeline`, cursor helper và event-display convention.

### Staff làm P0

- Canonical: `/hr/staff`, `/hr/staff/new`, `/hr/staff/:id`.
- `/admin/users` là compatibility redirect/alias, không duy trì hai work surface.
- Director có `user.manage` phải thấy leaf Staff trong HR.
- Row click mở detail; create-success mở record vừa tạo.
- Profile, access và activity là các section/subpath có dữ liệu thật; không tạo tab rỗng.

### Ranh giới dialog

- Dialog tiếp tục dùng cho confirm, short secondary action, inline config edit.
- Detail route dùng cho record có identity, lifecycle, nhiều trường/quan hệ, deep-link hoặc HITL.
- Không chuyển salary tiers, network/geofence, shift config, check-in, attendance, grading, payroll-period hay dashboard chỉ vì chúng đang dùng popup/state.

## Constraints

- Theo `docs/ux-resource-centric-structure.md` và `docs/06-kien-truc-url-routing.md`.
- Một form-depth module series tại một thời điểm.
- API `get`, facility/RLS và row authorization có trước detail UI.
- Nav gate, route gate và API permission cùng contract.
- URL cũ redirect tương thích.
- Không backfill giả timeline từ `AuditLog`.
- Không render raw mutation input hoặc secret/PII vượt quyền record.
- Tận dụng primitive hiện có; không xây global record engine.

## Non-goals

- Port Odoo hash/action/OWL.
- Big-bang rewrite mọi module.
- Thay payroll/domain math.
- Mở `AuditLog` toàn cục cho director bằng thay đổi UI-only.
- Tuyên bố có timeline trước thời điểm bắt đầu emit `RecordEvent`.
- Mặc định quyền quản lý nhân sự bao gồm quyền chiếm tài khoản hay super-admin escalation.

## Acceptance cấp chương trình

- Inventory source-current phân loại mọi routed Admin surface thành `record`, `workspace`, `config-grid`, `dashboard`, `queue`.
- Mỗi record candidate có ledger `list/get/link/detail/create-success/timeline/RBAC/tests`.
- Staff P0 có URL/link/get/full profile edit/access actions/timeline/deep-link tests.
- Actor × target × action matrix phủ director, super admin, ordinary staff, self, peer director, super-admin target và cross-facility.
- Class roster liên kết tới student detail.
- Class/student/receipt tabs addressable bằng URL subpath.
- Course và ParentMeeting được xử lý như record nếu inventory xác nhận.
- Aftersale giữ detail hiện có nhưng create-success điều hướng tới record.
- Gift có quyết định ghi rõ `catalog config` hay `first-class record`; không tạo route để đạt chỉ tiêu.

## Dependency

`plans/260811-1408-record-centric-url-form-depth/` là predecessor cho invariant URL và shift pilot.
Plan mới kế thừa pattern đã ship nhưng **supersede riêng Phase 05 rollout matrix** vì source hiện đã có
KPI, Aftersale, Parent, Reward, Exercise và nhiều detail/link mới.

## Advice verdict

**Proceed to deep plan với hướng risk-first:** contract + inventory → Staff RBAC/API →
Staff route/form/timeline → deep-link/RLS/e2e → rollout matrix theo module.

## Post-red-team source refinement

The source-complete inventory refined two conditional brainstorm candidates:

- Course remains a two-field deferred curriculum catalog; no editable detail/update is added until
  program mutation semantics are separately authorized.
- Gift remains bounded catalog configuration; Reward is the first-class lifecycle record.

This refinement narrows the rollout; it does not change the accepted Staff P0 or dual-ledger
direction.
