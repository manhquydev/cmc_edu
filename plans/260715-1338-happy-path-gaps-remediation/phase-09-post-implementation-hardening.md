---
phase: 9
title: Post-Implementation Hardening
status: completed
priority: P1
dependencies:
  - 2
  - 3
  - 6
  - 7
---

# Phase 9: Post-Implementation Hardening

## Overview
Sau khi Phase 1-8 hoàn tất và commit (`9c1522c`), chạy 3 `code-reviewer` subagent song song rà soát toàn bộ diff (không tin test xanh sẵn có). Phát hiện 4 finding HIGH + 1 MEDIUM-HIGH + 5 MEDIUM thật — chủ yếu là các chỗ pattern đã áp dụng cho thủ tục "chị em" trong CÙNG file/CÙNG diff nhưng bị bỏ sót ở 1-2 thủ tục liền kề, hoặc 1 thành phần được XÂY nhưng chưa được WIRE vào chu trình thật. 2 finding HIGH đã tự xác minh bằng grep trực tiếp (không chỉ tin agent).

## Requirements
- Functional: đóng 9 gap cụ thể liệt kê dưới, mỗi gap có test đỏ trước khi sửa.
- Non-functional: không đổi hành vi đã test-pass của Phase 1-8; chỉ mở rộng scope check/wiring còn thiếu.

## Related Code Files
- Modify: `apps/api/src/submission/router.ts` (`saveTeacherAnnotation` scoping — H1; `listForGrading` scoping — MH1)
- Modify: `apps/api/src/worker/index.ts` (`drainOnce` — wire `reconcileCancelledButProvisioned` — H2)
- Modify: `apps/api/src/worker/reconcile-orphaned-receipts.ts` (M9 invariant check trong `reconcileCancelledButProvisioned` — M3, làm cùng H2)
- Modify: `apps/api/src/finance/router.ts` (duplicate-student gate TOCTOU — H3)
- Modify: `apps/api/src/lms-auth/router.ts` (OTP transaction timeout — H4)
- Modify: `apps/api/src/assessment/router.ts` (`listBySession` scoping — M1)
- Modify: `apps/api/src/session-evidence/router.ts` (`getBySession` scoping — M1)
- Modify: `apps/api/src/class/class-session-router.ts` (`cancel` gọi `recomputeFinalGrade` — M2)
- Modify: `packages/db/prisma/schema.prisma` + migration mới (`@@index([facilityId, studentId])` trên Receipt — M4)
- Modify: `apps/api/src/worker/relay-email-outbox.ts` (sweep/reap OTP interaction — M5)
- Modify (test): siblings tương ứng mỗi file trên

## Implementation Steps (TDD)
1. **H1 — saveTeacherAnnotation scoping:** test đỏ giáo viên B ghi annotation submission của học sinh lớp giáo viên A → FORBIDDEN. Impl gọi guard tương tự `grade`. Xanh.
2. **H2+M3 — wire reconciler + M9 check:** test đỏ (a) `drainOnce` phải gọi `reconcileCancelledButProvisioned` (spy/mock hoặc integration); (b) reconciler KHÔNG rút enrollment khi còn receipt approved khác cùng student+class. Impl: thêm call trong `drainOnce`; thêm check M9 vào reconciler. Xanh.
3. **H3 — duplicate-student gate TOCTOU:** test đỏ 2 `receiptCreate` đồng thời cùng phone, cả 2 chưa approve → phải có cơ chế chặn tạo 2 Student trùng khi cả 2 được approve sau đó. Impl: advisory lock theo `(facilityId, normalizedPhone)` bọc quanh gate-check + create trong `receiptCreate`. Xanh.
4. **H4 — OTP transaction timeout:** test đỏ (nếu mô phỏng được) hoặc xác minh tĩnh — chuyển 2 transaction OTP qua `withFacility` (hoặc truyền `{timeout: 15_000}` trực tiếp cho `$transaction`) để khớp pattern toàn repo. Xanh.
5. **MH1 — listForGrading scoping:** test đỏ giáo viên B thấy submission lớp giáo viên A trong queue → phải lọc theo lớp mình phụ trách (trừ director bypass). Impl. Xanh.
6. **M1 — assessment.listBySession + sessionEvidence.getBySession scoping:** test đỏ tương tự cho từng thủ tục. Impl dùng `assertTeacherOwnsSessionClass`/`assertTeacherOwnsClass` sẵn có. Xanh.
7. **M2 — classSession.cancel refresh FinalGrade:** test đỏ huỷ buổi đã điểm danh → FinalGrade học sinh phải refresh ngay (không chờ sự kiện khác). Impl gọi `recomputeFinalGrade` cho các studentId bị ảnh hưởng. Xanh.
8. **M4 — index Receipt.studentId:** migration `@@index([facilityId, studentId])`. Không cần test riêng (schema-only), xác nhận qua `prisma migrate deploy` + regression không đổi hành vi.
9. **M5 — OTP sweep/reap interaction:** test đỏ row `sending` kind=otp ở phút 5-15 không bị sweep xoá payload trước khi có cơ hội reap-redrain. Impl: loại trừ OTP `sending` khỏi sweep cho tới khi qua ngưỡng reap, hoặc rút `OTP_PAYLOAD_TTL_MINUTES` xuống khớp lại. Xanh.
10. **Regression toàn diện:** `pnpm --filter @cmc/api test` + `pnpm typecheck` (26/26) xanh sau mỗi bước, full suite cuối cùng.

