---
phase: 3
title: "KPI auto-score & lifecycle (TDD)"
status: pending
priority: P1
dependencies: [1, 7]
effort: "10h"
---

# Phase 3: KPI auto-score & lifecycle (TDD)

## Overview
KPI chuyển sang auto-score + lifecycle trách nhiệm 4 bước. Đã hấp thụ red-team #1/#2/#4/#8/#9/#10/#11/#15/#17: anti-self toàn tuyến, attribution đúng namespace, GV = giờ×creditFactor, concurrency contract, bỏ `kpi.approve` đơn lẻ, immutability sau finalize.

## Requirements
- Lifecycle: `draft` (sinh lazy + tự tính) → `submitted` (Nộp; guard **từ NGÀY 3 tháng kế tiếp ICT** — validate s3 đổi từ ngày 1: `ictDateOnlyOf(now) ≥ firstOfNextMonth+2d`, cửa 48h creditFactor đã đóng nên số luôn đủ) → `confirmed` (GĐ thẩm định) → `approved` (chỉ qua `bulkApprove`).
- **Công thức phiếu (validate s3 — THAY công thức tuyến tính kpiMax cũ):** `value = min(1, shiftActual/shiftRequired) × min(1, metricValue/metricRequired) × tier.unitRate` (cap 100% cả hai %). Tham số yêu cầu từ `SalaryTier` của người (chưa gán tier → draft flag `tierMissing`, value 0).
- **Collector công ca — `collectActualShifts(tx, appUserId, period)` (rule chốt validate s4, thay midpoint R3-7):** đếm **DISTINCT (date, shiftTemplateId)** (R3-8) có `ShiftRegistrationEntry` thuộc registration `approved` VÀ đủ chấm: **punch VÀO** = punch sớm nhất ∈ [start−2h, midpoint) VÀ **punch RA** = punch muộn nhất ∈ [midpoint, end+2h]; xử ca theo thứ tự start, **punch đã dùng bị loại khỏi pool ca sau** (không tái dùng); sớm/muộn KHÔNG mất ca (phạt phút per-ca ở assemble lo). Span(out−in) < 50% thời lượng ca → set flag `shortSpanShifts` trên phiếu (GĐ soi gaming). Ngày có ticket approved = đủ chấm mọi ca đăng ký ngày đó. Logic gán punch↔ca đặt module dùng chung với penalty per-ca phase 2 (1 nguồn chân lý).
- **Override**: nguồn `submitted|confirmed` ONLY (approved bất biến); đích `confirmed`; set value (**≥ 0, KHÔNG cap — kpiMax đã bỏ, R3-5**) + `overrideReason` + `override=true`. **Anti-self: caller.appUser.id ≠ score.appUserId** (red-team #1).
- **Chặn theo payslip**: `confirm`/`override` bị FORBIDDEN khi Payslip (appUserId, period) đã `finalized` — muốn sửa phải reopen payslip trước (red-team #4). **Van sửa lỗi sau tất toán (R2 #H4): override TỪ `approved` chỉ cho super_admin VÀ payslip kỳ đó đang ở `draft` (đã reopen)** — chặn deadlock "approved bất biến + reopen được payslip" không tương thích.
- **KPI branch-scope (R2 #C6 — KHÔNG dùng `resolveShiftGroup(position)` cho caller):** caller scope theo ROLE như shift gate (shift/router.ts:249-253): GĐĐT → nhân viên nhánh GIAO_VIEN, GĐKD → KINH_DOANH; **target bucket** của nhân viên xác định bằng ROLE của target (giao_vien → GIAO_VIEN; sale → KINH_DOANH) — vì `position` là free-text không tin được. **2 GĐ + super_admin KHÔNG có phiếu KPI (validate s4 — lương ngoài hệ thống)** → không tồn tại nhánh "phiếu GĐ". Metric formula discriminator = ROLE (sale/giao_vien).
- **bulkApprove({period})**: chỉ quét phiếu `confirmed` của kỳ theo branch-scope trên, **loại phiếu của chính caller**, và **chỉ approve phiếu có Payslip (owner, period) đã `finalized`** (đúng ngữ nghĩa nút "Đã trả lương" — R2 #H4); phiếu chưa đủ điều kiện → skip + liệt kê trong response `{approved, skippedSelf, skippedUnfinalized[]}`; idempotent.
- Metric:
  - **sale** = SUM `Receipt.netAmount` WHERE status='approved' AND `approvedAt` trong kỳ ICT AND `createdByAppUserId = appUser.id` (backfill phase 1 đảm bảo; KHÔNG coalesce sang `createdById` — khác namespace). Docs gọi "doanh thu phê duyệt" (gross — user chốt).
  - **giao_vien** = Σ `(endTime − startTime) × creditFactor(doneAt, endTime)` các buổi `done` trong tháng ICT (bucket theo `sessionDate`) thuộc ClassBatch có `teacherAppUserId = appUser.id`. creditFactor import từ `packages/domain-time` (phase 7). Buổi pre-activation đã backfill done (phase 7) → creditFactor 1.0.
  - **GĐ/super_admin**: KHÔNG sinh phiếu — `refresh` target GĐ/super_admin → BAD_REQUEST (validate s4).
- Phiếu ghi đủ: `shiftActual/shiftRequired`, `metricValue/quotaSnapshot`, **`unitRateSnapshot` + `tierIdSnapshot`** (R3-9 — value tái lập được từ phiếu; đổi tier giữa kỳ: phiếu submitted+ giữ snapshot, QĐ docs/20), `value` (tiền phần nhân, **Number coercion + round half-up 0 lẻ VND trước persist — R3-13, tests assert exact**). Tier chưa gán → value 0 + flag `tierMissing` (không chặn tạo phiếu draft; chặn ở submitSlip).

## Procedures (contract — thay toàn bộ bảng cũ)
| Procedure | Input | Guard | Hành vi |
|---|---|---|---|
| `kpi.refresh` | `{period}` hoặc `{appUserId, period}` | key `kpi.refresh` (4 role). **`appUserId` khác caller → bắt buộc role GĐ/super_admin**, ngược lại ép `appUserId := caller` (red-team #2-SecAdv) | Upsert draft: `upsert` trên unique `[appUserId, period]`; update path guard `where status='draft'` + P2025 → no-op CONFLICT-safe (pattern payroll TOCTOU, router.ts:230-259 — red-team #8). Không đè submitted+ |
| `kpi.submitSlip` | `{period}` | owner (sale/GV); **từ ngày 3 tháng kế tiếp ICT**; status=draft; **tierMissing → BAD_REQUEST** | **Inline done-evaluate các buổi quá endTime của GV (R3-14, lưới khi sweep chậm) rồi tự refresh trong CÙNG tx** trước khi chuyển draft→submitted. Boundary mock clock: 2026-08-02T23:59+07 chặn / 2026-08-03T00:00+07 cho phép |
| `kpi.confirm` | `{kpiScoreId}` | key `kpi.confirm` + direct-manager (giữ) + anti-self + payslip chưa finalized | submitted→confirmed |
| `kpi.override` | `{kpiScoreId, value, overrideReason}` | key `kpi.approve` + **anti-self** + nguồn submitted\|confirmed + payslip chưa finalized | → confirmed, override=true |
| `kpi.bulkApprove` | `{period}` | key `kpi.bulkApprove` (2 GĐ) — branch-scope theo ROLE + loại self + **chỉ phiếu có payslip finalized** | confirmed→approved theo scope; trả `{approved, skippedSelf, skippedUnfinalized[]}` |
| `kpi.list` | `{period, status?}` | 2 GĐ — **filter branch-scope theo ROLE** (red-team #15, R2 #C6); super_admin full | inbox + tên/position (chỉ phiếu sale/GV — GĐ không có phiếu) |
| `kpi.myScore` | `{period}` | protected self (KHÔNG key mới — red-team #20) | phiếu của tôi + shiftActual/Required + metricValue/quotaSnapshot + tierMissing |

- **`kpi.submit` BỎ**; **`kpi.approve` (đơn lẻ) BỎ** (red-team #11 — approved chỉ qua bulkApprove); **`kpi.getForUser` BỎ, thay bằng `myScore` (self) + `list` (GĐ)** — gate cũ của getForUser tham chiếu key `kpi.submit` sẽ chết nếu giữ (red-team #10). UI callers: `kpi.tsx:79,84,96` (getForUser/confirm/approve) migrate ở phase 5; **`pnpm --filter @cmc/admin typecheck` chạy NGAY trong phase này** để lộ break sớm (build đỏ chấp nhận được nội bộ phase, PHẢI xanh trước khi kết phase — kpi.tsx được sửa tạm mức tối thiểu nếu cần).

## Related Code Files
- Create: `apps/api/src/kpi/auto-score.ts` (+`auto-score.test.ts`): `computeKpiValue({shiftActual, shiftRequired, metricValue, metricRequired, unitRate})` (pure, cap 100%×2), `collectSaleRevenue`, `collectTeacherHours`, `collectActualShifts` (vào/ra windows, dùng chung module gán punch↔ca với phạt per-ca phase 2)
- Create: `apps/api/src/kpi/lifecycle.test.ts`
- Modify: `apps/api/src/kpi/router.ts`
- **Rewrite toàn file**: `apps/api/src/kpi/override-tree.test.ts` — 8 call sites `kpi.submit` là seed primitive của mọi describe (red-team #10); seeding mới = seed receipts/sessions + `refresh`, hoặc helper insert KpiScore trực tiếp (test-only). Giữ coverage managerId-tree.
- Modify: `packages/auth/src/index.ts` + test: bỏ `kpi.submit`; thêm `kpi.refresh`+`kpi.submitSlip` (4 role), `kpi.bulkApprove` (2 GĐ); GIỮ `kpi.confirm`, `kpi.approve` (key dùng cho override)

## Implementation Steps (TDD)
1. Pure tests → `computeKpiValue` (biên: 0%, 50%×50%=25%, 100%×100%, vượt→cap, required=0/null, tierMissing).
2. Collector tests: sale namespace đúng (seed receipt createdByAppUserId); GV giờ×creditFactor (fixtures done phase 7); **côngca vào/ra windows** (đủ cặp vào+ra → tính dù muộn/sớm; 1 punch → ca vắng; punch không đăng ký → không; đăng ký không punch → không; ticket approved → credit mọi ca ngày đó; 2 ca GV liền kề: punch không tái dùng — mỗi ca cần cặp riêng; entry trùng template/ngày → DISTINCT đếm 1; span<50% → flag); refresh target GĐ → BAD_REQUEST.
3. Lifecycle tests: refresh concurrency (double-fire → không 500, không đè submitted); submitSlip boundary mock clock + auto-refresh-trước-nộp; confirm anti-self + sai manager FORBIDDEN; override nguồn/đích/anti-self/payslip-finalized + van super_admin-từ-approved-khi-reopen; bulkApprove branch-scope ROLE + loại self + chỉ-payslip-finalized + idempotent; list filter branch.
4. Rewrite override-tree.test.ts.
5. Implement router + auto-score. `gitnexus_impact` từng procedure cũ trước khi sửa.
6. `pnpm --filter @cmc/api test` + `pnpm --filter @cmc/admin typecheck`.

## Success Criteria
- [ ] Không tồn tại đường đi nào để 1 người tự đưa phiếu mình tới confirmed/approved (test khẳng định từng nhánh).
- [ ] Sale revenue test với dữ liệu backfill-shaped ra số đúng (không phải 0).
- [ ] assemble (phase 2) + refresh + bulkApprove chạy liên phase đúng số.
- [ ] Admin typecheck xanh khi kết phase.

## Risk Assessment
- Đổi 3 contract (bỏ submit/approve/getForUser) = breaking — stale browser tab sẽ nhận NOT_FOUND; chấp nhận hard cut (deploy cùng UI phase 5 trong 1 release train — plan chạy sau premium nên release gộp), ghi changelog.
- GĐ/super_admin không có phiếu (s4) — mọi confirm/override chỉ trên phiếu sale/GV; anti-self vẫn giữ (GĐ không tự chấm phiếu nhân viên nào là của mình vì không có).
- Receipt tạo bởi GĐ thay sale → KHÔNG rơi vào phiếu nào (GĐ không có phiếu — s4), doanh thu đó nằm ngoài KPI mọi sale — ghi unresolved: nghiệp vụ "sale phụ trách" cần field attribution riêng nếu muốn tính.
