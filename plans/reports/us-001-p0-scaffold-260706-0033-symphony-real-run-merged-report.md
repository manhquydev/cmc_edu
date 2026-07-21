# US-001 P0 Scaffold — Real Symphony Run → Merged to master

Ngày: 2026-07-06 · Trạng thái: ✅ Done, verified, merged

Chạy `harness-symphony run US-001` THẬT: headless Claude Code scaffold P0 monorepo CMC EDU v2, verified độc lập, merge sạch vào master.

## Chạy thật (Symphony worktree)
- `run US-001` (worktree cô lập) → adapter `run-agent-claude.ps1` → **headless Claude Code** (context riêng) scaffold theo RUN_CONTRACT + story + docs. ~14 phút. Outcome **`completed`**, Symphony validate PASS.

## Scaffold (headless Claude tạo, đúng US-001)
- **Monorepo**: pnpm workspaces + Turborepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`), Node ≥22 ESM, TS 5.9 strict.
- **`apps/api`**: tRPC 11 + `health` publicProcedure `{status:'ok',ts}`; convention `module.action`, `requirePermission()` qua `@cmc/auth`, error model 5-code.
- **`apps/admin`**: Vite 6 + React 19 + router 7 shell, style từ token `@cmc/ui`.
- **`packages/{auth,ui,db}`**: `can()` deny-by-default stub · design tokens CSS (brand `#0071E3`) · Prisma 6 (`Facility` model).

## Verify độc lập (tôi tự chạy lại, KHÔNG tin lời khai)
| Check | Worktree | Main (master sau merge) |
| --- | --- | --- |
| `pnpm build` | ✅ 5/5 | ✅ 5/5 |
| `pnpm typecheck` | ✅ 8/8 | — |
| `pnpm test` | ✅ health 1 passed | ✅ 4/4 |

## Merge sạch vào master (bắt được + sửa 3 vấn đề)
1. **Scaffold chưa commit** trong worktree → commit code sản phẩm trên branch (bỏ shim AGENTS.md + run-state), giữ changeset.
2. **`apps/*/node_modules` nested lọt staging** (2650 files) vì `.gitignore` chỉ có `/node_modules` (root-only) → sửa thành `node_modules/` (mọi cấp) + `.turbo/` + `.vite/`. Còn lại **35 files** sạch.
3. **`pnpm-lock.yaml` bị `.gitignore` cũ (template Next.js) loại** → un-ignore, commit lockfile cho reproducible install.
- `git merge --ff-only` → master `39974ee`; `harness-symphony sync` áp changeset (3 ops) vào root `harness.db`; dọn worktree.
- Cập nhật durable đúng thực tế: **US-001 = `implemented`** (unit=1, integ=1, e2e=0, platform=1).

## Trạng thái cuối
- master: 4 commit, working tree **sạch**; `apps/` + `packages/` + lockfile committed; `.harness/runs/` + `.symphony/` + `node_modules/` ignored.
- **Project build được ngay**: `pnpm install && pnpm build && pnpm test` xanh trên main.
- Toàn bộ pipeline 5 phiên (GitNexus → repository-harness → Symphony PowerShell adapter → headless Claude) đã chạy trọn 1 vòng story thật.

## Bước tiếp (khi tiếp tục build hệ thống)
- Story kế: US-002 (permission registry `@cmc/auth`, **high-risk**) — dùng `docs/templates/high-risk-story/` + decision record. Shape qua skill `intake-griller` rồi `harness-symphony run US-002`.
- Thứ tự lõi: US-002 (authz) → US-003 (auth Entra/OTP) → US-004/005 (CRM→receipt) → US-006 (cổng tiền, high-risk) → US-007 (enrollment) → US-008 (LMS guardian).

## Câu hỏi mở
- GitNexus `CMC-docs` index stale (HEAD đổi) — re-index khi cần semantic search.
- Chưa bật Mantine (agent để `@cmc/ui` chỉ tokens); thêm khi story UI cần.
- Frontend vẫn Vite+router v7 (không SSR) — xác nhận trước khi làm LMS nếu cần SEO/SSR.
