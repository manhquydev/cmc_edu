# P1 — Định danh & Ghi danh (Build Plan)

> Cụm xương sống v2. Thực thi theo Harness (intake #3 · US-002…US-010) + ADR đã chốt.
> Nguồn: TL10 (data) · TL11 (API) · TL14 (RBAC) · TL16 (ADR A–D) · TL22 (ADR 0041) ·
> TL23/24 (WF-P1) · TL25 (truy vết) · TL29 (test) · TL31 (P0/P1 acceptance) · TL18 (stack).
> Stack thật: Vite+React19+router7 · tRPC11+zod · Prisma6+Postgres · Vitest. Nền P0 xanh.

## Trạng thái
- P0 scaffold: ✅ implemented (typecheck 8/8 · test pass · build 5/5).
- P1: 🟡 planned — 9 story (US-002…010). US-010 (recon HOTL) **lùi P5**.

## Bất biến phải giữ (TL01/TL22)
I1 cổng tiền tách tạo/duyệt (sale≠GĐKD) · I2 duyệt=auto-O5+closedAt cùng tx · I3 huỷ phiếu duy nhất→revert O4 ·
I4 netAmount đóng băng · I5 refund append-only cap `FOR UPDATE` · I6 provisioning find-or-create theo phone 84xxx ·
I10 RLS facilityId · ADR-A enrollment `active⇔Receipt approved` · ADR-B money gate GĐKD · **ADR 0041 provisioning
idempotent TÁCH khỏi tx tiền** · không student mồ côi (`createdByReceiptId`) · không hardcode role → `can()`.

## Phases (build order theo phụ thuộc dữ liệu)

| # | Phase | WF | Story | Deliverable chính |
|---|---|---|---|---|
| 0 | Nền P1 | — | (chung) | Prisma models+enums P1; `@cmc/auth` registry thật + `can()`/`requirePermission`; tRPC ctx (session+RLS facility); error model 5 mã |
| 1 | CRM & tạo phiếu | 01,02 | US-002,003 | `crm.*` (create/advance/markLost/lookup); `finance.receiptCreate` (union warning trùng SĐT) |
| 2 | **Cổng tiền + provisioning** | 03,04,05 | US-004,005,006 | `finance.receiptApprove` (freeze netAmount+O5 atomic) → bước idempotent provisioning → outbox; enrollment reserved→active |
| 3 | Huỷ/Hoàn tiền | 08 | US-009 | `finance.receiptCancel` (revert O4+rollback), `finance.refundCreate` (cap FOR UPDATE) |
| 4 | Guardian & LMS login | 06,07 | US-007,008 | `guardian.requestLink/approveLink`; `lmsAuth.requestOtp/verifyOtp`+picker; `enrollment.mine` |
| 5 | UI mỏng | — | (chung) | admin routes CRM/Finance + ResultPanel; LMS `/login`→`/select-child`→`/child/:id` |
| — | Recon agent | 09 | US-010 | **Lùi P5** (HOTL, MCP read-only) |

Chi tiết Phase 0: `phase-01-foundation.md`. Phase 1–5 mở rộng khi tới (docs đã đủ chi tiết để code).

## Cách thực thi (Harness + ClaudeKit subagent)
- Mỗi phase: `code` qua subagent (fullstack-developer/backend) → `test` (tester) → `code-reviewer` → cập nhật
  `story update` (proof numeric) + `story verify` + `trace`. Domain logic thuần (netAmount/refund/provisioning)
  đặt ở `packages/domain-finance` để bồi unit (TL29 ≥90%).
- Gate người: dừng nếu đụng migration mất dữ liệu, đổi hướng kiến trúc, hoặc nới lỏng validation.

## Acceptance (TL25/TL29 — kịch bản trọng yếu)
- sale gọi `receiptApprove` → `FORBIDDEN`; audit ghi ai-tạo/ai-duyệt kể cả trùng người.
- Lỗi provisioning **không** rollback `netAmount`; replay không nhân đôi; race SĐT ON CONFLICT.
- `reserved` không điểm danh; `active ⇔ Receipt approved`.
- `SUM(refund) ≤ netAmount` dưới FOR UPDATE; refund vượt → `BAD_REQUEST`.
- Huỷ phiếu duy nhất → opp O5→O4 + clear closedAt.
- PH thấy dữ liệu con chỉ sau guardian link `approved`.
- RLS: query cơ sở A không thấy dữ liệu cơ sở B (test âm tính).

## Ngoài phạm vi đợt này
Entra SSO thật (P0 debt, stub session cho dev), object store/backup off-box, CI Jenkins, recon agent (P5),
mã hoá cột PII (kèm identity, có thể lùi), P2–P4.
