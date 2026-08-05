---
phase: 4
title: "D2 ràng buộc — dual-edit"
status: pending
priority: P2
effort: "0.5d"
dependencies: [1]
---

# Phase 4: D2 ràng buộc — dual-edit

# ⛔ CHẶN: cần trả lời Open question 1 trước khi bắt đầu chuỗi 4 (có default thoát hiểm)

## Overview

4 chuỗi D2 bị unit test và/hoặc e2e ràng buộc (3 nếu áp default OQ1). Sửa source **+ mọi test** trong
cùng commit, tách riêng để revert độc lập.

## Requirements

**Functional**
- Source + unit test + e2e spec đổi đồng thời.

**Non-functional**
- Cả `typecheck-and-test` **và** `ui-e2e` phải xanh — **hai** required check,
  không chỉ e2e (lỗi bản đầu).
- `ui-e2e` chỉ chạy `on: push` ⇒ verify bằng push lên branch, không hứa "chạy trước push".

## Architecture

Bản đầu định nghĩa rủi ro thuần theo `ui-e2e` và chỉ liệt file e2e. Sai: `pnpm test`
(47 file test admin) nằm trong `typecheck-and-test`, cũng required, và khoá chính
những chuỗi này.

Thêm: `payroll-assemble-finalize.journey.ui.spec.ts:128-129` chạy
`assertBusinessInvariant`; `scripts/business-verify/verify.ts` liệt `'lương'`,
`'payroll'` trong `MONEY_STATE_KEYWORDS` ⇒ gate `business:verify --strict` trong
`ui-e2e.yml` cũng phủ spec này. **Bản đầu bỏ sót gate này hoàn toàn.**

## Related Code Files

### Chuỗi 1 — `Tính lương (assemble)` → đề xuất `Tính lương`

- Modify: `apps/admin/src/pages/hr/payroll.tsx:182`
- Modify: `apps/admin/src/pages/hr/payroll.test.tsx:201,208,214,224` ← **bản đầu thiếu**
- Modify: `apps/e2e/tests/journeys/payroll-assemble-finalize.journey.ui.spec.ts:98`
- Modify: `apps/e2e/tests/journeys/kpi-submit-confirm-bulk-approve.journey.ui.spec.ts:174`

Kiểm không trùng nút khác cùng tên trên trang.

### Chuỗi 2 — `Mở lại (reopen)` → đề xuất `Mở lại`

- Modify: `apps/admin/src/pages/hr/payroll.tsx:201`
- Modify: `apps/admin/src/pages/hr/payroll.test.tsx:263,269,276,284` ← **bản đầu thiếu**
- Modify: `apps/e2e/tests/journeys/payroll-assemble-finalize.journey.ui.spec.ts:107` (comment)
- Modify: `…:109` (assertion)

### Chuỗi 3 — `AI agent — chỉ đọc`

- Modify: `apps/admin/src/pages/finance/reconciliation.tsx:254`
- Modify: `apps/admin/src/pages/finance/reconciliation.test.tsx:98`

Đề xuất: "Kết quả phân tích tự động — chỉ đọc" (bỏ "AI agent").

### ~~Chuỗi 4 — `O1–O5`~~ → ĐÃ CHUYỂN SANG PHASE 3

R2 kiểm: `grep -rn 'O1–O5\|Tiến độ giai đoạn' apps packages` → 3 hit
(`opportunity-detail.tsx:551` + 2 chỗ `design-lab-wireframes.tsx`), **0 test**.
Enum `'O1_LEAD'…'O5_ENROLLED'` là mảng riêng ở `:555-559`, tách rời chuỗi hiển
thị. ⇒ **Không coupled**, Open question 2 **đóng bằng bằng chứng**, chuỗi chuyển
sang Phase 3 nhóm C.

### Chuỗi 4 (trước là 5) — `User ID (auth identity)` ⛔ CHẶN

- Modify: `apps/admin/src/pages/admin/users.tsx:346`
- Modify: `apps/e2e/src/journey/create-staff-via-admin-ui.ts:134`
- Modify: `apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts:58`

