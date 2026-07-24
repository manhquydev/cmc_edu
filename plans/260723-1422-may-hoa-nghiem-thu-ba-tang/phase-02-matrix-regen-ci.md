---
phase: 2
title: "Matrix-regen check vào CI (đóng N5)"
status: done
priority: P2
dependencies: []
---

# Phase 2: Matrix-regen check vào CI (đóng N5)

> Độc lập đợt B và Phase 0 (red-team M4): chỉ đọc source bằng ts-morph, không cần
> DB/browser/matrix đã land. Khởi động được ngay.

## Overview

`apps/e2e/screen-role-matrix.json` là artifact commit trong git, sinh từ
`nav-registry.ts`, **không CI nào regenerate hay kiểm hạn** (nợ N5). Đã trôi
thật: bản commit vẫn khai `/finance/refund` có nav entry một ngày sau khi
`24ef2e3` gỡ entry — làm runbook §1 mang số sai. Phase này thêm bước CI:
regenerate rồi diff, lệch = fail.

## Requirements

**Functional** — bước CI chạy `generate-screen-role-matrix.ts` rồi
`git diff --exit-code apps/e2e/screen-role-matrix.json`; lệch ⇒ bước đỏ kèm hướng
dẫn "chạy regen + commit".

**Non-functional**
- Warn-first (`continue-on-error: true`) theo Q4, kèm comment ghi điều kiện nâng — dù check này deterministic, vẫn theo cùng nghi thức để một luật áp cho mọi gate.
- Không cần DB: generator chỉ đọc source bằng ts-morph.

## Architecture

Đặt trong job `typecheck-and-test` (job chặn merge) như một step riêng SAU
Install — vì khi được nâng, nó phải nằm ở job chặn; đặt ở job e2e
(`continue-on-error` cả job) thì nâng step vô nghĩa. Vấn đề timestamp:
`generatedAt` trong JSON đổi mỗi lần sinh ⇒ diff luôn lệch. Generator phải bỏ
`generatedAt` ra khỏi nội dung so sánh — hoặc (chọn cách này, ít xâm lấn nhất)
bước CI diff bằng `git diff -I '"generatedAt"'` để bỏ qua đúng dòng đó.

## Related Code Files

- Modify: `.github/workflows/ci.yml` — thêm step trong `typecheck-and-test`
- Đọc trước: `apps/e2e/src/generate-screen-role-matrix.ts` (xác nhận không cần DB/env)
- Không sửa: generator (trừ khi `git diff -I` không đủ — khi đó mới cân nhắc tách `generatedAt`)

## Implementation Steps

1. Chạy generator local 2 lần liên tiếp, diff — xác nhận chỉ `generatedAt` đổi. Nếu còn trường bất định khác (thứ tự pairs?), xử lý trước.
2. Thêm step CI sau Install, trước Typecheck:
   ```yaml
   - name: Screen-role matrix drift (non-blocking — see promotion note)
     continue-on-error: true
     run: |
       pnpm --filter @cmc/e2e exec tsx src/generate-screen-role-matrix.ts
       git diff -I '"generatedAt"' --exit-code apps/e2e/screen-role-matrix.json \
         || { echo "::warning::matrix drifted — run the generator and commit"; exit 1; }
   ```
3. Comment cạnh step: điều kiện nâng (≥2 tuần warn, 0 báo giả) — cùng văn phong khối `acceptance:report` ở `ci.yml:88-92`.
4. Thử nghiệm trên nhánh: sửa 1 entry nav → push → step phải warn. Hoàn nguyên.

## Success Criteria

- [x] Chạy generator 2 lần liên tiếp: diff (bỏ `generatedAt`) rỗng — check deterministic
- [x] Step CI hiện diện, warn khi matrix lệch (chứng minh bằng nhánh thử), xanh khi khớp
- [x] Điều kiện nâng ghi bằng văn bản trong ci.yml
- [x] Không đụng job e2e; `pnpm test` không đổi

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Generator cho output bất định (ngoài generatedAt) → warn liên tục, gate mất uy tín | TB | Bước 1 kiểm determinism trước khi wire |
| ts-morph chậm trong CI | Thấp | Đo ở bước thử; generator chỉ scan 2 entry file + nav-registry |
| Step warn bị bỏ qua mãi mãi | TB | Điều kiện nâng ghi sẵn; mục "Sau plan này" của plan.md yêu cầu ghi dữ liệu tuần vào changelog |
