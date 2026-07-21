---
phase: 4
title: "P3 HR-Payroll-KPI Runtime Proofs"
status: pending
priority: P2
dependencies: [1]
effort: "2d"
---

# Phase 4: P3 HR-Payroll-KPI Runtime Proofs

## Overview

Runtime proof cho 11 flows P3 (chấm công vào/ra → ca → lương bậc → KPI → 2 flow hệ thống time-based). <!-- Updated: Red Team R2 - R2-1 --> Signed-auth mode. Payroll: prove WIRING, không re-derive công thức (rt#11).

## Requirements

- Functional: 11/11 flows P3 có verdict.
- Non-functional: công thức lương KHÔNG hand-calc lại trong e2e — đã lock ở `packages/domain-payroll/src/assemble-slip.test.ts` (199 dòng, CI gate ≥90% coverage `ci.yml:83-84`); e2e assert wiring: punches/KPI seed thật chảy vào `payslip.assemble`, kết quả persist khớp domain-fn output (rt#11). Time-based không sleep thật.

## Architecture

**Coverage thực tế (từ matrix Phase 1, rt#7):** `shift-lifecycle.spec.ts` tự nhận WF-P3-03/04 (KHÔNG 07); `kpi-lifecycle.spec.ts` tự nhận WF-P3-05/06 nhưng body chạm bulkApprove/refresh VÀ payslip.assemble/finalize — matrix quyết chính xác test nào assert gì. Tránh trùng P3-05: nếu kpi-lifecycle đã assert assemble/finalize bằng state thật → P3-05 annotate ở đó, spec mới `p3-payroll-tiers.spec.ts` CHỈ phủ phần tier config (salaryTier CRUD, assignTier, reopen, my-scope) — không annotate lại P3-05 nếu đã nhận.

**P3-10/P3-11 (rt#8):** KHÔNG có cron handler/tRPC trigger — entrypoint thật là `runDoneSweep(db, now)` / `runCancelSweep(db, now)` exported (apps/api/src/worker/session-done-sweep.ts:35,70, wired qua drainOnce worker/index.ts:125-126), injectable `now`. Proof = gọi IN-PROCESS từ Playwright test qua db helper của e2e; ghi rõ trong evidence notes rằng invocation in-process (khác RLS context server) — xác nhận connection context nhìn thấy data seed trước khi assert. Sweeps chạy GLOBAL không lọc facility (session-done-sweep.ts:40-45,76-81) → assert theo session ID cụ thể đã seed, TUYỆT ĐỐI không assert aggregate count; chấp nhận sweep có thể chạm data baseline (rủi ro ghi trong notes).

## Related Code Files

- Reuse + annotate (theo matrix): `apps/e2e/tests/shift-lifecycle.spec.ts` (P3-03/04), `kpi-lifecycle.spec.ts` (P3-06 + có thể P3-05/08/09), `attendance-lifecycle.spec.ts` (P3-01/02)
- Create: `apps/e2e/tests/p3-payroll-tiers.spec.ts` (P3-05 phần tier-config/wiring còn thiếu), `apps/e2e/tests/p3-system-sweeps.spec.ts` (P3-10, P3-11), `p3-punch-offsite.spec.ts` nếu matrix nói attendance-lifecycle thiếu P3-01/02, spec bổ sung P3-07 reject nếu shift-lifecycle thiếu
- UI screenshots trong functional UI specs (rt#15)

## Implementation Steps

1. Theo coverage matrix: annotate 3 spec sẵn có đúng phần thực phủ; liệt kê hụt (chú ý P3-07 shift.reject, P3-08 bulkApprove, P3-09 refresh phải có state-assertion thật, không phải pass-through call — matrix là trọng tài).
2. `p3-payroll-tiers.spec.ts` (P3-05 wiring):
   - salaryTier.create/update + compensation.assignTier.
   - Seed punches/KPI synthetic → payslip.assemble → đọc payslip persist → gọi `assembleSlip(inputs)` domain-fn với cùng inputs → assert khớp (wiring proof); finalize → reopen nhánh phụ; payslip.my đúng scope (nhân viên chỉ thấy mình; GĐ ngoài payslip — đúng salary model LOCKED). Negative-authz (rt#10): giao_vien gọi `payslip.finalize` → chặn; nhân viên thường gọi `kpi.override` → chặn.
3. `p3-system-sweeps.spec.ts`:
   - P3-10: seed session quá khứ đủ điều kiện done → `runDoneSweep(db, fixedNow)` in-process → assert session ID đó DONE + KPI cập nhật cho đúng user.
   - P3-11: seed session quá khứ 0 điểm danh → `runCancelSweep` → assert session ID đó CANCELLED + buổi bù trong ScheduleSlot của đúng class.
4. Nếu matrix nói thiếu: P3-01 punch trong/ngoài mạng (FacilityNetwork IP — giả lập qua header/config test, assert cả 2 nhánh), P3-02 manualPunch approve/reject/resubmit theo GĐ track.
5. UI proof + screenshot trong functional UI specs cho uiRoutes claimed P3; chạy 1 lần chuẩn, re-run targeted khi flaky.

## Success Criteria

- [ ] 11/11 flows P3 có verdict.
- [ ] P3-05 proof wiring khớp domain-fn, KHÔNG hand-calc; không có 2 spec cùng annotate P3-05.
- [ ] P3-10/P3-11 assert theo session ID cụ thể qua sweep entrypoint thật; evidence notes ghi in-process invocation.
- [ ] Negative-authz pass: payslip.finalize, kpi.override (+ shift.approve nếu matrix xếp vào privileged).
- [ ] IP-gating P3-01 assert cả 2 nhánh.

## Risk Assessment

- Sweep global chạm baseline data → chỉ assert per-ID; nếu sweep phá state spec khác → chạy sweeps spec cuối cùng trong phase.
- RLS context in-process khác server → xác minh visibility trước assert; sai lệch → verdict `blocked` + finding, không ép xanh.
