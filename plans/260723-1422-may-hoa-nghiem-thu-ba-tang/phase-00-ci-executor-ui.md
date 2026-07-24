---
phase: 0
title: "CI executor cho UI specs (tiên quyết)"
status: done
priority: P1
dependencies: []
---

# Phase 0: CI executor cho UI specs (tiên quyết)

## Overview

Red-team C1: `ui-chromium` chỉ đăng ký khi `PLAYWRIGHT_UI=1`
(`playwright.config.ts:60-73`), và ci.yml **không set biến này** (0 lần). Capture
lẫn journey vì thế chỉ chạy tay ở máy dev — điều kiện nâng gate Q4 "≥2 tuần warn
chạy trong CI" **bất khả thi từ cấu trúc**. Phase này dựng nơi chạy trước, để mọi
tầng sau có nghĩa. Không có Phase 0, cả plan lặp đúng lỗi "lưới không ai giăng".

## Requirements

**Functional** — một job CI (hoặc bước trong job e2e) chạy `PLAYWRIGHT_UI=1` với
`--project=ui-chromium` trên **một UI spec sẵn có** (`admin-shell.ui.spec.ts`
hoặc `lms-login.ui.spec.ts`), có `playwright install chromium`, warn-first.

**Non-functional**
- **Không** đưa secret prod thật vào CI (red-team H4): stack e2e dùng dev-header/dev session mode (`global-setup.ts` đã mint qua `mintStaffCookie` với secret dev-default). "prod-config" ở đây nghĩa là **build production của admin/lms + API thật**, KHÔNG phải `NODE_ENV=production` (boot-checks chặn dev secret ở prod — `boot-checks.ts:128-137`). Ghi rõ định nghĩa này trong job.
- Warn-first (`continue-on-error: true`) + điều kiện nâng bằng văn bản (Q4).

## Architecture

Job mới `ui-e2e` cạnh job `e2e` hiện có, cùng service Postgres + migrate +
`cmc_app` password (copy từ `typecheck-and-test`). Thêm `pnpm exec playwright
install --with-deps chromium` (job e2e hiện KHÔNG cài browser — đó là lý do nó
API-only). Chạy: `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium
<spec sẵn có>`. Preview server (admin `4173`, lms tương ứng) do `uiServers` của
config tự khởi khi `PLAYWRIGHT_UI=1` — xác nhận cổng + build step preview cần gì.

Đây là **đường ray** cho Phase 1/4/5: chúng chỉ thêm spec vào project đã chạy được,
không phải dựng lại hạ tầng CI.

## Related Code Files

- Modify: `.github/workflows/ci.yml` — job `ui-e2e` mới
- Đọc trước: `apps/e2e/playwright.config.ts:40-95` (uiServers, project gate, preview cổng), `.github/workflows/ci.yml:97-155` (job e2e mẫu + service pattern), `apps/e2e/src/global-setup.ts` (env cần)
- Không sửa: config playwright (trừ khi preview cổng cần expose), app code, auth

## Implementation Steps

1. Đọc config: xác nhận `uiServers` khởi những preview nào, cổng, cần build gì trước (admin `vite preview` cần `vite build`?).
2. Chạy local đúng lệnh CI dự kiến: `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium admin-shell.ui.spec.ts` — đo thời lượng, xác nhận xanh.
3. Thêm job `ui-e2e` vào ci.yml: service pg + migrate + password + build + `playwright install chromium` + lệnh trên. `continue-on-error: true`.
4. Comment ghi định nghĩa "prod-config cho CI" (build production, KHÔNG NODE_ENV=production) và điều kiện nâng gate (≥2 tuần warn, 0 báo giả).
5. Push nhánh thử: job chạy, xanh trên spec sẵn có. Đo thời lượng thật (dữ liệu cho quyết định job riêng vs gộp ở Phase 5).

## Success Criteria

- [x] Job `ui-e2e` chạy `PLAYWRIGHT_UI=1 --project=ui-chromium` trên spec UI sẵn có, xanh
- [x] Có `playwright install chromium`; preview server khởi đúng cổng
- [x] Không secret prod thật trong CI; định nghĩa "prod-config" ghi trong job
- [x] `continue-on-error: true` + điều kiện nâng bằng văn bản
- [x] Thời lượng job đo được, ghi vào báo cáo phase

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Preview server không khởi trong CI (thiếu build) | Cao | Bước 1 xác nhận build step; bước 2 chạy local đúng lệnh CI |
| `playwright install` chậm/nặng CI | TB | Cache theo action pattern; chỉ chromium, không all browsers |
| Job mới bị `continue-on-error` che lỗi mãi mãi | TB | Điều kiện nâng ghi sẵn; mục "Sau plan này" đòi ghi dữ liệu tuần |
| Hiểu "prod-config" thành `NODE_ENV=production` ⇒ boot-check chặn | Cao | Định nghĩa rõ trong comment job (build production ≠ NODE_ENV production) |
