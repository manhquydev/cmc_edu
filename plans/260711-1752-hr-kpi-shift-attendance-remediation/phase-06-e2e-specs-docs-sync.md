---
phase: 6
title: "E2E specs & docs sync"
status: pending
priority: P2
dependencies: [5]
effort: "4h"
---

# Phase 6: E2E specs & docs sync

## Overview
Đóng vòng verify. Đã hấp thụ red-team #9/#18/#21 + AsmD #7: cắt 5→2 specs (3 spec trùng integration coverage), seed AppUser/managerId chains tường minh, bỏ claim "không cần mock clock", ADR theo convention docs/22.

## E2E specs (apps/e2e/tests/, API-driven, dùng `createE2eStaffClient` — apps/e2e/src/trpc-client.ts:101)

**CHỈ 2 specs** — hai flow cross-module đa-actor duy nhất mà integration test đơn-router không với tới (red-team #18):

1. `shift-lifecycle.spec.ts`: createGroup/Template (seed) → sale submit → GĐKD reject (reason) → sale thấy rejectReason qua `myRegistrations` → resubmit → approve. Assert group-type gate + anti-self + ticket-lock free sau reject.
2. `kpi-lifecycle.spec.ts`: seed SalaryTier + gán bậc + receipts (DB-seed `approvedAt` kỳ QUÁ KHỨ — finance mutation stamp now(); kèm 1 assertion API-driven: approve receipt hiện tại → `approvedAt` ghi — red-team FMA #10) + **shift registration approved + punches đủ cặp midpoint** (DB-seed kỳ quá khứ) → sale refresh (đúng công thức nhân %côngca × %doanhthu × đơnGiá) → submitSlip (kỳ quá khứ qua guard ngày-3 tự nhiên) → GĐKD confirm → assemble ra đúng `base + value − penalty` → bulkApprove (chỉ khi payslip finalized) → approved; GĐĐT bulkApprove KHÔNG đụng phiếu sale (branch-scope ROLE).

**ĐÃ CẮT** (trùng integration): checkin-ip (ip-match.test.ts:84-158 cover), payslip-policy (policy-rates + penalty-posttax cover), manual-punch-payroll (manual-ticket-exemption.test.ts cover).

**Boundary tests mock clock KHÔNG thuộc e2e** — chúng là unit tests phase 3 (submitSlip 23:59+07/00:00+07). E2e dùng kỳ quá khứ là qua guard hợp lệ, nhưng KHÔNG được claim cover boundary (bản plan cũ viết sai — red-team #9).

**Seed bổ sung** (`apps/e2e/src/db.ts` + `global-setup.ts`) — AsmD #7: **AppUser fixtures + managerId chains tường minh** (GV→GĐĐT, sale→GĐKD; client identities `userId` khớp AppUser.userId), ShiftGroup/Template (theo unique keys — không đụng seed catalog), **SalaryTier + assignTier**, CompensationPolicy, Receipt approvedAt quá khứ, punches đủ cặp vào/ra. Teardown sạch.

## Docs sync (đọc doc trước khi sửa; ≤800 LOC/doc)
- `docs/10-data-model-v2.md`: **SalaryTier** + SalaryRate.tierId (3 cột cũ nullable-deprecated), CompensationPolicy, KpiScore fields mới (+unitRateSnapshot/tierIdSnapshot, kpiMax nullable), Payslip.kpiBonus = "Phần KPI" (tái dụng, variablePay deprecated=0), ShiftGroup/Template unique keys, ShiftRegistration.rejected/rejectReason, Receipt.approvedAt, SessionStatus.done + doneAt + makeupForSessionId.
- **Công thức lương mới ghi vào `docs/20`** (nơi chứa quy tắc vận hành — R3-12: docs/17 là role-flow doc, KHÔNG chứa công thức; chỉ thêm cross-ref ngắn ở 17). **`docs/27-workflow-spec-p3.md` (WF-P3-05/06 công thức cũ + `/hr/salary-structure` + kpi.approve) và `docs/uat-checklist-go-live.md` (KB4 gọi kpi.submit/approve đã BỎ) — REWRITE các mục liên quan** (R3-12, trước đây ngoài sweep). **Runbook onboarding**: bước bắt buộc trước kỳ lương đầu — tạo SalaryTier + gán bậc toàn bộ sale/GV (greenfield, validate s4).
- `docs/11-api-contract.md`: procedures mới (refresh/submitSlip/bulkApprove/reject/listGroups/myRegistrations/pendingForApproval/manualPunch.list/payslip.my/compensationPolicy.*); BỎ `kpi.submit`, `kpi.approve` đơn lẻ, `kpi.getForUser`; errorFormatter `data.appCode`.
- `docs/20-quy-tac-nghiep-vu-van-hanh.md`: (QĐ mới) lifecycle KPI ngữ nghĩa mới + anti-self + immutable-sau-finalize + van super_admin-từ-approved-khi-reopen; bulkApprove chỉ phiếu có payslip finalized; branch-scope theo ROLE; **GĐ/super_admin không có phiếu KPI/payslip (lương ngoài hệ thống — s4)**; **mô hình lương bậc `base(tier) + %côngca × %chỉ-số × đơnGiá − phạt` + định nghĩa công ca vào/ra + phạt per-ca + flag span<50% + đổi tier giữa kỳ cho-phép-có-audit**; metric "doanh thu phê duyệt" (gross; note: nếu tương lai có transition approved→sent phải cập nhật filter — R2 #M2); cơ chế session-done 3 điều kiện + creditFactor 24h/48h/0 + không hồi tố + **doneAt = snapshot đóng băng** (re-mark sau done không đổi credit); auto-cancel 0-HS + **buổi bù nối đuôi khóa** (khóa kéo dài qua endDate khi nợ buổi; conflict phòng → chờ người xử); submitSlip tự refresh trước nộp (residual: buổi done sau lúc nộp cần GĐ override); miễn phạt ngày ticket approved + warning duyệt muộn; gate duyệt ticket = direct-manager hoặc super_admin; policy rates per-facility; overlap rule shift (1 người 1 khoảng active bất kể group).
- **ADR 0042** theo numbering `docs/22-adr-rule-chi-code-0038-0041.md` (KHÔNG có docs/adr/ — red-team #21): "KPI auto-score + session-done engine" — 1 ADR duy nhất; các rule còn lại là QĐ trong docs/20.
- `docs/25-ma-tran-truy-vet-p1.md`: cập nhật P3-01…06 + flows mới (reject, bulkApprove, refresh, session-done, reschedule).
- `docs/14` (nav matrix) + `docs/codebase-summary.md` + `docs/project-changelog.md` (ghi breaking: bỏ kpi.submit/approve/getForUser).

## Implementation Steps
1. Seed helpers (manager chains) → 2 specs, chạy cục bộ từng spec → full `pnpm --filter @cmc/e2e test`.
2. Docs sync (đọc trước, verify claim khớp code).
3. `gitnexus_detect_changes({scope:"all"})` — blast radius khớp plan; `npx gitnexus analyze` sau commit (hook tự chạy).
4. Full gate: `pnpm build` 14/14 + toàn suite + lint.

## Success Criteria
- [ ] 2 specs xanh dev-header; Mode-B chạy khi có secrets (theo memory local-sim quirks — nếu CI thiếu, ghi skip-reason rõ, không xoá spec).
- [ ] TL25 đủ 6 cột mọi flow mới; không claim stale.
- [ ] ADR 0042 đúng file/numbering docs/22; changelog ghi breaking changes.

## Risk Assessment
- Seed managerId chains phải khớp resolve pattern router — test fixture sai namespace là loại lỗi chính red-team đã bắt ở prod code; double-check `AppUser.userId` vs `id` trong seed.
- Docs/20 nhận nhiều QĐ một đợt — giữ mỗi QĐ ngắn, trỏ về ADR 0042 cho ngữ cảnh.
