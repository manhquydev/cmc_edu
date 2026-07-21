---
phase: 2
title: Synthetic-seed throwaway DB env + gate update
status: completed
priority: P2
dependencies:
  - 1
effort: 0.5-1 session
---

# Phase 2: Synthetic-seed throwaway DB env + gate update

<!-- Updated: Red Team R1 2026-07-18 — sentinel unique code, seed-constants module, positive ALLOW gate + shared guard thay name-check, psql thay createdb, dev-seed phải xanh trước -->

## Overview

Dựng năng lực môi trường DB throwaway synthetic-seed (gate 2 Phase 4): sentinel trong seed +
script dựng-lặp-lại-được + validate; cập nhật GATE section plan gốc với bằng chứng trung thực.

**Dependency scope (R2-M2):** frontmatter `dependencies: [1]` CHỈ áp cho **step 5 (gate update)**
— cần verdict phase 1. Steps 0-4 (seed fix + constants + guard extraction + script) độc lập file
và là **precondition provider** cho phase 1 khi máy chưa có env e2e (V1 escape hatch: dựng env
bằng script này trước rồi mới chạy reproduce phase 1). Executor được phép chạy 0-4 trước phase 1;
KHÔNG deadlock.

## Requirements

- Functional: sentinel Facility với **name marker VÀ unique `code` riêng** (R1-S2 — `Facility.code
  String @unique` bắt buộc, không default; schema.prisma:237, migration 20260706170000:26-30);
  constant marker ở **module side-effect-free riêng** (R1-A3/S3 — seed.mjs tự chạy main() ở
  :112, import = chạy seed); script end-to-end idempotent.
- Non-functional: KHÔNG local-sim/cmc_prod (D6); **guard đường GHI theo positive signal, KHÔNG
  name-check** (R1-S4 Critical — name-check bị socat decouple, đúng bài Safety Gate kế thừa đã
  bác); Git Bash + không docker-compose mới (F5).

## Architecture

```
packages/db/prisma/seed-constants.mjs (MỚI, side-effect-free):
  export const SYNTHETIC_SEED_FACILITY_NAME = '__SYNTHETIC_SEED__ — CMC EDU throwaway';
  export const SYNTHETIC_SEED_FACILITY_CODE = '__SYNTH__';

packages/db/prisma/seed.mjs:
  - import constants từ seed-constants.mjs
  - main() bọc entrypoint guard: if (import.meta.url === pathToFileURL(process.argv[1]).href)
    → import an toàn, chỉ chạy khi execute trực tiếp (R1-A3/S3)
  - sentinel find-or-create theo name, create data = { name, code: SYNTHETIC_SEED_FACILITY_CODE }
  - LƯU Ý R1-S2: dev-seed facility hiện create({ data: { name } }) THIẾU code bắt buộc —
    khả năng seed đã vỡ từ migration 20260706170000. Bước 0 verify; nếu vỡ → fix cùng đợt
    (thêm code deterministic cho dev-seed, vd 'DEVSEED').

apps/e2e/src/assert-not-prod.ts (MỚI — kéo extraction R2-8 plan gốc về sớm):
  export assertNotProdDatabase (chuyển từ global-setup.ts:52-66, exact-match pathname);
  global-setup.ts import lại từ đây (1 nguồn guard duy nhất).

scripts/synthetic-seed-env.sh (Git Bash):
  1. yêu cầu env: POSTGRES_ADMIN_URL + SYNTH_SEED_ALLOW=1 (positive signal — thiếu → abort)
  2. guard qua node one-liner dùng assert-not-prod.ts trên POSTGRES_ADMIN_URL VÀ target URL
     (name-check cmc_synth CHỈ là defense-in-depth phụ, KHÔNG phải control — comment rõ)
  3. tạo DB qua psql: psql "$POSTGRES_ADMIN_URL" -c 'CREATE DATABASE cmc_synth'
     (skip-if-exists; --fresh drop-recreate; KHÔNG dùng binary createdb — R1-A6)
  4. DATABASE_URL=...cmc_synth npx prisma migrate deploy (packages/db, 35 migrations có sẵn)
  5. node packages/db/prisma/seed.mjs
  6. verify: node one-liner query Facility code='__SYNTH__' → in id, exit 0/1
```

Gate update (F6 + R1-A2): plan gốc phase-04 GATE —
- Điều kiện 2 **✅** (bằng chứng: script + sentinel query output).
- Điều kiện 3 **◐ KHÔNG ✅** (R1-A2): fix P1 chỉ gỡ blocker `test.fixme`; test student-redirect
  KHÔNG phải business-flow evidence target (R2-10/11 phase-04 cấm dùng lms-login làm target);
  target hợp lệ (acceptance-evidence-p1.ui.spec.ts) là deliverable của chính Phase 4 step 3.
