---
phase: 6
title: "Nhip B - luoi an toan CI"
status: completed
priority: P2
dependencies: [3]
---

# Phase 6: Lưới an toàn CI

## Overview

Gate quan trọng nhất của sổ nghiệm thu — **orphan chưa phân loại** — hiện chỉ `console.warn`, và CI không chạy `acceptance:report` lẫn lint. Thêm vào đó, chính thư mục chứa công cụ nghiệm thu (`scripts/`) nằm **ngoài mọi lưới an toàn**.

*(Bản đầu của phase này viết "`verify.ts` chưa từng exit non-zero" — **sai**, xem Architecture. Nó có 4 `throw`; chỉ đường orphan là thiếu.)*

Phase này cho gate một chỗ để chạy. Không thêm gate mới — chỉ làm cho cái đã có có hiệu lực.

## Requirements

**Functional**
- `scripts/` được typecheck và lint.
- CI chạy `acceptance:report`.
- `verify.ts` exit non-zero khi có vi phạm (hiện chỉ `console.warn`).

**Non-functional**
- Không làm CI chậm đáng kể.
- Không biến CI thành đỏ kinh niên vì nợ có sẵn — nếu `scripts/` lint ra hàng loạt lỗi cũ, xử lý riêng.

## Architecture

Hiện trạng đã xác minh:
- `.github/workflows/ci.yml`: install → migrate → **typecheck → test → coverage**. Không lint, không `acceptance:report`. **CÓ job e2e** nhưng `continue-on-error: true` (cố ý non-blocking, `ci.yml:18-20,87-88`) — bản đầu của phase này viết "không e2e", **sai**.
- `package.json`: `lint = eslint apps/admin apps/lms` — `scripts/` và `packages/` ngoài phạm vi.
- `scripts/` không có `tsconfig.json`, không nằm trong `pnpm-workspace` (chỉ `apps/*`, `packages/*`); `acceptance:report` chạy qua `tsx` (transpile-only, không type-check).
- `verify.ts` **có 4 `throw`** (`:107, :116, :124, :135` — whitelist/gap chết, flow rỗng) nên **đã** exit non-zero ở những đường đó. Bản đầu viết "chưa từng exit non-zero", **sai**. Cái thiếu hẹp hơn: **đường orphan chưa phân loại** chỉ `console.warn` (`:160-172`).

**Phụ thuộc Phase 3:** phase đó thêm một procedure mới; nếu chưa khai vào `flow-manifest.ts` thì việc bật exit-code ở đây làm CI đỏ ngay. Baseline: 1 orphan, **0 chưa phân loại**, exit 0 — repo ở đúng ngưỡng, một procedure mới là vượt.

**Thứ tự an toàn:** đưa `scripts/` vào lưới **trước**, sửa exit code **sau**. Ngược lại sẽ có lúc CI đỏ vì lỗi type trong chính file vừa được yêu cầu chặn CI.

**Câu hỏi cần PO:** gate `acceptance:report` **chặn merge** hay chỉ cảnh báo? Mặc định plan giả định **cảnh báo trước, chặn sau** — chặn ngay khi chưa biết tần suất báo động giả là cách nhanh nhất khiến team tắt gate.

## Related Code Files

