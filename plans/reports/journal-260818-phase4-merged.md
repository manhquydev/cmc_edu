# Journal — Phase 4 merged (PR #155)

**Ngày:** 2026-08-18 · **Branch:** feat/resource-depth-phase-4a → main (`aed5990`)

## Việc đã làm

- **4A — Staff operational timeline:** seam RecordEvent dùng chung (append/cursor),
  contract AppUser 7 loại sự kiện (payload allowlist, không PII/bí mật), emit cùng
  transaction với mutation, endpoint user.timeline (chuẩn hóa cha theo facility,
  chiếu actor an toàn — ngoại lệ super_admin là D11), tab /hr/staff/:id/activity.
- **4B — Compliance-link correctness:** registry AUDIT_ENTITY_ID_RESULT_ACTIONS
  (7 action create-shape lấy id từ row kết quả), AUDIT_ENTITY_ID_RESULT_KEYS
  (unwrap 1 key cố định cho receiptCreate/refundCreate/redeem — hết entityId
  không tất định theo thứ tự key client), audit.list thêm filter entityId +
  safe link chứng minh resolvable theo facility hiện tại, manifest test chốt
  phân loại mọi create-shape mutation (bước 8 của plan).

## Bài học

1. **Hai vòng review đều bắt lỗi thật:** vòng 1 thiếu user.create/shift.* trong
   registry; vòng 2 vạch premise sai trong D12 draft ("handler tự ghi audit row
   đúng id" — sai với receiptCreate/refundCreate). Lời khuyên: xác minh claim
   bằng grep source trước khi ghi thành decision.
2. **Gate acceptance bắt orphan đúng việc:** user.timeline chưa khai báo manifest
   thì ui-e2e đỏ — quy trình thêm procedure mới PHẢI kèm khai báo flow (ADM-02)
   trong scripts/acceptance-report/flow-manifest.ts.
3. Test cũ mutation-audit-coverage đang pin HÀNH VI SAI (tra audit row theo
   opportunity id) — khi sửa contract, rà lại test đang xanh có thực sự đúng.

## Bằng chứng

- PR #155: 14/14 check xanh (typecheck-and-test, ui-e2e required), merged
  2026-08-18T03:55:41Z; post-merge CI trên main xanh.
- Local: API 133 files/1282 tests, admin 73/685, typecheck/lint/gates xanh.
