---
phase: 1
title: "Trust meter + ledger thật"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Trust meter + ledger thật

## Overview

Operator chạy một lệnh và thấy trạng thái HEAD theo class bằng chứng. Cùng PR: sửa nhãn ledger cho khớp call-site — **claim procedure trên flow rồi mới xóa `DOCUMENTED_GAPS`**.

## Requirements

- Functional: `pnpm verify:system` in JSON (+ HTML tối thiểu); mỗi dòng có claim, command, SHA, proof class, blocking/advisory.
- Functional: Proof class chỉ `behavior` | `source-string` | `ci-artifact` | `unmeasured`. Cấm `docs`.
- Functional: So sánh SHA của `apps/e2e/acceptance-results/journeys.json` với `git rev-parse HEAD` (full). `verification.json.commit` (short, luôn khớp sau khi tự chạy report) **không** phải evidence.
- Functional: Mismatch / thiếu `journeys.json` → L3/L4 = `unmeasured`. **Không** gọi `business:verify --strict` local.
- Functional: Mỗi key xóa khỏi `DOCUMENTED_GAPS` phải đã nằm trong `expected.trpc` của một flow. Xóa không claim → orphan ratchet đỏ `ui-e2e`.
- Non-functional: không hạ required checks; không invent CI job mới.

## Architecture

Orchestrator Node (cùng kiểu `scripts/check-ui-frames.mjs`) gọi lệnh đã có, ghi `acceptance-report/system-verification.json` (gitignored). HTML đọc file đó.

In đúng YAML: `acceptance:report` advisory trong `ci.yml:140-142`, BLOCK trong `ui-e2e.yml:197-200`.

## Related Code Files

- Create: `scripts/verify-system.mjs` (hoặc `scripts/system-verify/verify.ts`), `package.json` script `verify:system`
- Modify: `scripts/acceptance-report/flow-manifest.ts` — P2-01 `expected.trpc` đổi sang `lmsOps.createClassWithUnits`; P2-01/02 `no-ui-path`; P2-03 **chỉ** reason text
- Modify: `scripts/acceptance-report/verify.ts` — `DOCUMENTED_GAPS` **sau** khi key đã vào manifest
- Modify: YAML stale 0053 / 1018 / 0120 (status only)
- Do not: `packages/ui/**`, session-detail, `business:verify --strict` trong meter

## Implementation Steps

1. Fast-forward local `develop` to `origin/develop` (≥ `7227676`).
2. Script bọc: `typecheck`, `lint`, `check:ui-frames --json`, `check:ui-ratchet`, `check:ui-a11y-roles`, `check:doc-authority`. Class `source-string` cho bốn check UI/docs.
3. Đọc `journeys.json` metadata SHA. Khớp HEAD → in ledger class `ci-artifact`. Không khớp / thiếu file → L3/L4 `unmeasured`, ghi “dùng artifact ui-e2e”. Không chạy `--strict`.
4. Inventory `@cmc/ui` ADVISORY.
5. P2-01: `expected.trpc` = `lmsOps.createClassWithUnits` (UI `classes/index.tsx:260`). `classBatch.create` còn live API → để GAPS hoặc flow khác, **không** im lặng. P2-03: sửa *reason* (assignUnit staff đã có); **giữ** `no-ui-path`. P2-02: nếu picker đủ thì bỏ `no-ui-path`, ghi thiếu journey.
6. Với mỗi gap UI-đã-có (`course.create`, `lmsOps.createClassWithUnits`, `cancelSessionAndRestamp`, `rosterForSession`, `curriculumUnit.list`): **thêm vào `expected.trpc` của flow thật**, rồi xóa key GAPS. Giữ `deliverSessionExercise` / `grantPast` / `revokeFromNext` / `schedule.*Slot` đến phase 02.
7. YAML stale: 0053 completed; 1018 ignore-stale; 0120 leftover focus-visible.

## Success Criteria

- [x] `pnpm verify:system` exit 0 trên HEAD sạch **kể cả khi** L3/L4 `unmeasured`
- [x] Meter không invoke `business:verify --strict`
- [x] Không dòng nào lấy số từ `plans/reports/*.md`
- [x] `rg no-ui-path` không còn P2-01 (và P2-02 nếu picker đủ). **P2-03 vẫn `no-ui-path`**
- [x] `pnpm acceptance:report` exit 0: **0 untriaged orphans** và 0 dead gap keys
- [x] `typecheck-and-test` vẫn chứa các check cũ

## Risk Assessment

Xóa GAPS trước khi claim = `ui-e2e` đỏ (`verify.ts:419-426`). Meter tin `verification.json.commit` = luôn “khớp” sau self-run — cấm.
