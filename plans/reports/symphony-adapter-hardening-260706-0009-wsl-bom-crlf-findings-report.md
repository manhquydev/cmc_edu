# Symphony → Claude Code Adapter Hardening — Environment Completion

Ngày: 2026-07-06 · Trạng thái: ✅ Done, verified end-to-end

Trả lời 3 câu hỏi mở + đóng vòng lặp Symphony↔Claude Code bằng smoke test thật.

## Trả lời 3 câu hỏi

### #1 — Validate wrapper: ĐÃ LÀM (A+B). Smoke test bắt được showstopper.
Chạy `run US-001 --prepare-only` (A) + stub-adapter smoke `run US-001 --here` (B). Smoke phát hiện chuỗi lỗi mà đọc source KHÔNG thấy:
1. **`bash` = WSL, không phải Git Bash.** Symphony (exe Windows) spawn `bash` → trúng WSL (`cwd=/mnt/d/...`). WSL **không kế thừa env Windows** → `HARNESS_*` mất; path `/mnt/d`; **không có `claude`**. → wrapper `.sh` hỏng hoàn toàn trên máy này.
2. **BOM.** Windows PowerShell 5.1 `Set-Content -Encoding utf8` ghi BOM → `serde_json` của Symphony lỗi `expected value at line 1 column 1`. Phải ghi artifacts **BOM-free** (`ascii` / `[IO.File]::WriteAllText`).
3. **CRLF trong JSONL.** Changeset `.jsonl` phải **LF-only**; CRLF → `trailing characters`. RESULT.json (JSON đa dòng) thì CRLF OK.
4. **Changeset cần header.** Dòng đầu phải là `{"base_schema_version":8,"op":"changeset.header","run_id":"...","version":1}`.
5. **Adapter script phải được COMMIT.** Worktree mode chỉ chứa file đã commit → script chưa commit ⇒ 127 "No such file".

Kết quả sau khi vá: `Completed run ... Outcome: blocked` — Symphony validate + promote artifacts thành công.

### #2 — `--dangerously-skip-permissions`: GIỮ.
Đúng posture tool (adapter Codex dùng `approvalPolicy:never` + `dangerFullAccess`). Máy dev, không prod secret. Wrapper cho override qua `CLAUDE_BIN`. Ghi chú rủi ro; hardening allowlist chỉ khi máy có dữ liệu nhạy cảm.

### #3 — High-risk template + decision cho US-002..008: DEFER.
Môi trường đã đủ (template `docs/templates/high-risk-story/` + `harness-cli decision add` chạy được, 7 decisions seeded). Tạo trước = vi phạm triết lý harness ("stories arrive when selected") + YAGNI. Sinh từng story khi chọn, qua skill `intake-griller`.

## Bản sửa (committed)
- **Wrapper mới:** `scripts/run-agent-claude.ps1` (PowerShell) thay `run-agent-claude.sh` (đã `git rm` — bash=WSL trên máy này). Đọc `$env:HARNESS_RUN_ID`, build prompt, gọi `claude -p --dangerously-skip-permissions`; guard `CLAUDE_BIN`.
- **`.harness/symphony.yml`:** `command: [powershell, -NoProfile, -ExecutionPolicy, Bypass, -File, scripts/run-agent-claude.ps1]`.
- 3 commit: bootstrap → fix PowerShell adapter → dọn artifact rác.

## Verify
- `symphony doctor`: **11/11 PASS**, `agent adapter: powershell ... run-agent-claude.ps1`.
- `symphony work list`: US-001 Runnable **yes**.
- Stub smoke: `Completed run, Outcome: blocked` (env + RESULT.json + changeset đều pass validation).
- git: working tree clean, mọi runtime state (`.symphony/`, run dirs, stub, dump) đã dọn.

## Chạy story thật bằng Claude Code
```
# worktree mode (khuyến nghị cho normal/high-risk; KHÔNG cần changeset):
scripts\bin\harness-symphony.exe run US-001
# tiny tại chỗ (lightweight; cần changeset — Claude tạo qua harness-cli):
scripts\bin\harness-symphony.exe run US-001 --here
```
Symphony gọi `run-agent-claude.ps1` → Claude Code headless đọc RUN_CONTRACT + AGENTS.md → thực thi US-001 → ghi SUMMARY.md/RESULT.json/changeset.

## Câu hỏi mở
- Wrapper thật (gọi Claude) chưa chạy full lần nào — mới chứng minh plumbing bằng stub. Lần `run US-001` thật đầu tiên = bắt đầu build sản phẩm (quyết định riêng); nên dùng **worktree mode** (không cần changeset, đơn giản hơn `--here`).
- GitNexus index `CMC-docs` giờ stale (HEAD đổi sau các commit) — re-index khi cần: `gitnexus analyze --skip-git --embeddings --skip-agents-md .` rồi đổi tên registry về `CMC-docs`.
