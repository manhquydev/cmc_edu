# Bản đồ luồng nghiệp vụ — Cụm P4 + Quản trị (Admin)

> Explore agent · 2026-08-17 · Nguồn chuẩn: docs/28 (WF-P4-01…05), docs/25 §2 (hàng P4), docs/14 (RBAC), docs/17 (vai trò).
> Xác minh code: apps/api/src/{rewards,meeting,after-sale,appointment,user,facility,audit,kpi,shift,student} · apps/admin/src/pages/{engagement,admin,crm} · apps/lms/src/pages/{student,parent} · apps/e2e/tests/{journeys,live}.
> Số nghiệm thu: acceptance-report/business-verification.json (sinh 2026-08-13, ledger 6af0f5f) — 43 luồng: 17 verified-correct · 20 reachable-only · 6 not-proven.

---

## 1. Cụm P4 — Gắn kết & sau bán (5 luồng)

| WF | Tên | Module | Vai trò | UI path (admin · lms) | API (tRPC) | Test hiện có (journey / live / API) | Ghi chú |
|---|---|---|---|---|---|---|---|
| **P4-01** | Đổi quà bằng sao (Reward) | engagement/rewards | **học viên** (đổi — LMS) · **sale/GĐKD/GĐĐT** (rewards.manage: duyệt/giao/từ chối) · super_admin (bypass) | `/admin/engagement/rewards` + `/:rewardId` (form-depth HITL) · LMS `/student/gifts` | `rewards.redeem` (lmsProcedure, requireLmsStudent) · `approve/deliver/reject/get/list` (rewards.manage) · `listForStudent` (LMS) | **Journey:** rewards-redeem-approval (sale approve+deliver), lms-stars-redeem-cycle (xuyên app: GV chấm→sao→HS đổi LMS→GĐ duyệt+giao; **invariant: số dư sau đổi = 5−3 = 2**) · **Live:** 09-ops-rewards (chỉ tạo quà + queue render — chuỗi redeem→deliver không chạy live vì student-gated) · **API:** redeem-refund.test.ts (17 tests: thiếu sao, stock=0, stock=-1, race 1-đơn-vị, đổi hộ người khác FORBIDDEN, hoàn sao exactly-once, hoàn theo giá LÚC ĐỔI không theo giá hiện tại, reject bản delivered BAD_REQUEST, race reject, deliver trừ stock, stock=-1 giữ nguyên, stock=1 deliver 2 lần không âm) | State machine: pending→approved→delivered / pending→rejected (hoàn sao `gift_rejected_refund`). Khoá advisory theo giftId + SELECT FOR UPDATE |
| **P4-02** | Cấu hình danh mục quà (Gift) | engagement/gifts | **GĐKD/GĐĐT** (gift.upsert) · **sale KHÔNG** (registry) · gift.list thêm sale · super_admin | `/admin/engagement/gifts` (trang riêng, không tab) · LMS `/student/gifts` (listForStudent) | `gift.upsert` (gift.upsert) · `gift.list` (gift.list) · `gift.listForStudent` (LMS) | **Journey:** gift-config-nav (tạo quà starsRequired=7 → **invariant: lưu đúng 7**; **sale không thấy entry Quà tặng**) · **Live:** 09-ops-rewards bước 1 · **API:** redeem-refund.test.ts (tạo, archive isActive=false, sale FORBIDDEN) | KHÔNG có minLevel (doc-drift đã bỏ, QĐ 2026-07-11). Archive = upsert isActive:false (không xoá cứng). Stock giảm khi deliver, -1 = vô hạn |
| **P4-03** | Họp phụ huynh (ParentMeeting) | crm/post-sale-meeting | **sale/GĐKD/GĐĐT** (parentMeeting.manage) · **phụ huynh** (thụ hưởng; chưa có nhắc) · super_admin | `/crm/post-sale-meeting` — **UI đã wire API (docs/28 ghi EmptyState stub là LỖI THỜI)** · LMS: KHÔNG có view họp cho PH | `parentMeeting.list/schedule/complete/cancel` | **Journey:** parent-meeting-schedule-complete (đặt→hoàn thành→đặt→hủy) · **Live:** 10-ops-meeting (y hệt trên VPS, skip nếu 02 chưa provision) · **API:** parent-meeting.test.ts (11: facility scope, role FORBIDDEN, complete không result BAD_REQUEST, complete bản cancelled BAD_REQUEST, cancel bản done BAD_REQUEST, sale OK, HS withdrawn chặn, blocked_lms cho phép, **double-book = warning mềm vẫn tạo**) | State: scheduled→done|cancelled. `complete` bắt buộc result (min 1). **Nhắc PH qua outbox/Communication agent CHƯA implement** (cột remindedAt đã drop) |
| **P4-04** | Lịch test (TestAppointment) | crm (entrance) · teaching (periodic — **không có UI**) | **sale/GĐKD/GĐĐT** (testAppointment.manage) · giao_vien (định kỳ — spec, chưa có UI) · super_admin | `/crm/opportunities/:id` (ScheduleTestDialog + danh sách appointment) · periodic: **không có screen nào** | `testAppointment.forOpportunity/schedule/complete/noShow` | **Journey:** entrance-test-appointment (O1→O2, đặt 2 lịch, no_show, complete → O4; nút Đặt lịch test biến mất khi hết stage) · **Live: KHÔNG có** · **API:** appointment-lifecycle.test.ts (17: schedule O2→O3, complete O3→O4, đặt lần 2 no-op, complete khi opp quá O3/lost vẫn thành công (lenient), no_show KHÔNG đổi stage, chặn O1/O4/LOST, zod arm, periodic withdrawn chặn, **race terminal state tuần tự**, RLS cross-facility) | State: scheduled→done|no_show. Entrance lái CRM stage (O2→O3→O4) qua advance-one-step + audit stage-change. Journey ghi nhận **product defect stale-view** (opportunityGet không invalidate — phải reload) |
| **P4-05** | After-sale case | crm/aftersale | **sale/GĐKD/GĐĐT** (afterSale.manage) · **GĐKD/GĐĐT** (student.setLifecycle — QĐ 0027, **sale KHÔNG**) · super_admin | `/crm/aftersale` + `/:caseId` (form-depth) — UI đã wire (docs/28 ghi stub là LỖI THỜI) | `afterSale.get/list/create/advance/resolve/close` · `student.setLifecycle` | **Journey:** aftersale-case-lifecycle (tạo→tiếp nhận→giải quyết→đóng) · **Live:** 11-ops-aftersale · **API:** after-sale.test.ts (11: list/get, full lifecycle, advance idempotent, resolve không resolution BAD_REQUEST, close chưa resolved BAD_REQUEST, advance bản resolved BAD_REQUEST, hr FORBIDDEN, createdById) | State: open→in_progress→resolved→closed (advance idempotent; close = terminal, không DELETE). **high priority đẩy lên đầu hàng đợi CHƯA implement** — list chỉ orderBy createdAt desc, priority chỉ lưu. **setLifecycle KHÔNG có test API + KHÔNG có journey** |

