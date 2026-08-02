---
title: "Phase 2: Husky + lint-staged pre-commit"
status: todo
priority: P2
effort: "2h"
dependencies: [1]
---

# Phase 2: Husky + lint-staged pre-commit

## Overview

Pre-commit hook nhanh (giây, không phút) chạy eslint trên file staged + gitleaks
protect-staged. Bắt lỗi lint/secret trước khi vào repo. Typecheck đầy đủ **giữ ở CI**
(monorepo tsc chậm) — theo nguyên tắc pre-commit-phải-nhanh (nếu chậm dev sẽ `--no-verify`).

## Requirements
- Functional: `git commit` → eslint --fix trên `*.{ts,tsx,js,mjs,cjs}` staged; gitleaks quét staged; fail thì chặn commit.
- Non-functional: hoàn tất < vài giây trên diff thường; free/local.

## Architecture
- husky v9 (`husky init`) tạo `.husky/pre-commit`.
- Root `package.json`: thêm devDeps `husky`, `lint-staged`; thêm script `"prepare": "husky"`.
- lint-staged config (root `package.json` khối `lint-staged`): **`"apps/{admin,lms}/**/*.{ts,tsx}": "eslint --no-warn-ignored --max-warnings=0"`**.
  - ⚠️ **RED-TEAM C1 (đã chứng minh):** dùng glob `"*.{ts,tsx,...}"` toàn repo là SAI — ESLint 10 flat config chỉ cấu hình cho `apps/admin`,`apps/lms`,`scripts`; file staged ngoài đó bị báo "File ignored" (warning) và `--max-warnings=0` fail EXIT=1 → chặn gần như MỌI commit → dev quen `--no-verify` → vô hiệu cả gitleaks-staged. Fix: scope glob về đúng root có config + `--no-warn-ignored`. Đã verify EXIT=0 ngoài scope, vẫn error đúng lỗi lint trong scope.
- `.husky/pre-commit`: `pnpm exec lint-staged` + `gitleaks protect --staged --redact` (dùng `.gitleaks.toml` từ Phase 1).

## Related Code Files
- Modify: `package.json` (devDeps + `prepare` + `lint-staged` block)
- Create: `.husky/pre-commit`

## Implementation Steps
1. `pnpm add -Dw husky lint-staged` (root/workspace).
2. Thêm `"prepare": "husky"` vào scripts; chạy `pnpm run prepare` để init `.husky/`.
3. Viết `.husky/pre-commit`: `pnpm exec lint-staged` rồi `gitleaks protect --staged --redact`.
4. Thêm khối `lint-staged` vào `package.json` — glob scope `apps/{admin,lms}/**` + `--no-warn-ignored` (C1), chỉ eslint (KHÔNG tsc, xem Design note).
5. Test: sửa 1 file .ts thêm lỗi lint + 1 file cắm secret giả → commit phải bị chặn; `--no-verify` bỏ qua được (chủ ý).

## Design note (cần validate xác nhận)
- **tsc KHÔNG chạy ở pre-commit.** Lý do: `tsc --noEmit` per-file không đáng tin trong monorepo project-references và mất nhiều giây→phút → dev bypass. Typecheck đã có ở CI (`pnpm typecheck`, blocking). Giữ pre-commit nhẹ = eslint + gitleaks. Nếu bạn vẫn muốn tsc ở commit, sẽ chậm rõ rệt.

## Success Criteria
- [ ] Commit file .ts lỗi lint → bị chặn
- [ ] Commit file có secret giả → gitleaks chặn
- [ ] Commit sạch → qua nhanh (< ~5s diff thường)
- [ ] `prepare` script khiến clone mới tự cài hook sau `pnpm install`

## Risk Assessment
- **Hook chậm → bypass:** giữ eslint-only + gitleaks-staged; không thêm tsc/test nặng.
- **eslint flat config (v10) trên staged path ngoài apps/admin,lms,scripts:** xác nhận `eslint <file>` áp đúng config; nếu file ngoài scope cấu hình, cân nhắc `--no-error-on-unmatched-pattern`.
