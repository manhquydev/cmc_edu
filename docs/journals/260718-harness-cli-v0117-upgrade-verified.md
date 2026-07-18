# Nâng cấp repository-harness CLI v0.1.11 → v0.1.17 (verify độc lập)

**Ngày:** 2026-07-18
**Loại:** maintenance / tooling (harness durable layer)
**Commit:** `4047237` (upgrade) + `0b3633d` (gitnexus banner) trên `main`
**Intake harness:** #11 (maintenance / normal)

## Bối cảnh

Dự án dùng `repository-harness` (durable layer cho agent) đang ở `harness-cli v0.1.11`,
schema DB v8. Upstream đã ra `harness-cli-v0.1.17` (release bất biến, có sẵn binary
Windows đã ký checksum). Yêu cầu: cài bản mới **thật / đúng / chính xác**, ưu tiên an
toàn và tránh tự làm tự nhận đúng.

## Cách làm (đúng chuẩn harness)

- Dùng đường cài chính thức, ghim vào tag bất biến:
  `install-harness.ps1 -Merge -UpgradeCli -Ref harness-cli-v0.1.17`.
  - `-Merge` giữ nguyên toàn bộ tài liệu/schema đã customize (chỉ thêm file thiếu).
  - `-UpgradeCli` tải binary từ release, **verify sha256**, backup bản cũ rồi thay.
- Backup an toàn trước khi chạm: `harness.db`, `AGENTS.md`, binary, `scripts/schema/`
  → `.harness-preupgrade-backup-20260718080453/` (gitignored).
- Migrate schema v8 → v13 (thêm migration 009–013) bằng CLI mới.
- Reconcile `AGENTS.md`: khối `HARNESS:BEGIN…END` được refresh về chuẩn v0.1.17;
  **các con trỏ ngữ cảnh CMC được chuyển ra NGOÀI marker** để sống sót qua mọi lần
  refresh về sau.

## Quyết định đáng chú ý

- **Symphony ngoài phạm vi:** upstream đã tách Symphony thành repo riêng (E11), nên
  `harness-symphony.exe` là mối quan tâm tách biệt, không đụng tới khi nâng harness-cli.
- **Giữ 6 tài liệu harness lõi** (ARCHITECTURE/CONTEXT_RULES/FEATURE_INTAKE/HARNESS/
  TEST_MATRIX/TOOL_REGISTRY): diff cho thấy chúng đã bị CMC customize → merge cố tình
  giữ lại thay vì đè bản upstream.
- Binary + `harness.db` vẫn gitignore (ADR 0004/0005); file `scripts/harness-cli-release-tag`
  (= `harness-cli-v0.1.17`) là dấu mốc version được git track.

## Verify độc lập (không tự nhận đúng)

Giao cho một verifier độc lập tự tính lại mọi thứ từ ground truth:

- **Thật (genuine):** sha256 khớp 3 chiều — binary đã cài == checksum công bố chính thức
  == asset tải mới re-hash: `2d7edff2…f11a51a6`. `--version` = `harness-cli 0.1.17`.
- **Đúng (correct):** 11 file installer đặt vào đều **byte-identical** với upstream tag
  (chuẩn hoá CRLF).
- **Chính xác (precise):** `migrate` = schema v13, 0 áp thêm. Chứng minh không mất
  durable state bằng cách query DB cũ (binary v0.1.11 trong backup) so với DB hiện tại:
  cùng 10/28/15/17/39, decision IDs identical, 0 mất. Commit chỉ đụng đúng 13 path harness.

Báo cáo đầy đủ: `plans/reports/harness-v0117-independent-install-verification-260718-0813-report.md`.

## Còn lại

- Chưa push `main` lên remote (theo lựa chọn commit-on-main).
- `audit` báo 3 story chưa verify (US-013/018/019) — drift dữ liệu có sẵn, không liên
  quan bản cài này.