- Điều kiện 1 ⏳ PO-side.

## Related Code Files

- Create: `packages/db/prisma/seed-constants.mjs`
- Create: `apps/e2e/src/assert-not-prod.ts` (extraction R2-8 kéo về sớm)
- Create: `scripts/synthetic-seed-env.sh`
- Modify: `packages/db/prisma/seed.mjs` (entrypoint guard + sentinel + fix dev-seed code nếu vỡ)
- Modify: `apps/e2e/src/global-setup.ts` (import guard từ assert-not-prod.ts)
- Modify: `plans/260717-1213-so-nghiem-thu-song/phase-04-...md` (CHỈ mục GATE — F6)
- Modify: `README.md` (2 dòng cách dựng env)
- Check/Modify: `.gitattributes` (LF cho *.sh — bài học CRLF journal 260709)

## Implementation Steps

0. **Verify dev-seed hiện trạng** (R1-S2): chạy `node prisma/seed.mjs` trên dev DB → nếu throw
   thiếu `code` → dev-seed đã vỡ từ migration 20260706170000, fix (code 'DEVSEED') và ghi nhận
   finding; nếu xanh → tìm hiểu vì sao (điều tra trước khi build tiếp).
1. Tạo `seed-constants.mjs`; refactor seed.mjs: import constants + entrypoint guard + sentinel
   find-or-create (name + code); chạy 2 lần trên dev DB → idempotent, dev-seed không đổi;
   test import: `node -e "import('./packages/db/prisma/seed-constants.mjs').then(m=>console.log(m))"`
   không side-effect; import seed.mjs từ module khác KHÔNG chạy main (verify).
2. Extract `assert-not-prod.ts`; e2e specs chạy lại pass nguyên trạng (11 specs API nhanh đủ).
3. Viết `scripts/synthetic-seed-env.sh` theo architecture (ALLOW gate + node guard + psql);
   LF line-endings + .gitattributes rule nếu thiếu.
4. Chạy end-to-end: `--fresh` từ 0 → migrate 35 → seed → verify sentinel; chạy lần 2 idempotent.
   Negative tests: thiếu SYNTH_SEED_ALLOW → abort; URL trỏ tên cmc_prod → abort (guard);
   ghi output làm bằng chứng.
5. Cập nhật GATE section plan gốc (2 ✅, 3 ◐ kèm giải thích R1-A2, 1 ⏳) + README 2 dòng.
6. `pnpm acceptance:report` regenerate — expect 0 thay đổi flows (seed ngoài scan scope).

## Success Criteria

- [x] Dev-seed verdict: **VỠ** (`Argument code is missing`, Facility.code NOT NULL từ migration 20260706170000) — fixed (dev-seed code 'DEVSEED')
- [x] Import seed-constants.mjs (pure) và seed.mjs (entrypoint-guarded, argv[1]-undefined-safe) từ module khác: 0 side-effect (test tường minh)
- [x] Script: `--fresh` cold-path + idempotent pass; negative tests (no-ALLOW, prod-name) đều abort
- [x] Sentinel query được theo `code='__SYNTH__'` qua role `cmc_app` (restricted, RLS) — proves app role reads it
- [x] assert-not-prod.ts là nguồn guard duy nhất (global-setup import; script tsx dùng chung)
- [x] GATE section phase-04: 2 ✅, 3 ◐, 1 ⏳; không chạm gì khác
- [x] KHÔNG kết nối local-sim/cmc_prod — dùng container riêng cmc-synth-pg:55432

## Risk Assessment

- **Sentinel bị plant vào prod qua URL sai** (R1-S4) → 3 lớp: SYNTH_SEED_ALLOW positive signal,
  assert-not-prod guard cả 2 URL, name-check phụ. Sentinel theo `code` unique → nếu vẫn xảy ra,
  1 row `__SYNTH__` dễ phát hiện + xoá; Phase-4 gate 1 (assertNotProdDatabase) vẫn chặn prod
  theo lớp riêng.
- **Extraction assert-not-prod làm e2e regression** → chuyển nguyên văn function + import lại;
  11 API specs chạy xác nhận (nhanh, không cần UI build).
- **psql absent trên PATH Git Bash** → script fail sớm với message rõ yêu cầu postgres client;
  fallback docker-run độc lập ghi trong README (không đụng local-sim stack).