---

## 2. Quản trị & Vận hành (Admin)

| Mã | Tên | Module | Vai trò | UI path | API (tRPC) | Test hiện có | Ghi chú |
|---|---|---|---|---|---|---|---|
| **ADM-01** | Quản trị cơ sở (Facility) | admin/facilities | **super_admin DUY NHẤT** (facility.create/list/manage = mảng rỗng + bypass) | `/admin/facilities` | `facility.create/update/list` | **Journey:** facility-admin-crud (tạo + sửa tên; **không có delete** — dọn DB trực tiếp) · **API:** facility.test.ts (14: persist, GĐKD FORBIDDEN, bootstrap facility đầu tiên, pagination, search, trùng code friendly, code bất biến, sửa tên audited, sửa rỗng reject, non-SA FORBIDDEN) · Live: — | **KHÔNG có procedure delete nào** (cmc_app không có DELETE grant) — ràng buộc delete = không tồn tại đường xoá. `code` bất biến sau tạo (đã test) |
| **ADM-02** | Quản trị tài khoản nhân sự (User) | admin/users | **super_admin + GĐKD/GĐĐT** (user.manage) | `/admin/users` | `user.create/list/update/updateRoles/resetPassword/changeOwnPassword/pickList` (staff.pickList) | **Journey:** user-admin-roles (tạo + gán role qua UI; **user.update = manifest drift — không screen nào gọi**) · **Live:** 00-setup-roles (SA tạo 4 tài khoản + temp password qua UI thật) · **API:** app-user.test.ts (16: employeeCode CMC####, managerId cross-facility reject, self-manager reject, A↔B cycle reject, updateRoles dedupe/unknown/dormant ke_toan/5-active/self-demotion/**last-admin**/another-admin, sale FORBIDDEN), password-procedures.test.ts (10: reset temp+force+clears lockout, audit không chứa password, không user.manage FORBIDDEN, không email refuse, cross-facility, changeOwnPassword verify/lockout/không credential leak) | Guard nâng quyền: director KHÔNG tạo/update/reset super_admin; self-demotion chặn; **last-admin chặn (count-then-update, TOCTOU hẹp đã note)**. **Escalation guard của create/update/resetPassword CHƯA có test trực tiếp** (chỉ updateRoles có test) |
| **ADM-03** | Cấu hình mạng chấm công (IP + Geofence) | admin/network-ip | **super_admin DUY NHẤT** (facilityNetwork.manage = mảng rỗng) | `/admin/network-ip` | `facilityNetwork.list/create/update/delete/detectMyIp` · `facilityGeofence.list/create/update/delete/testMyPosition` | **Journey:** network-ip-config (thêm/sửa/xoá; **cố ý không bật activate**) · **API:** network-router.test.ts (9: create default inactive+audited, CIDR lỗi, non-SA FORBIDDEN, facility scope, toggle, delete audited, detectMyIp null-guide), geofence-router.test.ts (5: default inactive, role, CRUD, RLS cross-facility, testMyPosition distance+accuracy) · Live: — | Tạo mới default `isActive:false` (QĐ ADR 0043 track). **Toggle activate/deactivate CHƯA journey-test** (sẽ phá journey chấm công). **Guard last active chỉ ở UI** (confirm dialog) — server KHÔNG chặn; tắt hết → punch về openMode legacy |
| **ADM-04** | Nhật ký hệ thống (AuditLog) | admin/audit-log | **super_admin DUY NHẤT** (audit.list = mảng rỗng — chủ ý, PO xác nhận 2026-07-19) | `/admin/audit-log` | `audit.list` (filter actor/action/entity/createdFrom/createdTo, phân trang) | **Journey:** audit-log-view (filter actor cô lập A khỏi B) · **Live:** 05-audit-log (filter action user.updateRoles / finance.receiptApprove) · **API:** audit/router.test.ts (5: newest-first, filter, paginate, non-SA FORBIDDEN), mutation-audit-coverage.test.ts (crm/finance/provisioning/refund audited) | Audit KHÔNG facility-scoped (platform-level). Banner khoảng ngày ngược không journey-test |
| **ADM-05** | Cấu hình ca làm (group/template) | admin/shift-config | **super_admin + GĐKD/GĐĐT** (shift.manage; compensationPolicy.manage = SA-only) | `/admin/shift-config` | `shift.createGroup/createTemplate/listGroups` · `compensationPolicy.get/upsert` (tỷ lệ phạt) | **Journey:** shift-config-admin (nhóm + mẫu ca + chính sách phạt) · **API:** create-template-validate.test.ts (**ca qua đêm end<=start bị reject**), register-approve.test.ts, list-procedures.test.ts · Live: — | Không có update/delete group/template (chỉ create+list). Mẫu ca validate endTime > startTime (ca đêm không hỗ trợ — ADR 0043 phase 8) |
| **KPI inbox board** | Bảng KPI (inbox + tất toán kỳ) | hr/kpi | **GĐKD/GĐĐT** (kpi.confirm/override/bulkApprove; branch-scope) · **sale/giao_vien** (kpi.list self-only, refresh, submitSlip) | `/hr/kpi` (status/period filter + Đã trả lương kỳ X) · `/hr/my` | `kpi.list/refresh/submitSlip/confirm/override/bulkApprove` | **Journey:** kpi-submit-confirm-bulk-approve (nộp→xác nhận→tất toán; **verified-correct**), kpi-refresh-my (tự tính lại; **verified-correct**) · **Live:** 07/08-ops-kpi-payroll · **API:** lifecycle.test.ts (~30: branch scope, anti-self, tierMissing, day-3 gate, unfinalized skip, idempotent), auto-score.test.ts (công thức, cap 100%, làm tròn, rollover) | bulkApprove **skip score không có payslip finalized** (skippedUnfinalized — có test). kpi.confirm dùng managerId (quan hệ, không phải role) |
| **Cockpit** | Tổng quan (role inboxes) | /cockpit | Mọi role (inbox theo vai) | `/cockpit` | finance.receiptList (draft) · crm.opportunityList (O4) · crm.opportunityDueFollowUps · submission.listForGrading · classBatch.list | **Không có journey** — chỉ unit cockpit-counter.test.ts · Live: mọi spec live đều đi qua /cockpit nhưng không assert nội dung | Metric: phiếu chờ duyệt, vượt ngưỡng, chấm bài; inbox theo vai (GĐ: duyệt phiếu; sale: O4 + nhắc việc; GV: chấm bài) |

---

## 3. EDGE CASE CHƯA test (gap cụ thể)

| # | Luồng | Edge chưa test | Mức độ |
|---|---|---|---|
| E1 | P4-01 | **Đường reject KHÔNG có journey/UI test** (chỉ API: hoàn sao exactly-once, race, hoàn theo giá lúc đổi) | trung bình — logic phức tạp nhất của luồng chỉ được bảo vệ bởi API test |
| E2 | P4-01 | Badge Hết hàng + nút Chưa đủ sao (disabled ban đầu) chưa journey-test; chỉ test flip sau redeem | thấp |
| E3 | P4-02 | Archive qua bulk action Ẩn đã chọn + form sửa quà (Sửa) chưa journey-test; **ẩn inactive khỏi LMS chưa được assert journey** | trung bình |
| E4 | P4-03 | **Double-book warning UI** (dialog giữ mở + nút Đóng) chưa journey-test — API chỉ test warning vẫn tạo | trung bình |
| E5 | P4-03 | **Nhắc PH qua outbox/Communication agent CHƯA implement** (docs/28 hứa, remindedAt đã drop) — doc-drift | cao (spec vs code lệch) |
| E6 | P4-04 | **Periodic test KHÔNG có UI + KHÔNG có journey + KHÔNG có live spec** (chỉ API) | cao |
| E7 | P4-04 | Defect **stale-view** (opportunityGet không invalidate sau advance — journey phải reload) — ghi nhận, chưa fix | cao (đã ghi nhận, không phải gap test thuần) |
| E8 | P4-05 | **`student.setLifecycle` KHÔNG có API test + KHÔNG có journey** — QĐ 0027 (chỉ GĐ đổi lifecycle) không được bảo vệ bởi test | cao |
| E9 | P4-05 | **high priority đẩy lên đầu hàng đợi CHƯA implement** — list chỉ orderBy createdAt desc, priority chỉ lưu (doc-drift vs docs/28) | cao (spec vs code lệch) |
| E10 | P4-05 | Transition âm (resolve bản closed, advance bản resolved…) chỉ API test, chưa UI-journey | thấp |
| E11 | ADM-02 | **`user.update` KHÔNG có UI caller** (manifest drift, ghi nhận trong ADM-02 header) — không journey được | trung bình (drift) |
| E12 | ADM-02 | **Escalation guard create/update/resetPassword** (director không đụng super_admin) **CHƯA có test trực tiếp** — chỉ updateRoles (self-demotion, last-admin) có test | cao — guard bảo mật không được test |
| E13 | ADM-02 | **resetPassword UI flow** (modal reset cho user hiện hữu) chưa journey-test; live 00 chỉ cover temp-password-at-create | trung bình |
| E14 | ADM-02 | Lỗi trùng email / manager cross-facility chưa journey-test (API có) | thấp |
| E15 | ADM-03 | **Toggle activate/deactivate CHƯA journey-test** (cố ý tránh vì phá punch); **last-active guard chỉ UI, server KHÔNG chặn** (tắt hết → openMode legacy) | cao — hành vi kích hoạt chưa được chứng minh |
| E16 | ADM-03 | **Geofence không có journey** (chỉ API); UI geofence (tạo/test vị trí) chưa journey | trung bình |
| E17 | ADM-01 | Không có delete (design); lỗi trùng code chưa journey-test; UI edit ẩn code (bất biến) không assert | thấp |
| E18 | ADM-04 | Banner khoảng ngày ngược chưa journey-test; deny trang cho non-SA chưa journey | thấp |
| E19 | ADM-05 | Không có update/delete group/template; lỗi validate ca đêm chưa journey-test (API có) | thấp |
| E20 | Cockpit | **Cockpit không có journey** (metric + inbox không được assert) — chỉ unit test + đi ngang | trung bình |

---

## 4. Trạng thái (Status)

Nguồn: **acceptance-report/business-verification.json** (sinh 2026-08-13, ledger 6af0f5f) — đây là số đo, không phải số chép.

| Luồng | Ledger | Nhận xét |
|---|---|---|
| P4-01 | ✅ **verified-correct** | invariant số dư = 2 (journey xuyên app) + API adversarial đầy đủ (race, refund exactly-once) |
| P4-02 | ✅ **verified-correct** | invariant starsRequired = 7 + sale không thấy entry |
| P4-03 | 🟡 reachable-only | journey + live + API; **nhắc outbox chưa implement**; double-book UI chưa test |
| P4-04 | 🟡 reachable-only | entrance đủ; **periodic không UI/journey/live**; defect stale-view còn mở |
| P4-05 | 🟡 reachable-only | journey + live + API; **setLifecycle chưa test**; **priority sort chưa implement** |
| ADM-01 | 🟡 reachable-only | create/update journey + API đủ; không delete (design) |
| ADM-02 | 🟡 reachable-only | create/updateRoles journey + live 00; **user.update drift**; **escalation guard chưa test** |
| ADM-03 | 🟡 reachable-only | CRUD journey + API; **toggle + last-active guard chưa test** |
| ADM-04 | 🟡 reachable-only | journey + live 05 + API; filter actor/action đã chứng minh |
| ADM-05 | 🟡 reachable-only | journey + API; validate ca đêm có test |
| KPI board | ✅ verified-correct (P3-06/08/09) | submit→confirm→bulkApprove + refresh có invariant |
| Cockpit | ⚪ không có journey riêng | chỉ unit + đi ngang trong live |

**Tổng ledger:** 43 luồng = 17 verified-correct + 20 reachable-only + 6 not-proven (P2-01/02 built-unproven; P2-03/05, P3-10/11 no-ui-path). Toàn bộ cụm P4 + Admin đều **proven (chạy xanh)**, 2/5 P4 verified-correct, 3/5 P4 + toàn bộ ADM mới ở mức smoke (reachable-only) — đúng nghĩa journey = smoke, chưa chứng minh số học nghiệp vụ (AGENTS.md). **UAT người thật chưa chạy** ⇒ chưa production-ready.

**Doc-drift cần sửa (docs/28 lỗi thời):**
1. P4-03/P4-05 ghi UI EmptyState stub — API implemented, UI not yet wired → **sai**: UI đã wire đầy đủ (`/crm/post-sale-meeting`, `/crm/aftersale` + form-depth) và có journey chứng minh.
2. P4-03 nhắc PH qua outbox → chưa implement (remindedAt drop).
3. P4-05 high priority đẩy lên đầu hàng đợi → chưa implement (list orderBy createdAt desc).
4. docs/25 §2 vẫn trỏ test `meeting/lifecycle.spec` / `test/meeting/...` (tên cũ) — tên file thật: `parent-meeting.test.ts`, `after-sale.test.ts`, `appointment-lifecycle.test.ts`, `rewards/redeem-refund.test.ts`.

**Khuyến nghị ưu tiên (gap có rủi ro nhất):** E8 (setLifecycle chưa test — QĐ 0027), E12 (escalation guard chưa test — bảo mật), E15 (toggle network chưa test + guard chỉ UI), E5/E9 (spec-code lệch: outbox, priority sort), E6 (periodic không UI), E7 (stale-view defect).
