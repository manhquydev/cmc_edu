---
title: Khắc phục Happy-path Gaps (scenario audit) — TDD
description: >-
  Remediate ~31 non-happy-path gaps found by the scenario audit, grouped by root
  pattern (Hybrid B+C), tests-first to lock 532 existing tests before touching
  money/auth/payroll logic.
status: completed
priority: P1
branch: main
tags:
  - remediation
  - tdd
  - authz
  - concurrency
  - data-integrity
blockedBy: []
blocks: []
created: '2026-07-15T07:02:36.586Z'
createdBy: 'ck:plan'
source: skill
---

# Khắc phục Happy-path Gaps (scenario audit) — TDD

## Overview

Biến ~31 phát hiện ngoài-happy-path (từ `plans/reports/ck-scenario-role-module-audit-260715-1331-happy-path-gaps-report.md`) thành công việc có cấu trúc theo **Hybrid B+C**: fix Critical phẫu thuật riêng + gom pattern gốc dùng chung + xếp ưu tiên theo rủi ro thực. Hướng đã chốt trong `plans/reports/brainstorm-remediation-260715-1338-happy-path-gaps-waves-report.md`.

**Nguyên tắc xuyên suốt — TDD (tests-first):** mọi phase sửa money/auth/payroll logic có 532 test sẵn. Mỗi bước: (1) viết test FAIL mô tả hành vi đúng → (2) chạy xác nhận đỏ → (3) sửa code tối thiểu cho xanh → (4) chạy lại full suite của package đó, không được đỏ regression. Không sửa code trước khi có test đỏ.

**Loại khỏi scope (thiết kế chủ đích, PO chốt giữ nguyên):** refund không có GĐĐT · lương reprice giữa kỳ · KPI nộp slip kỳ đã qua · rule 0-công phiếu 1-mốc (chỉ thêm cảnh báo, KHÔNG đổi rule tính công).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Verification & Promotion Gate](./phase-01-verification-promotion-gate.md) | Completed |
| 2 | [C1 Receipt-Cancel Provisioning Race](./phase-02-c1-receipt-cancel-provisioning-race.md) | Completed |
| 3 | [Teacher Class-Scoping Authorization](./phase-03-teacher-class-scoping-authorization.md) | Completed |
| 4 | [C2 Single-Punch Approval Warning](./phase-04-c2-single-punch-approval-warning.md) | Completed |
| 5 | [Status & Lifecycle Guards](./phase-05-status-lifecycle-guards.md) | Completed |
| 6 | [Atomic-Lock Standardization](./phase-06-atomic-lock-standardization.md) | Completed |
| 7 | [Metric & Data Integrity](./phase-07-metric-data-integrity.md) | Completed |
| 8 | [Low-Severity Hygiene](./phase-08-low-severity-hygiene.md) | Completed |
| 9 | [Post-Implementation Hardening](./phase-09-post-implementation-hardening.md) | Completed |

## Wave → Phase mapping (Hybrid B+C)

