# repository-harness Setup — CMC (D:\project\vip\CMC)

Ngày: 2026-07-05 · Trạng thái: ✅ Done, verified · Nguồn: https://github.com/hoangnb24/repository-harness

## Mục tiêu
Biến `D:\project\vip\CMC` thành **agent-ready workspace** để triển khai dự án theo mô hình Harness (AGENTS.md + intake/story/validation + decisions + Rust CLI durable layer).

## Quyết định người dùng
- Cài vào **chính `D:\project\vip\CMC`** (code sẽ viết tại đây).
- Chấp nhận rủi ro, cài **direct `-Yes`** (không inspect-first). Cảnh báo bảo mật đã nêu: installer pipe script + tải binary Rust prebuilt từ repo cá nhân.

## Đã làm
1. `git init` (harness Symphony runner sau này cần git; installer bản thân không yêu cầu git).
2. Chạy PS installer `-Yes -Merge -Directory "D:\project\vip\CMC"`:
   - **44 file tạo, 1 updated (.gitignore), 1 skipped** (docs/README.md giữ bản cũ nhờ `-Merge`).
   - Binary `scripts/bin/harness-cli.exe` (harness-cli-v0.1.11, windows-x64) — **SHA256 verified**.
   - 33 design docs `00-..27-..` **giữ nguyên** (merge).
   - `.gitignore` được append rule: `harness.db*`, `scripts/bin/harness-cli*`.
3. Khởi tạo durable layer: `harness-cli init` → `migrate` (schema v8) → `import brownfield`.
   - **7 decisions seeded** (0001–0007), 0 stories, 0 backlog.

## Cấu trúc mới (bổ sung, không đè docs cũ)
- `AGENTS.md`, `README.md` (root) — agent operating guide.
- `docs/`: HARNESS.md, ARCHITECTURE.md, CONTEXT_RULES.md, FEATURE_INTAKE.md, TEST_MATRIX.md, TOOL_REGISTRY.md, TRACE_SPEC.md, GLOSSARY.md, HARNESS_* , IMPROVEMENT_PROTOCOL.md.
- `docs/decisions/` (0001–0007 + README), `docs/stories/` (README+backlog), `docs/product/`, `docs/templates/` (story, decision, spec-intake, validation-report, high-risk-story/*).
- `scripts/`: `bin/harness-cli.exe`, `schema/001..008-*.sql`, README.
- `harness.db` (SQLite durable layer, gitignored).

## Verify
- `harness-cli.exe --help` → OK (init/migrate/import/intake/story/decision/tool/query/audit/propose...).
- `harness-cli.exe tool check` → registry rỗng (chưa đăng ký tool) — OK.
- `harness-cli.exe query matrix` → rỗng (chưa có story) — OK.
- `harness-cli.exe query decisions` → 7 decisions.

## Cách dùng (Windows)
- Đọc trước: `AGENTS.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_RULES.md`, `docs/TOOL_REGISTRY.md`.
- Vòng làm việc: intake (`harness-cli intake ...`) → story (`docs/stories/` + `harness-cli story ...`) → validate theo `docs/TEST_MATRIX.md` → ghi `harness-cli trace/intervention`.
- Đăng ký tool ngoài: `harness-cli tool register --name ... --kind cli|mcp|skill --capability ...`.
- Bổ trợ GitNexus (đã cài): dùng `repo:"CMC-docs"` để semantic-search docs khi shaping story.

## Hạn chế / Câu hỏi mở
- **Symphony local runner KHÔNG có sẵn**: `harness-symphony` (`cargo build -p harness-symphony`, `work list`, `run <story> --prepare-only`) chỉ build được TỪ repo harness gốc; installer chỉ cài `harness-cli` + docs. Muốn dùng runner phải `git clone` repo harness và build riêng. → Có cần không?
- **Skill `.codex/skills/harness-intake-griller/SKILL.md`** mà AGENTS.md tham chiếu **không được installer tạo**. → Cần lấy thủ công từ repo gốc nếu muốn dùng intake-griller.
- Bảo mật: đã chạy binary/script từ repo cá nhân theo yêu cầu; nếu cần, có thể audit `scripts/bin/harness-cli.exe` + script sau.
