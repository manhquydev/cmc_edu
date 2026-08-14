# Phase 01 — Verify live + pin unit gates

**Plan:** [plan.md](./plan.md)

## Overview

Không cần sửa layout/token runtime trừ khi re-audit fail. Khóa regression bằng unit pins + cập nhật INDEX audit.

## Requirements

- [x] Rebuild local-sim admin từ `develop` tip #139
- [x] Re-run `LOCAL_SIM_LIVE=1 node scripts/live-openeducat-ui-audit.mjs` → list CP 58, blue 0
- [x] `console-cp-sheet.test.ts`: pin `flex-direction: row`, `height`/`max-height` via `--console-cp-height`
- [x] `console-precedence.test.ts`: pin shell `--cmc-brand` / `--color-accent` → `#71639e`; outside giữ `#0071e3`
- [x] Update `live-ui-audit-260814-0945/INDEX.md` success metrics + next steps
- [x] `pnpm` vitest packages/ui cho các suite trên

## Files

- `packages/ui/src/console/console-cp-sheet.test.ts`
- `packages/ui/src/console/console-precedence.test.ts`
- `plans/reports/live-ui-audit-260814-0945/INDEX.md`
- `plans/reports/cook-260814-openeducat-p0-cp-cta.md` (evidence)

## Acceptance

- Unit pins fail nếu revert densify/accent remaps
- INDEX phản ánh re-measure 11:21 (P0 CP+CTA = MATCH)
