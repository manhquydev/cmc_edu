# Harness Gaps Resolution — Symphony + Claude Code + First Story

Ngày: 2026-07-05 · Trạng thái: ✅ Done, verified

Giải quyết 4 khoảng trống sau khi cài repository-harness + đồng bộ để dùng với Claude Code.

## #1 Symphony local runner — DONE
- Clone `github.com/hoangnb24/repository-harness` → `C:\Users\manhquy\temp\repository-harness`; `cargo build -p harness-symphony` (21.7s) → `harness-symphony.exe` (5.8MB).
- Copy vào `scripts/bin/harness-symphony.exe`. Workspace members: `harness-cli`, `harness-symphony`.
- `symphony doctor`: **ALL PASS**.

## #3 Audit install script — DONE
- Verdict **Low Risk**: SHA256-verify binary; KHÔNG eval/exec nội dung tải; KHÔNG telemetry/đọc secret/credential; thao tác giới hạn trong target dir; không obfuscation.
- Điểm yếu nhỏ: file payload markdown chỉ dựa HTTPS (không checksum).

## #2 Skill intake-griller + đồng bộ Claude Code — DONE
- Copy `SKILL.md` (9198 bytes) vào `.codex/skills/harness-intake-griller/` (đúng ref AGENTS.md) **và** `.claude/skills/harness-intake-griller/` → **Claude Code nhận diện skill** (dùng ngay).
- **Symphony → Claude Code adapter:** `.harness/symphony.yml` = `adapter: custom`, command `bash scripts/run-agent-claude.sh`. Wrapper gọi `claude -p --dangerously-skip-permissions`, đọc RUN_CONTRACT + AGENTS.md, xuất SUMMARY.md/RESULT.json/changeset theo env `HARNESS_DB_PATH/HARNESS_RUN_ID/HARNESS_RUN_MODE`.
- `symphony doctor`: `agent adapter PASS — custom command: bash scripts/run-agent-claude.sh`.

## #4 Intake 'New spec' + story đầu tiên — DONE
- Phân rã 33 design docs (qua subagent): **CMC EDU v2** = ERP+LMS cho chuỗi trung tâm giáo dục; stack pnpm+turbo monorepo, tRPC 11, React 19/Vite, Prisma 6/Postgres RLS, Entra SSO. **10 domains, 8 candidate stories** (US-001..008; nhiều story lõi high-risk: permission registry, auth, cổng tiền, dữ liệu trẻ).
- **Hướng build:** greenfield v2 tại `vip/CMC` (user xác nhận).
- `harness-cli intake --type new-spec --lane tiny` → **Intake #1 recorded**.
- Story đầu: **US-001** (tiny) P0 scaffolding — monorepo + `apps/api` tRPC + `health` publicProcedure + UI shell. File: `docs/stories/US-001-p0-scaffolding-monorepo-health.md`; durable row + verify `pnpm build`.
- `query matrix`: US-001 `planned`.

## Initial commit + Symphony runnable — DONE
- `git commit` baseline (`528b378`, 84 files) → cho phép `git worktree` của Symphony.
- `symphony work list`: **US-001 → Runnable: yes (ready)**.

## Cách chạy story đầu bằng Claude Code (khi muốn implement)
```
# tiny lane chạy tại checkout hiện tại (vẫn dùng DB copy + yêu cầu artifacts):
scripts\bin\harness-symphony.exe run US-001 --here
# hoặc chuẩn bị worktree cô lập để xem contract trước:
scripts\bin\harness-symphony.exe run US-001 --prepare-only
```
Symphony sẽ gọi `scripts/run-agent-claude.sh` → Claude Code headless thực thi US-001.

## Files tạo/sửa turn này
- `scripts/run-agent-claude.sh`, `.harness/symphony.yml`, `scripts/bin/harness-symphony.exe`
- `.codex/skills/…/SKILL.md`, `.claude/skills/…/SKILL.md`
- `docs/stories/US-001-p0-scaffolding-monorepo-health.md`
- `.gitignore` (+`.symphony/`, `harness-symphony*`)
- harness.db: Intake #1 + Story US-001

## Câu hỏi mở
- Wrapper `run-agent-claude.sh` chưa chạy thật lần nào — cần 1 lần `run US-001 --here` để tinh chỉnh prompt/flags cho khớp RESULT.json validation của Symphony.
- `--dangerously-skip-permissions` chạy Claude Code không giám sát trong worktree cô lập — chấp nhận được vì đã isolate, nhưng cân nhắc nếu chạy trên máy có dữ liệu nhạy cảm.
- US-002..008 nhiều story high-risk (auth/tiền/dữ liệu trẻ) — cần high-risk story template + decision records khi tới.
