# Phase P5 — Reconciliation agent (US-010, WF-P1-09) + MCP tool layer

## Goal
Đóng story cuối P1 (recon HOTL) + đặt móng AI-native (MCP bọc tRPC) theo crawl-walk-run (TL04 §8).

## Nguồn spec
TL23/24 WF-P1-09 · TL04 (HOTL, compensating control ADR-B) · TL13 (kỹ thuật agent) · TL09-K5 (MCP bọc tRPC) · TL14 §6 (agent = principal quyền hẹp).

## Scope — CRAWL trước (rule-based, KHÔNG cần LLM)

### P5a — Reconciliation rule-based (đóng US-010)
- Worker mới `apps/api/src/worker/reconcile-finance-flags.ts` (cạnh reconcile-orphaned-receipts): quét định kỳ, **rule tất định — ngưỡng mặc định pinned (fix validate):**
  - Phiếu "tạo & tự duyệt" (audit selfApproved=true) — MỌI mức tiền → cờ.
  - Phiếu vượt ngưỡng mắt-thứ-hai (20tr) → cờ (double-check hậu kiểm).
  - **>2 RefundRecord/receipt** hoặc **SUM(refund) >80% netAmount** → cờ.
  - Receipt approved **thiếu provisioning >1 giờ** → cờ.
  - **Dedup:** không tạo cờ trùng khi flag cùng (receiptId, kind) đang `open`.
- Schema: `ReconciliationFlag` (facilityId, receiptId?, kind, detail Json, status open|dismissed|actioned, resolvedById?) · RLS + GRANT.
- Procedures: `reconciliation.listFlags` (GĐĐT/super_admin — hàng đợi review) · `reconciliation.dismiss/action` (**quyết định NGƯỜI, audit**; dismiss = feedback). Cờ mang **deep-link** `/finance/receipts/:id?flag=...` (TL06 §6 — sẵn cho UI).
- **Agent principal (pre-resolved — fix validate):** KHÔNG thêm role vào `ROLES` (const 9 role cần ADR — hệ role `ai_agent_*` đầy đủ để walk-phase với ADR riêng). Crawl-phase: worker chạy **system-job** (như reconcile hiện hữu), audit actor = `'ai:recon'`, liệt kê facility rồi đọc **per-facility qua `withFacility`** (không bypass thường trực); chỉ gọi hàm đọc — không tRPC mutation nào được gọi từ worker (test cấu trúc).

### P5b — MCP tool layer skeleton
- Package `@cmc/mcp-server`: MCP server bọc N procedure ĐỌC an toàn (crm.opportunityLookup, finance.receiptList/Get read, reconciliation.listFlags) — tool schema = zod input; mọi call đi qua tRPC + requirePermission + RLS + audit dưới principal `ai_agent_*`. KHÔNG tool ghi tiền/dữ liệu trẻ (TL13 §4).
- Chạy stdio; đăng ký vào Harness tool registry (`harness-cli tool register --kind mcp`).

## KHÔNG làm ở P5 (walk/run sau, cần eval + LLM key)
LLM-based anomaly detection · Admissions/Communication/Teacher-assist agent tự hành · auto-send theo ngưỡng. (TL29 §5: bật tự chủ chỉ sau golden-dataset eval.)

## Tests
Mỗi rule có test dương/âm · agent principal KHÔNG gọi được receiptApprove/mutation (FORBIDDEN test) · dismiss/action audit · RLS · MCP tool gọi đúng gate (integration).

## Harness
Intake high-risk (agent+tiền) · US-010: **cập nhật verify_command → `pnpm --filter @cmc/api exec vitest run src/worker/reconcile-finance-flags.test.ts`** (fix validate: DB đang trỏ `src/agent/recon.test.ts`, TL25 ghi `agent/recon.spec` — chuẩn về một đường này, ghi chú deviation trong TL15) rồi in_progress → implemented.

## Acceptance
US-010 implemented → **ma trận TL25 28/28 đóng** · agent read-only chứng minh bằng test · MCP skeleton gọi được 1 tool qua gate · merge theo protocol.
