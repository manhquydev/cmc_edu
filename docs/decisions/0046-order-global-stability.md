# 0046 — orderGlobal stability for sold unit rights

Date: 2026-08-11

## Status

Accepted.

> **Status sync 2026-08-12 — trục unit KHÔNG liên tục:** khung chương trình thật đã được nạp
> (96 unit từ CSV) và **`orderGlobal` có lỗ hổng**: Bright I.G chạy 37–59 nhưng **thiếu
> 40, 44, 48, 52, 56**. Điểm 4 bên dưới ("contiguous 1..N") chỉ còn đúng cho seed thử nghiệm,
> **không phải** cho dữ liệu thật.
>
> Hệ quả đã sửa trong code: mọi phép "tiến k unit" nay là **dịch k vị trí trên trục unit có thật**
> của chương trình, không phải cộng k vào số. Lỗ hổng trong đánh số **không phải** unit.
> Xem `packages/domain-lms/src/unit-progression.ts` (`ProgramUnitAxis`) và
> `apps/api/src/lms-ops/bright-ig-gaps.int.test.ts`.
>
> Bất biến của ADR này **không đổi**: `orderGlobal` vẫn là danh tính quyền học, vẫn duy nhất theo
> `(program, orderGlobal)`, và vẫn cấm đánh số lại dưới các dải đã bán.

## Context

Sold unit ranges store **integers** (`fromOrderGlobal`..`toOrderGlobal`). Shifting order under live ranges silently changes who may attend.

## Decision

1. `CurriculumUnit.orderGlobal` is the entitlement identity within a `Program`.
2. Uniqueness: `(program, orderGlobal)`.
3. Changing order under existing ranges requires an explicit remap procedure (out of foundation spike); seeder/CI must not silently renumber sold axes.
4. Spike/test seed: assign contiguous orderGlobals per program (1..N).

## Consequences

Foundation migration backfills existing rows by level/monthIndex order. Product CSV import (later) must assert stability or remap.