## Success Criteria
- [x] H1-H4 đều có test chứng minh gap đã đóng. — H1: `teacher-annotation.test.ts`; H2+M3: `worker/drain-once.test.ts` + M9 test trong `receipt-cancel-provisioning-race.test.ts`; H3: `duplicate-student-gate.test.ts` (TOCTOU, kể cả race thật `Promise.all`) + `idempotent.test.ts`; H4: static (timeout khớp `withFacility`, `lms-auth` suite xanh).
- [x] MH1, M1, M2 đều có test FORBIDDEN/refresh tương ứng. — MH1: `submission/grade.test.ts`; M1: `attendance/teacher-scoping-cross-router.test.ts`; M2: `attendance/gate.test.ts`.
- [x] M4 migration áp dụng thành công không phá dữ liệu. — Migration `20260716012411_post_impl_h3_confirm_new_student_m4_index` áp thành công, full suite xanh sau đó.
- [x] M5 có test chứng minh OTP không bị sweep mất nội dung trước khi reap. — `worker/relay-email-outbox.test.ts` (3 test mới, gồm full-cycle proof qua `relayEmailOutbox`).
- [x] Full `@cmc/api` suite + `pnpm typecheck` 26/26 xanh. — 839/839 test (94 file), typecheck 26/26 xanh, xác nhận lần cuối trên `main`.
- [x] Cập nhật lại 2 success criteria tổng plan bị ảnh hưởng (reconcile thật sự chạy; FinalGrade refresh đầy đủ cả case cancel). — Cập nhật trong `plan.md`.

### Phát sinh ngoài kế hoạch gốc (tự phát hiện + xử lý trong Phase 9)
- **H3 đổi hướng giữa chừng** (đã hỏi ý kiến trước khi làm): advisory lock ở `receiptCreate` (kế hoạch gốc) KHÔNG đóng được gap thật (gap là khoảng hở hàng giờ giữa 2 draft receipt, không phải race đồng thời). Sửa thật ở provisioning-time — thêm `Receipt.confirmNewStudent` (persisted) + reuse-by-phone logic trong `provisionFromReceipt`.
- **Code review độc lập sau khi đóng 5 gap đầu** (code-reviewer subagent, không tin test xanh sẵn có) phát hiện thêm 1 HIGH + 2 MEDIUM thật, đã sửa và re-verify: (1) HIGH — khóa H3 không bao trùm bước tạo `Guardian`, vẫn có thể race dưới concurrency thật (đã sửa + test `Promise.all` thật); (2) MEDIUM — `listForGrading`/`assertTeacherOwnsStudentClass` nuốt mọi lỗi (kể cả lỗi DB thật) thay vì chỉ FORBIDDEN; (3) MEDIUM — advisory lock thừa + comment sai ở `receiptCreate` (đã xóa).
- **3/3 background implementer subagent cho M1/M2/M5 chạy trên git worktree bị stale** (2/3 branch từ trước khi toàn bộ Phase 1-8 + Phase 9 H1-H4/MH1 merge vào main) — không merge trực tiếp được. Đã tự tích hợp lại: trích diff logic đã verify, áp thủ công lên `main` thật, tự chạy lại đỏ→xanh (không tin báo cáo "DONE" của subagent là đủ bằng chứng khi base code khác biệt).

## Risk Assessment
- H3 (advisory lock cho draft receipt) là thay đổi nhạy cảm nhất — phải đảm bảo KHÔNG serialize toàn bộ receiptCreate không liên quan (chỉ lock theo phone cụ thể, giữ ngắn).
- H2+M3 wiring reconciler vào production worker — chạy trên toàn bộ facility mỗi cycle, cần xác nhận không quá tải (query đã có sẵn từ Phase 2, chỉ thêm điều kiện M9).
- M5 (OTP sweep/reap) — cần giữ đúng bất biến "drain luôn thấy payload thật trước sweep" đã ghi trong code, không phá vỡ case non-OTP.
