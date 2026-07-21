---
phase: 1
title: Flow Manifest + Static Verifier
status: completed
priority: P1
dependencies: []
effort: 1-2 sessions
---

# Phase 1: Flow Manifest + Static Verifier

<!-- Updated: Red Team Session 2026-07-17 — scanner rewrite (appRouter/ts-morph), 3-way orphan, whitelist real namespaces, gitignore-first, root tsx -->

## Overview

Engine lõi: manifest khai báo 33 luồng nghiệp vụ (seed từ TL25 — đã có sẵn API + UI/URL + test spec per WF), verifier đối chiếu từng symbol với code thật tại HEAD, xuất JSON per-flow + orphan 3 chiều.

## Requirements

- Functional: per-flow structural status (`built` / `partial` / `missing`) + symbol thiếu; orphan detection **v1: tRPC procedures only** (R2-3 — route/model orphan defer v2, tránh noise + 3 whitelist ceremony; scanners route/prisma vẫn build vì verifier cần chúng cho expected-match).
- Non-functional: deterministic (đọc filesystem tại HEAD, không network, không phụ thuộc GitNexus); mode tĩnh < 30s.

## Architecture

```
flow-manifest.ts ──┐
                   ├─→ verify.ts ──→ acceptance-report/verification.json
code scanners ─────┘
  ├─ trpc-scanner:   parse appRouter trong apps/api/src/router.ts (ts-morph):
  │                  key của appRouter object = namespace DUY NHẤT đúng;
  │                  follow import → file router thật (bất kể tên file);
  │                  resolve mergeRouters(a,b) = hợp procedures cả hai;
  │                  1 file export nhiều router → map theo key, không theo file.
  │                  (D1 — KHÔNG glob tên file, KHÔNG regex-first: router.ts:18-46,
  │                  64 guardian mergeRouters, 78 exercise mergeRouters,
  │                  93-97 payroll→4 keys, 105-107 meeting→parentMeeting)
  ├─ route-scanner:  apps/admin/src/routes/index.tsx (parent prefixes) +
  │                  *.routes.tsx (segment TƯƠNG ĐỐI: path:'new', index:true)
  │                  → COMPOSE full path; apps/lms/src/routes/index.tsx tương tự
  └─ prisma-scanner: packages/db/prisma/schema.prisma → model names (regex `^model \w+` đủ — format Prisma chuẩn)
```

Manifest type:

```ts
interface FlowEntry {
  id: string;              // "P1-03" — mã WF từ TL25 (D2)
  displayName: string;     // "Duyệt phiếu kích hoạt học viên"
  cluster: 'P1' | 'P2' | 'P3' | 'P4' | 'ADMIN';
  actorRoles: string[];    // từ ROLES/ACTIVE_ROLES (packages/auth/src/index.ts:10,27 — verified)
  expected: {
    trpc: string[];        // "finance.receiptApprove" — namespace theo appRouter key
    uiRoutes: string[];    // "/finance/receipts/:id" — full path sau compose
    models: string[];      // "RefundRecord"
  };
  uiEvidenceSpec?: string; // "apps/e2e/tests/xxx.ui.spec.ts" (Phase 4 — UI specs only, D8)
}
```

