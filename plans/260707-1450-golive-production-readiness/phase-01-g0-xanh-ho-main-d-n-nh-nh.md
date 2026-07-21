---
phase: 1
title: "G0 — Xanh hoá main + dọn nhánh"
status: pending
priority: P1
dependencies: []
effort: "0.5 ngày"
---

# Phase 1: G0 — Xanh hoá main + dọn nhánh

## Overview
Đưa main về trạng thái xanh + đã push (qua PR) + CI xanh; dọn 7 nhánh remote stale. Đây là điều kiện tiên quyết mọi phase sau (2 commit local hiện là single-point-of-loss).

## Requirements
- Functional: full test suite xanh; 2 commit local lên origin **qua PR có CI gate** (RT-12); CI GitHub Actions xanh; 0 nhánh remote stale.
- Non-functional: KHÔNG nới/xoá test để làm xanh (quy tắc master roadmap).

> **[RT-12]** KHÔNG push 2 commit lớn (a26939f UI + 9e7bf24 teacher-mvp) thẳng main khi branch protection chưa bật. Đưa qua PR để có CI review gate — đây là code drop lớn nhất dự án, không được vào default branch không qua cổng. Nếu bật branch protection ngay được (không chờ PD-2) thì bật trước rồi mới push.
> **[RT-16]** Remote hiện có **7** nhánh `feat/*` (không phải 8 — đếm từ `git branch -r`). Đếm live-state khi xoá, không theo con số trong plan.

## Tests first (TDD)
Test đã tồn tại và đang đỏ — chính là red-state của TDD:
- `packages/auth/src/index.test.ts:68` kỳ vọng `giao_vien` bị chặn `student.lookup` — **kỳ vọng đã lỗi thời**. Commit a26939f chủ đích thêm `giao_vien` (comment tại `packages/auth/src/index.ts:71-75`: attendance name resolution, RLS + facilityId predicate). Fix = cập nhật test khớp quyết định đã document: assert `giao_vien` ĐƯỢC phép, giữ assert các role ngoài danh sách (vd `cskh`) vẫn bị chặn để bảo toàn tinh thần K4.

## Related Code Files
- Modify: `packages/auth/src/index.test.ts` (1 assert + mô tả test case)
- Không đổi: `packages/auth/src/index.ts` (code là quyết định đúng, có document)

## Implementation Steps
1. Sửa test drift như trên; `pnpm --filter @cmc/auth test` xanh.
2. Full gates: `pnpm typecheck && pnpm test && pnpm build` (DB dev `cmc-pg` phải Up).
3. **[RT-12]** Bật branch protection trên GitHub (required CI check) TRƯỚC, hoặc đưa 2 commit + fix qua PR. Không push thẳng main không cổng. Theo dõi CI tới xanh; CI đỏ → fix-forward trên nhánh PR, không merge tới khi xanh.
4. Dọn nhánh remote: đếm live `git branch -r` (**7 nhánh** `feat/*`, RT-16); với mỗi nhánh verify tip == head của PR đã merge (`gh pr view <n> --json headRefOid`) rồi `git push origin --delete <branch>`. Tip khác head PR → dừng, báo user.
5. Changelog entry ngắn trong `docs/project-changelog.md`.

## Success Criteria
- [ ] `pnpm test` xanh toàn monorepo (local, DB up)
- [ ] main pushed, CI GitHub Actions xanh
- [ ] 0 nhánh `feat/*` stale trên origin (đã verify tip trước khi xoá)
- [ ] Không test nào bị xoá/skip thêm

## Risk Assessment
- CI remote khác local (env/postgres service) → nếu đỏ, fix-forward; không merge thêm gì tới khi xanh.
- Xoá nhầm nhánh có commit chưa merge → mitigated bằng bước verify tip == PR head.