- Create: `scripts/tsconfig.json`
- Modify: `package.json` — mở rộng `lint`, có thể thêm `typecheck:scripts`
- Modify: `pnpm-workspace.yaml` — thêm dòng `- scripts` (**không** `scripts/*`)
- Create: `scripts/package.json` (bắt buộc, để turbo nhận workspace member)
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/acceptance-report/verify.ts` — exit code
- Modify: `eslint.config.js` (nếu cần phạm vi mới)

## Implementation Steps

1. ⚠️ **Bước 1 và 2 phải nằm trong MỘT commit, không tách.** Nếu commit riêng bước 1, `scripts/` thành workspace member mang theo lỗi type tồn đọng ⇒ `pnpm typecheck` (= `turbo run typecheck`) đỏ repo-wide ⇒ Phase 1–3 không đóng được tiêu chí "typecheck xanh" vì lý do chẳng liên quan gì tới chúng.

   Thêm `scripts/tsconfig.json` (kế thừa `tsconfig.base.json`) **và `scripts/package.json`** — turbo không nhận `tsconfig.json` đơn lẻ nếu thư mục không phải workspace package.

   ⚠️ **Dùng `scripts` (không có `/*`).** `pnpm-workspace.yaml` hiện đúng 2 dòng: `apps/*`, `packages/*`. Glob `scripts/*` sẽ match các **thư mục con** (`scripts/acceptance-report/`, `scripts/bin/`, `scripts/schema/`) chứ **không** match `scripts/package.json` ở gốc ⇒ `pnpm install` lặng lẽ bỏ qua, turbo không thấy `scripts/`, và tiêu chí "scripts/ được typecheck" được tick chỉ vì ai đó chạy `tsc --noEmit` bằng tay một lần.

   Chạy `tsc --noEmit` → **kỳ vọng có lỗi tồn đọng**; ghi lại số lượng.
2. Sửa các lỗi type trong `scripts/` (hoặc khoanh vùng nếu quá nhiều — ghi rõ phần khoanh và lý do, không `// @ts-nocheck` hàng loạt).
3. Mở rộng `lint` để phủ `scripts/`. Xử lý lỗi tương tự bước 2.
4. Nối `typecheck` của `scripts/` vào `pnpm typecheck` (qua workspace hoặc script riêng trong CI).
5. Sửa `verify.ts`: exit non-zero khi có orphan **chưa phân loại** hoặc unresolved namespace. Giữ nguyên hành vi in báo cáo.
6. Thêm bước `acceptance:report` vào `ci.yml`. Mức chặn/cảnh báo theo quyết định PO.
7. Thêm bước `lint` vào `ci.yml` (hiện hoàn toàn không có).

## Test / Validation

- **Falsification:** tạo tạm một orphan procedure chưa phân loại → `pnpm acceptance:report` phải **exit ≠ 0**; hoàn nguyên.
- **Falsification 2:** thêm tạm lỗi type vào `scripts/` → `pnpm typecheck` phải đỏ; hoàn nguyên.
- Chạy CI trên một PR nháp → xác nhận các bước mới thực sự chạy và thời gian chấp nhận được.

## Success Criteria

- [ ] `scripts/` được typecheck; falsification test chứng minh lỗi type ở đó làm đỏ CI
- [ ] `scripts/` được lint; `lint` có trong CI
- [ ] `verify.ts` exit non-zero khi có vi phạm (đã chứng minh bằng falsification test)
- [ ] `acceptance:report` chạy trong CI, mức chặn/cảnh báo theo quyết định PO
- [ ] Nợ type/lint tồn đọng trong `scripts/` đã xử lý hoặc khoanh vùng có lý do ghi rõ
- [ ] Thời gian CI tăng không đáng kể

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| `scripts/` lint/type ra hàng loạt lỗi cũ → CI đỏ kinh niên → team tắt gate | **Cao** | Bước 1 đo trước số lượng; nếu quá nhiều thì khoanh vùng có lý do thay vì tắt kiểm tra |
| Chặn merge ngay khi chưa biết tần suất báo động giả | Cao | Mặc định cảnh báo trước; nâng lên chặn sau khi có dữ liệu — nhưng để PO quyết |
| Sửa exit code trước khi `scripts/` sạch → CI đỏ vì chính file vừa thêm | Trung bình | Thứ tự bắt buộc: lưới trước, exit code sau |
| **Commit bước 1 riêng ⇒ `pnpm typecheck` đỏ repo-wide, chặn Phase 1–3 đóng** | **Cao** | Bước 1+2 là một commit không tách rời (đã ghi trong step 1) |
| Glob `scripts/*` không match `scripts/package.json` ⇒ gate im lặng không chạy | **Cao** | Dùng `scripts` không glob; kiểm bằng `pnpm ls -r --depth -1` thấy package mới |
| `// @ts-nocheck` hàng loạt để cho nhanh | Trung bình | Cấm rõ trong bước 2; khoanh vùng phải có lý do từng chỗ |