🔴 Nhãn form. Giao kèo có non-goal "không đụng nhãn form". Lý do của non-goal
(nhãn form vốn đúng chuẩn) **không đúng ở đây** — nhãn này lộ "auth identity".
**Không tự quyết.** Chờ trả lời Open question 1. Nếu người dùng giữ non-goal ⇒
bỏ chuỗi 4, ghi lý do.

## Implementation Steps

1. **Xác nhận Open question 1** (chuỗi 4). OQ2 đã đóng bằng bằng chứng — không chờ.
   **Nếu OQ1 = "giữ nhãn form":** bỏ chuỗi 4, **và trong cùng commit gỡ token
   `auth identity` khỏi pattern audit** (nếu không Phase 5 sẽ kẹt vĩnh viễn —
   đúng bẫy R1 #5 tái lập).
2. Mỗi chuỗi: `grep -rF "<chuỗi>" apps/ packages/` — **toàn repo**, không chỉ
   `apps/e2e`. Xác nhận danh sách file trên đã đủ.
3. Sửa source + unit test + e2e cùng lúc.
4. Chạy `pnpm test` (nhanh) → rồi push để `ui-e2e` chạy.
5. **Commit theo chuỗi, không gộp tất cả** (sửa mâu thuẫn R2):
   - Chuỗi 1 + 2 dùng **chung file** `payroll.tsx` và **chung spec**
     `payroll-assemble-finalize` ⇒ **gộp làm 1 commit** (tách theo hunk không đáng).
   - Chuỗi 3 (`reconciliation`) → commit riêng.
   - Chuỗi 4 (`users`, nếu được duyệt) → commit riêng.
   Mỗi commit chứa source + unit test + e2e **của chính chuỗi đó**.

## Tests / Validation

- `pnpm test` xanh — **chạy trước, rẻ nhất, bắt được lỗi bản đầu bỏ sót**.
- `pnpm typecheck` xanh.
- `pnpm lint` exit 0.
- Push → `ui-e2e` xanh, **gồm step `business:verify --strict`**.
- `git show --stat` xác nhận source + test cùng commit.

## Success Criteria

- [ ] OQ1 đã có trả lời **hoặc** đã áp default (xem Thoát hiểm dưới)
- [ ] Nếu bỏ chuỗi 4: token `auth identity` đã gỡ khỏi pattern **cùng commit**
- [ ] `grep -rF` toàn repo xác nhận không sót nơi tham chiếu
- [ ] Commit theo chuỗi (1+2 gộp, 3 riêng, 4 riêng) — kiểm `git log --stat`
- [ ] `pnpm test` xanh trước khi push
- [ ] `pnpm check:ui-frames && pnpm test:ui-frames` xanh
- [ ] `ui-e2e` + `business:verify --strict` xanh trên CI
- [ ] Comment dòng 107 đồng bộ với assertion 109

## Thoát hiểm khi OQ1 không được trả lời (vá R2)

Phase 5 phụ thuộc [2,3,4]; nếu Phase 4 treo vì chờ câu trả lời thì **cả plan
đứng**. Default có thời hạn:

> Không có trả lời ⇒ **giữ non-goal** (không đụng nhãn form), bỏ chuỗi 4, **gỡ
> token `auth identity` khỏi pattern**, ghi lý do vào `MASTER.md` §"Giới hạn lint".
> Phase 4 vẫn được đánh `completed`.

## Rollback

Hạt commit = 1 chuỗi (chuỗi 1+2 chung một commit vì chung file/spec).
`git revert <sha>` gỡ được từng chuỗi.
Nếu revert, **phải** cập nhật `plan.md` Success Criteria + ghi lý do — Phase 5
phụ thuộc 2+3+4, revert làm tiêu chí Phase 5 không đạt nếu không khai báo.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Quên unit test → `typecheck-and-test` đỏ | Related Code Files đã liệt kê đủ; bước 4 chạy `pnpm test` trước |
| `business:verify --strict` đỏ do đụng spec payroll | Nêu rõ trong Architecture; kiểm sau khi push |
| Tự ý đảo non-goal (chuỗi 4) | Header phase chặn cứng |
| Đổi giá trị enum thay vì nhãn (chuỗi 4) | Bước 1 trace trước |
| Revert làm Phase 5 treo | Mục Rollback yêu cầu cập nhật plan khi revert |
| Sót nơi tham chiếu | Bước 2 grep toàn repo, không tin danh sách cứng |
