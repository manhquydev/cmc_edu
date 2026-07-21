# GitNexus Setup — CMC docs (D:\project\vip\CMC)

Ngày: 2026-07-05 · Trạng thái: ✅ Done, verified

## Bối cảnh
- GitNexus **đã cài sẵn** trên máy: CLI `v1.6.1` (`C:\Users\manhquy\AppData\Roaming\npm\gitnexus`), MCP server đã kết nối Claude Code. Node `v24.11.1`.
- Thư mục làm việc `D:\project\vip\CMC` là **docs-only** (35 file markdown thiết kế), **không phải git repo**, chưa từng index.
- Mục tiêu: index bộ docs để dùng GitNexus MCP tools (semantic search / query / cypher) tra cứu tài liệu thiết kế.

## Việc đã làm
1. `gitnexus analyze --skip-git --embeddings --skip-agents-md .`
   - `--skip-git`: folder không có `.git`.
   - `--embeddings`: bật vector search (35 embeddings, 1/file). Chạy GPU DirectML.
   - `--skip-agents-md`: không ghi section vào CLAUDE.md/AGENTS.md root.
   - Kết quả: 35 files · 365 nodes · 352 edges · 35 embeddings. Tạo `.gitnexus/` (lbug ~20MB + meta.json).
2. **Xử lý trùng tên:** basename `CMC` trùng repo đã có `D:\project\CMC` (name "CMC", 2877 files). Đã sửa `~/.gitnexus/registry.json` đổi entry `D:\project\vip\CMC` thành **`name: "CMC-docs"`**. Index cũ `D:\project\CMC` KHÔNG bị ảnh hưởng.
3. Thêm `.gitnexus/` vào `.gitignore` và `.repomixignore` (tránh lọt binary ~20MB vào packing).

## Verify
- `gitnexus list` / MCP `list_repos`: thấy `CMC-docs` → `D:\project\vip\CMC` (MCP nhận live, không cần restart).
- `gitnexus query "phân quyền vai trò và luồng nghiệp vụ" --repo CMC-docs` → trả về đúng docs liên quan.

## Cách dùng
- CLI: `gitnexus query "<khái niệm>" --repo CMC-docs` (bắt buộc `--repo` vì nhiều repo).
- MCP tools (trong Claude Code): truyền `repo: "CMC-docs"` cho `query`, `context`, `cypher`, v.v.
- Re-index sau khi sửa docs: `gitnexus analyze --skip-git --embeddings --skip-agents-md .`
  - Lưu ý: re-analyze lấy lại basename → entry sẽ về lại "CMC", cần đổi tên registry lại thành `CMC-docs`.

## Hạn chế
- Docs graph không có call-graph/impact như code (0 clusters, 0 flows) → giá trị chính là **semantic search + tra cứu khái niệm**, không phải phân tích luồng thực thi.

## Câu hỏi mở
- Có muốn re-index tự động khi docs thay đổi không? Hiện phải chạy thủ công (folder không phải git nên không có incremental update).