ts-morph là **required dependency** của tool (không phải contingency — red-team #4 chứng minh regex không giải được mergeRouters/multi-export/namespace≠filename).

## Related Code Files

- Modify: `.gitignore` — **BƯỚC ĐẦU TIÊN, trước mọi code** (thêm `acceptance-report/`; hiện chưa có — .gitignore:1-139 verified) (red-team #10)
- Create: `scripts/acceptance-report/flow-manifest.ts`
- Create: `scripts/acceptance-report/scanners/trpc-scanner.ts`
- Create: `scripts/acceptance-report/scanners/route-scanner.ts`
- Create: `scripts/acceptance-report/scanners/prisma-scanner.ts`
- Create: `scripts/acceptance-report/verify.ts`
- Create: `scripts/acceptance-report/types.ts`
- Modify: `package.json` (root): thêm devDeps `tsx` + `ts-morph` (root hiện KHÔNG có tsx — chỉ apps/api + apps/e2e có; không có precedent script chạy TS ở root — red-team #15) + script `"acceptance:report": "tsx scripts/acceptance-report/verify.ts"`

## Implementation Steps

1. `.gitignore` thêm `acceptance-report/` — commit được ngay, trước mọi thứ khác.
2. Root package.json: devDeps `tsx`, `ts-morph` + script `acceptance:report`.
3. `types.ts` + `flow-manifest.ts` khung với 9 luồng P1 (TL25 §2 có sẵn procedure + URL + test per hàng — copy trực tiếp).
4. `trpc-scanner.ts` theo kiến trúc trên; kiểm chứng bắt buộc: scan ra **đúng tập 39 key** của appRouter (health + 38 mounted routers — R2-6b: assert exact key set đối chiếu router.ts:56-117, KHÔNG magic number) và resolve được `parentMeeting`, `payslip`, `exercise` (3 ca khó: rename, multi-export, mergeRouters). ts-morph giữ nguyên làm required (R2 verify: appRouter static, no dynamic composition — không hạ xuống regex).
5. `route-scanner.ts` (compose prefix — verify với `/finance/new`, `/finance/class-placement` từ finance.routes.tsx:18-40) + `prisma-scanner.ts`.
6. `verify.ts`: match expected vs scanned → per-flow status; orphan = procedure scan được không thuộc manifest entry nào (**v1 procedure-only** — R2-3; route/model orphan v2 khi có drift incident thật).
7. Whitelist orphan namespace hạ tầng — exact-match từ appRouter keys thật: `health`, `lmsAuth`, `audit`, `user`, `facilityNetwork` (KHÔNG `auth.*`/`security.*` — không tồn tại, red-team #14). Whitelist là const đơn giản, KHÔNG decay-unit-test ở v1 (R2-3).
8. **v1 ship tại đây với cụm P1 (9 luồng)** verified end-to-end (R2-2 — chống data-entry front-load trước khi scanner được chứng minh). P2 (8) / P3 (11) / P4 (5) / ADMIN thêm dần như routine sau khi v1 chạy — mỗi cụm 1 lần ngồi chép từ TL25 §2.
9. Test chống drift: đổi tên tạm 1 procedure → verify hàng đó `partial`, revert.

## Success Criteria

- [x] `.gitignore` chứa `acceptance-report/` TRƯỚC khi bất kỳ file output nào được tạo (anchored `/acceptance-report/` sau fix code-review — bản đầu bị unanchored ẩn nhầm source dir, đã sửa + verify bằng `git check-ignore`)
- [x] trpc-scanner ra đúng tập 39 key (exact set), đúng 3 ca khó (parentMeeting / payslip 4-key / exercise merged) — verified độc lập bởi tester-v1
- [x] route-scanner compose đúng full paths (spot-check 5 route admin + 2 lms) — verified: /finance/new, /finance/class-placement, /crm/*, /admin/students, /parent/home, /student/gifts
- [x] Manifest P1 (9 luồng) đầy đủ, verified end-to-end — 9/9 built, 0 unresolved
- [x] Drift test pass (bước 9); orphan procedure-only hoạt động, không false positive từ whitelist — chạy 2 lần độc lập (finance.receiptCreate, crm.opportunityCreate), cả 2 pass + revert sạch
- [x] Mode tĩnh < 30s — chạy trong vài giây

## Risk Assessment

- **ts-morph parse lỗi trên syntax lạ** → scope hẹp: chỉ cần resolve object literal appRouter + imports + mergeRouters calls; nếu gặp dynamic pattern không resolve được → in cảnh báo UNRESOLVED thay vì im lặng.
- **Manifest seed sai từ TL25** (docs từng drift) → verifier tự lộ: symbol khai không tồn tại → đỏ, sửa theo code. TL25 verified 2026-07-17 là khớp cao (33 luồng, cột API/UI/Test cụ thể).
- **Route compose lệch với URL runtime** (nested layout) → spot-check tay 7 routes ở bước 5; sai → sửa scanner trước khi mở rộng manifest.
