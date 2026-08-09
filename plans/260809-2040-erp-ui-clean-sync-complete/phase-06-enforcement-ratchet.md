---
phase: 6
title: "Enforcement ratchet"
status: pending
priority: P1
effort: "1d"
dependencies: [5]
---

# Phase 6: Rào chặn (ratchet + stylelint)

## Overview

Không có rào chặn thì mọi thứ vừa dọn sẽ lệch lại. Hai công cụ cho hai vấn đề khác nhau.

## Requirements

- Functional: CI **fail khi vi phạm tăng**; không ép dọn nợ cũ.
- Non-functional: 0 false positive trên code hợp lệ.

## Architecture

### 6a. Ratchet cho tầng app (`apps/admin/src`)

Script noi theo pattern có sẵn trong repo (`scripts/check-ui-frames.mjs` + `.test.mjs`,
`scripts/check-ui-a11y-roles.mjs` + test) — script kèm test riêng, nối CI. Đếm vi phạm **theo
từng file** so `ratchet-baseline.json` đã commit; fail nếu file nào **tăng**.

**CHỈ đếm property token hoá được:** spacing (margin/padding/gap), typography (fontSize), radius, color.

**BẮT BUỘC miễn trừ** (không miễn trừ thì rule kêu oan ~408 chỗ hợp lệ và plan chết):
- **Layout ngữ nghĩa:** `display`, `flex`, `flexWrap`, `flexDirection`, `flexShrink`, `alignItems`, `alignSelf`, `justifyContent`, `overflow`, `position`, `cursor`
- **Typography ngữ nghĩa:** `textTransform`, `fontWeight`, `fontVariantNumeric`, `letterSpacing`, `textAlign`, `textDecoration`, `whiteSpace`, `wordBreak`
- **Giá trị tính toán:** mọi thứ chứa `var()`, `calc()`, `%`
- **Width/height:** **miễn trừ vĩnh viễn theo quyết định operator** — không lập thang mới, không đưa vào ratchet.

### 6b. Stylelint cho `packages/ui/src/console.css`

`declaration-property-value-allowed-list` ghim giá trị px về thang, **baseline đóng băng** —
chặn giá trị lệch **mới**, không ép dọn giá trị cũ nhất quán.

> 🔴 **Hai điều kiện tiên quyết — 6b không khởi động được nếu thiếu:**
> 1. **stylelint chưa được cài** ở bất kỳ manifest nào trong repo. Đây là việc **thêm toolchain
>    mới** (cài, cấu hình, nối CI, xử lý false positive lần đầu).
> 2. **Thang type phải đã thành token** (Phase 5 bước 0) trước khi viết allow-list.
>
> Nếu một trong hai chưa xong: **làm 6a trước, hoãn 6b** — 6a độc lập hoàn toàn.

> **Nợ được ghi nhận, không bỏ quên:** ~400 giá trị px cứng nhưng **nhất quán** trong
> `console.css` (padding 125, gap 131, font-size 109, radius 62, margin 23 — chỉ 127 dùng
> `var()`) **cố ý không dọn tay**. Baseline đóng băng giữ chúng nguyên trạng và chặn phát sinh
> mới. `999px` (console.css, 29 chỗ) vs `9999px` (`tokens.css:81`) — cùng kết quả hiển thị,
> thuộc nhóm nợ này, không phải typo cần sửa gấp.

## Related Code Files

- Create: `scripts/ui-ratchet.mjs` + `.test.mjs`, `scripts/ratchet-baseline.json`
- Modify: `.github/workflows/*` (thêm bước ratchet vào job `typecheck-and-test`)
- Create/Modify: cấu hình stylelint cho `packages/ui` (cài mới, chưa tồn tại)

## Implementation Steps

1. Viết `ui-ratchet.mjs` — parse bằng **khớp ngoặc** (không regex dòng đơn).
2. Sinh baseline từ trạng thái hiện tại (sau Phase 5); commit.
3. Verify chống false positive: chạy trên HEAD → phải **0 vi phạm mới**. Thử thêm 1 vi phạm giả → phải fail.
4. Thêm vào CI.
5. Cài stylelint (toolchain mới); cấu hình cho `console.css` + baseline đóng băng.

## Success Criteria

- [ ] Ratchet chạy trong CI, fail khi bất kỳ file nào tăng vi phạm.
- [ ] Chạy trên HEAD sạch → **0 false positive** (kiểm chứng bằng cách chạy thật).
- [ ] Thêm vi phạm giả → CI fail (kiểm chứng bằng commit thử).
- [ ] Stylelint chặn px lệch thang **mới** trong `console.css`; giá trị cũ không bị ép sửa.
- [ ] Baseline commit vào repo, có comment giải thích cách hạ.
- [ ] Width/height xác nhận **miễn trừ** trong code rule, không phải bỏ sót.

## Risk Assessment

- **False positive giết rào chặn.** Mitigation: danh sách miễn trừ ở trên là **bắt buộc**, verify 0 false positive trước khi bật.
- **Parse sai** với style nhiều dòng. Mitigation: khớp ngoặc, không regex.
- **stylelint là toolchain mới** — effort thực tế cao hơn "cấu hình cái đã có". Mitigation: ước tính lại nếu 6b kéo dài hơn 1 ngày, tách thành sub-slice riêng.
- **Baseline trở thành cái cớ** để không bao giờ dọn. Mitigation: Phase 7 mỗi slice **phải** hạ baseline; Phase 8 đưa về 0.
