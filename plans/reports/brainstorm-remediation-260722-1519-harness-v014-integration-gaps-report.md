# Brainstorm — Vấn đề tồn đọng sau tích hợp harness-v0.1.4

Ngày: 2026-07-22 · Branch: `main` · Trạng thái: đã chốt phương án + đã vá P0–P5

## 1. Bối cảnh

Cài Harness core `0.1.4` (bản mới nhất — xác minh: remote tag max = `harness-v0.1.4`,
`releases/latest` = `harness-v0.1.4`, remote `main` HEAD `0b2ac97` == local HEAD).
Profile core-only, không kèm SQLite CLI bundle. Cài xong phát sinh loạt vấn đề
thẩm quyền/tài liệu, không phải lỗi kỹ thuật của bản cài.

## 2. Vấn đề xác định

| ID | Vấn đề | Mức | Nguồn gốc |
|---|---|---|---|
| P0 | Hai nơi chứa plan: `plans/` (30 plan thật) vs `docs/plans/active/` (harness bắt buộc, rỗng) | Cao | do cài core |
| P1 | `CLAUDE.md` import `@AGENTS.md`, cả 2 chứa khối gitnexus giống hệt 101 dòng | TB | regression khi thêm shim |
| P2 | `.codex` intake skill cần `harness-cli` nhưng khối AGENTS.md mới bỏ chỉ dẫn bootstrap | TB | do refresh AGENTS.md |
| P3 | `docs/HARNESS.md:89-120` coi luồng CLI là bắt buộc; AGENTS.md mới gọi là "optional" | TB | có sẵn, bị khuếch đại |
| P4 | 5 file harness mới không được index trong `docs/README.md` | TB | do cài core |
| P5 | Clone mới thiếu `scripts/bin/harness` (bị `.gitignore` rule `bin/`) | TB | thiết kế upstream |
| P6 | 4 file managed mang nội dung CMC → update sau sẽ conflict | Thấp | theo thiết kế |
| P7 | `.gitignore` 163-164 thừa (đã có `bin/` dòng 25) | Bỏ qua | installer sinh, tự thêm lại |

**Đính chính báo cáo trước:** tôi từng viết khối AGENTS.md cũ trỏ tới binary
"sẽ fail". Sai — khối cũ bảo chạy `bootstrap-harness.sh` TRƯỚC, script này tải +
verify checksum `harness-cli-v0.1.17` (asset còn publish, HTTP 302). Luồng cũ
tự chữa được. Refresh vẫn đúng nhưng không phải vì lý do tôi nêu.

## 3. Phương án P0 đã cân nhắc

| PA | Nội dung | Ưu | Nhược |
|---|---|---|---|
| **A** ✅ | Giữ `plans/`, ghi đè thẩm quyền ở phần project-owned AGENTS.md | Rẻ; giữ 30 plan; không phá update | Lệch chuẩn upstream; `docs/plans/active/` rỗng vĩnh viễn |
| B | Di dời 30 plan sang `docs/plans/` | Đúng chuẩn upstream | Công lớn; sửa hook config; gãy mọi tham chiếu đường dẫn |
| C | Hai tầng song song | — | Giữ nguyên mơ hồ, vi phạm KISS. Phản đối |

**Chốt: A.** B chỉ đáng nếu chuyển hẳn sang harness làm quy trình chính — 30 plan
hiện có cho thấy không phải.

**Ràng buộc then chốt (đã thực nghiệm):** không được xoá `docs/plans/`. Thử
`mv docs/plans/README.md` rồi `update --dry-run`:

```
conflict docs/plans/README.md (MissingManagedFile)
Update stopped; no files changed.
```

Xoá 1 file managed làm **toàn bộ** update chết. Nên giữ thư mục, chỉ ghi đè
thẩm quyền bằng tài liệu.

## 4. Đã thực hiện

| Mục | File | Thay đổi |
|---|---|---|
| P0-A | `AGENTS.md` | Mục project-owned: plan ở `plans/`, không ghi vào `docs/plans/`, nêu rõ lý do không xoá |
| P2 | `AGENTS.md` | Mục project-owned: chạy `bootstrap-harness.sh` trước khi dùng intake skill |
| P1 | `CLAUDE.md` | Gỡ khối gitnexus trùng (111 → 15 dòng) |
| P4 | `docs/README.md` | Thêm mục index "Harness" cho `WORKFLOW.md`, `templates/exec-plan.md`, `plans/` |
| P3 | `docs/HARNESS.md` | Blockquote status ở "Durable Layer": luồng SQLite là tuỳ chọn |
| P5 | `docs/HARNESS.md` | Mục "Harness Core": lệnh CLI, cách cài lại binary cho clone mới, cảnh báo 4 file sẽ conflict |

Text thêm vào AGENTS.md nằm **ngoài** cặp `HARNESS:BEGIN/END` → sống sót qua upgrade.

## 5. Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `harness status` | `current (installed=0.1.4, target=0.1.4, modified=4, missing=0)` |
| `harness doctor` | 13 pass / 0 fail |
| `harness update --dry-run` | 10 preserve, 0 conflict |
| `verify-repository-portability.mjs` | OK, 1019 file, 55 env key |
| Marker thật (`<!-- HARNESS:BEGIN -->`) | AGENTS.md 1/1, CLAUDE.md 1/1 |
| Dry-run upgrade tương lai | chỉ `refresh AGENTS.md` (marked block), `skip CLAUDE.md`; project-owned không bị đụng |
| Context nạp mỗi phiên | 13.936 → 9.679 bytes (giảm ~4,3KB) |

## 6. Rủi ro còn lại

- **P6 (chấp nhận):** 4 file managed (`AGENTS.md`, `docs/README.md`,
  `docs/product/README.md`, `docs/decisions/README.md`) mang nội dung CMC. Core
  release sau đụng vào chúng → update dừng, không ghi. Xử lý tay khi xảy ra.
  Đã ghi vào `docs/HARNESS.md`.
- **P7 (bỏ qua):** `.gitignore` thừa dòng, installer tự thêm lại.
- **Chưa commit.** `.harness-core/` cần được commit để clone khác update được;
  binary `scripts/bin/harness` bị ignore là đúng.

## 7. Bước tiếp

1. Commit: `.harness-core/`, `docs/WORKFLOW.md`, `docs/plans/`,
   `docs/templates/exec-plan.md`, `AGENTS.md`, `CLAUDE.md`, `docs/README.md`,
   `docs/HARNESS.md`, `.gitignore`.
2. `npx gitnexus analyze` sau commit (index stale).

## 8. Câu hỏi chưa giải quyết

- 4 file `plans/templates/*.md` đang dirty từ **trước** phiên này — không liên quan
  harness. Cần commit riêng hay revert?
- Có định dùng lại luồng Symphony (`.harness/symphony.yml`, `.harness/changesets/`)
  không? Nếu bỏ hẳn thì `FEATURE_INTAKE.md` / `TRACE_SPEC.md` / `CONTEXT_RULES.md` /
  `scripts/schema/` nên đánh dấu legacy — hiện vẫn đọc như tài liệu đang hiệu lực.
- `scripts/harness-cli-release-tag` ghim `harness-cli-v0.1.17`, upstream đã có
  `v0.1.22`. Nâng hay giữ ghim?