- **Đợt 0 (xác minh chặn):** Phase 1 — gate, có thể promote việc vào Phase 2/3.
- **Đợt 1 (Critical + phân quyền, stop bleeding):** Phase 2 (C1), Phase 3 (teacher-scoping H1+H2+#3), Phase 4 (C2 warning).
- **Đợt 2 (guard hệ thống, structural):** Phase 5 (status/lifecycle), Phase 6 (atomic-lock).
- **Đợt 3 (toàn vẹn số liệu):** Phase 7.
- **Đợt 4 (hygiene):** Phase 8.

## Precondition (BẮT BUỘC trước Phase 2)

TDD "no regression" chỉ đo được nếu có baseline xanh đã biết. **Trước khi sửa dòng code sản phẩm đầu tiên:** chạy `pnpm --filter @cmc/api test` + `pnpm typecheck` một lần, ghi lại số test pass (kỳ vọng ~532/64 file theo docs). Nếu baseline đã đỏ → dừng, báo user, KHÔNG bắt đầu (không thể phân biệt regression mới với đỏ sẵn).

## Execution order & dependencies

Tuần tự 1→8 là mặc định an toàn. Song song hoá CÓ ĐIỀU KIỆN (file ownership tách bạch):
- Phase 2 (finance/provisioning/worker) và Phase 4 (checkin) độc lập → song song được sau Phase 1.
- **Phase 3 và Phase 7 ĐỀU sửa `attendance/router.ts` (`mark`/`markAll`)** → KHÔNG song song 2 phase này; chạy Phase 3 trước Phase 7 (Phase 7 chèn recompute-trigger vào cùng thủ tục Phase 3 vừa thêm authz guard).
- Phase 5 (session-evidence/class/meeting/guardian) độc lập Phase 2/4.
- Phase 6 sửa `schema.prisma` (`ReconciliationFlag`) → migration; chạy tách để không lẫn migration với phase khác.
- Phase 1 (V2 frontend scan) có thể sinh sub-plan riêng nếu role-array hardcode còn nhiều — quyết định tại cuối Phase 1.

## Global conventions

- **Test runner:** `pnpm --filter @cmc/api test <file>` (vitest, colocated `*.test.ts`). Domain-thuần: `pnpm --filter @cmc/domain-payroll test`.
- **Migration:** `pnpm --filter @cmc/db prisma migrate dev --name <desc>` — chỉ Phase 6 cần.
- **Verify cuối mỗi phase:** `pnpm --filter @cmc/api test` (package đó) + `pnpm typecheck`. Phase động e2e: `pnpm --filter @cmc/e2e test` nếu có spec liên quan.
- **Không** dùng role-string literal mới trong code (dùng `can()`/registry). **Không** đặt mã ADR/phase vào tên test/comment code (chỉ mô tả hành vi).

## Global risks

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Fail-open → fail-closed (Phase 3) làm gãy test synthetic userId | Test đỏ hàng loạt | Phase 3 budget cho việc seed AppUser trong test fixtures trước khi siết |
| Migration `@@unique` (Phase 6) đụng dữ liệu trùng sẵn có | migrate deploy fail trên prod | Thêm bước dọn trùng trước khi tạo constraint (data migration) |
| C1 sửa thứ tự/transaction boundary | có thể phá idempotency provisioning | Giữ provisioning idempotent; chỉ THÊM guard đọc lại status, không gộp lại vào tx tiền |
| Recompute FinalGrade từ attendance (Phase 7) | vòng lặp/hiệu năng | Chỉ recompute period bị ảnh hưởng, tái dùng `recomputeFinalGrade` sẵn có |

## Success criteria (toàn plan)

- [x] Không thể tồn tại `Receipt.status='cancelled'` mà vẫn có Enrollment active / StudentAccount (C1); reconcile bắt được nếu lọt. — `finance/receipt-cancel-provisioning-race.test.ts` (7 test, gồm race thật + M9 invariant) + `reconcileCancelledButProvisioned` backstop **thực sự chạy trong production** (Phase 9 H2: wired vào `worker/index.ts`'s `drainOnce`, xác nhận qua `worker/drain-once.test.ts`) — trước Phase 9 đây là dead code, chỉ test gọi trực tiếp mới thấy chạy.
- [x] Giáo viên A không mark/grade/assess/publish-evidence được lớp của giáo viên B (test FORBIDDEN cho từng thủ tục); fail-closed khi thiếu AppUser. — `attendance/teacher-scoping-cross-router.test.ts` (10 test) + `assert-teacher-owns-class.test.ts` (6 test).
- [x] Duyệt phiếu công 1-mốc trả cờ cảnh báo; rule 0-công KHÔNG đổi. — `checkin/manual-punch-approval-track.test.ts` (warnings) + `attendance/resolve-day-credit.test.ts` (invariant giữ nguyên).
- [x] Không tạo được evidence/meeting cho buổi `cancelled` / HS `withdrawn`; đổi curriculumUnit khi `done` bị chặn. — `class/assert-session-active.test.ts`, `session-evidence/publish.test.ts`, `meeting/parent-meeting.test.ts`, `exercise/publish.test.ts`.
- [x] Test đua (2 actor cùng thao tác) cho grade/OTP chỉ 1 thành công; không tạo `ReconciliationFlag` trùng. — `submission/grade.test.ts`, `lms-auth/login.test.ts`, `worker/reconcile-finance-flags.test.ts` (race thật) + partial unique index DB thật.
- [x] renewal/new phân loại đúng theo student-scope; FinalGrade tự refresh sau sửa điểm danh **VÀ sau khi huỷ buổi** (Phase 9 M2: `classSession.cancel` trước đây bỏ sót case này, HS thấy điểm cũ tới khi có sự kiện không liên quan tình cờ trigger refresh). — `finance/approve.test.ts` (kind student-scoped), `attendance/gate.test.ts` (FinalGrade refresh mark/markAll + cancel).
- [x] Full `@cmc/api` suite xanh, `pnpm typecheck` 26/26 xanh sau mỗi phase. — Xác nhận lần cuối (sau Phase 9): 839/839 test (94 file API) + 26/26 typecheck.

## Dependencies

Không có plan in-flight chồng lấn. Các plan nền (`260713-1706-attendance-daily-inout-pairing`, `260711-1752-hr-kpi-shift-attendance-remediation`, `260711-1128-erp-lms-workflow-closure-audit`) đều `completed` — plan này xây trên code as-built của chúng, không blockedBy/blocks.

## Quyết định PO — vòng 2 (edge cases, đã chốt qua validate)

| Tình huống | Chốt | Ảnh hưởng plan |
|---|---|---|
| Huỷ phiếu → tài khoản LMS con | **Giữ login, chỉ rút chỗ học** (giữ nguyên) | Phase 2: C1 chỉ chặn race tạo enrollment mới; KHÔNG khoá StudentAccount |
| Quên bấm ra TRONG mạng công ty | **Để tự chịu, không nhắc** | Phase 4: rủi ro chấp nhận, ghi rõ; không mở rộng |
| Lớp chưa gán giáo viên | **Chặn GV, chỉ giám đốc** | Phase 3: helper thêm nhánh `teacherAppUserId=null` → forbidden GV |
| Trùng SĐT khác tên học sinh | **Chặn + bắt sale xác nhận** (bé mới/bé cũ) | Phase 7: receiptCreate thêm cổng chặn + cờ `confirmNewStudent`; sweep UI+e2e |
| Recompute điểm sau khi gửi báo cáo | reportCard vốn tính live → recompute FinalGrade chỉ để KHỚP; không cần warn-gate | Phase 7: không đổi |
| Đặt trùng giờ họp phụ huynh | **Cảnh báo, không chặn** | Phase 8: soft-warn |

## Quyết định PO — vòng 3 (đảo/mở rộng, đã chốt)

| Tình huống | Chốt | Ảnh hưởng plan |
|---|---|---|
| Huỷ-phiếu-thường → phụ huynh thấy con | **Vẫn thấy để xem lịch sử** (ĐẢO K9) | Phase 5: bỏ ẩn theo enrollment-all-withdrawn; chỉ ẩn `blocked_lms`+`withdrawn`(void); cập nhật test K9 cũ |
| "Chặn+xác nhận bé mới/cũ" kích hoạt khi nào | **Mọi lúc trùng SĐT chưa chỉ rõ bé** (không chỉ khác tên) | Phase 7: điều kiện chặn = phone có ≥1 student && !studentId && !confirmNewStudent |
| Giới hạn xin mã OTP | Mặc định 5 lần/15 phút/identifier, soft-block 15' (placeholder chỉnh được) | Phase 6: đặt hằng số cụ thể |

**Lưu ý ĐẢO K9:** đây là đảo một quyết định remediation cũ đã có test, chạm ranh giới hiển-thị-dữ-liệu-trẻ. Không phải regression — là quyết định PO mới, có ghi rõ + cập nhật test tương ứng ở Phase 5.

## Open questions

1. Phase 1-V2: nếu frontend role-array hardcode còn nhiều → tách sub-plan "frontend authz sweep" thay vì nhồi vào Phase 8? (chốt tại cuối Phase 1)
2. ~~Phase 5 dọn attendance khi huỷ buổi~~ → **RESOLVED: flag, giữ append-only, không xoá** (Phase 5).
3. Phase 3: trước khi bật gate "lớp chưa gán GV → chặn", cần rà số lớp đang `teacherAppUserId=null` và gán GV trước (nếu nhiều) để không kẹt vận hành. (chốt tại đầu Phase 3)
