# 0045 — Khóa học > Unit entitlement + dual access gates

Date: 2026-08-11

## Status

Accepted (owner decisions 2026-08-11 + LMS foundation spike plan).

> **Status sync 2026-08-12 (as-built):**
> - Range writers surface as **`lmsOps.*`** (e.g. `lmsOps.addWithUnits`, grant/revoke helpers), with
>   permission key `enrollment.grantUnits` — not a top-level `enrollment.grantUnits` procedure tree.
> - Money bridge: `grantUnitsFromReceipt` after provision (see `apps/api/src/lms-ops/grant-units.ts`).
> - **Teaching dual-gate** (attendance / roster / delivery) is live via `onRoster` + unit stamp.
> - **Homework dual-gate** (ADR 0038 open-tier ∩ ranges) is **deferred for production** until
>   `LMS_ENTITLEMENT_GATE` defaults on **and** product OK (flag currently default **off**).
> - **Trục unit thật KHÔNG liên tục** — xem điểm 6 dưới đây. Khung chương trình thật (96 unit)
>   đã nạp; Bright I.G thiếu `orderGlobal` 40, 44, 48, 52, 56.

## Context

Owner locked: teaching rights are **unit ranges inside a program/course axis**, not vague whole-class access. Live `cmc-lms` uses `EnrollmentUnitRange` + session unit stamps. Monorepo previously only had money-shell `Enrollment.status` (reserved/active) and ADR 0038 exercise open-tier.

## Decision

1. **Product axis:** Program (UCREA / BRIGHT_IG / BLACK_HOLE) → ordered units (`CurriculumUnit.orderGlobal`, unique per program). Facility `Course` remains ERP placement shell; unit math uses `ClassBatch.program` → units of that program.
2. **Dual gates (AND):**
   - Money/membership: `Enrollment.status = active` (primary writer: receipt provision ADR 0041; no client free-activate).
   - Teaching: session's stamped unit `orderGlobal` covered by some `EnrollmentUnitRange`.
3. **Procedure freeze (as-built names):**
   - `enrollment.enroll` → reserved seat only; **never** writes ranges.
   - **`lmsOps.addWithUnits`** / related `lmsOps.*` grant helpers → ranges only; requires active enrollment for roster; **sale excluded** (permission: `enrollment.grantUnits`).
   - Receipt path may call **`grantUnitsFromReceipt`** (idempotent money→range bridge).
4. **Fail-closed:** session without `curriculumUnitId` stamp ⇒ empty teaching roster for that session.
5. **ADR 0038:** still live for default homework open; kill-switch + optional entitlement flag — see 0038 Status banner. Foundation **does not** claim production dual-gate for exercises until flag policy changes.
6. **Tiến trình unit đi theo TRỤC UNIT CÓ THẬT, không cộng số nguyên** *(bổ sung 2026-08-12)*

   `orderGlobal` là **nhãn định danh**, không phải số đếm liên tục. Khung chương trình thật có
   lỗ hổng đánh số (Bright I.G: 37–59 thiếu 40, 44, 48, 52, 56). **Lỗ hổng không phải là unit.**

   Gọi `axis` = danh sách `orderGlobal` **có thật** của chương trình, sắp tăng dần.

   | Phép tính | Luật |
   |-----------|------|
   | Unit của buổi thứ `k` (đếm từ neo, bỏ buổi đã hủy) | `axis[chỉSốCủa(neo) + floor(k / 4)]`, kẹp tại phần tử cuối của `axis` |
   | Cấp gói `N` unit | `N` phần tử **liên tiếp trên `axis`** kể từ vị trí bắt đầu — **bỏ qua lỗ hổng**, không phải `từ + N - 1` |
   | Số unit còn lại của một dải | Đếm phần tử của `axis` nằm trong dải — **không** đếm mọi số nguyên giữa hai đầu mút |
   | Neo không nằm trên `axis` | **Ném lỗi**, không im lặng bỏ qua |

   Hệ quả: một dải `[37..48]` của Bright I.G chứa **9 unit thật**, không phải 12.
   Nơi cài đặt: `packages/domain-lms/src/unit-progression.ts` (`ProgramUnitAxis`) và
   `package-grant.ts`. Bằng chứng: `apps/api/src/lms-ops/bright-ig-gaps.int.test.ts`.

   > Bất biến của [ADR 0046](./0046-order-global-stability.md) không đổi: cấm đánh số lại
   > dưới các dải đã bán.

## Consequences

- Schema: `EnrollmentUnitRange.facilityId` + FORCE RLS; ClassBatch neo anchors; non-null orderGlobal.
- Refund (later): revoke unlearned units from next; never erase attendance history.
- Break-glass (later): create identity without range ⇒ no learn until grant.
