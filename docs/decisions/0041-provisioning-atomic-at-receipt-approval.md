# 0041 — Provisioning atomic tại duyệt phiếu (+ tinh chỉnh v2)

Date: 2026-07-05

## Status

Accepted (formalize QĐ 0024/0033/0037) — v2 tinh chỉnh phần idempotent.

## Context

Tài khoản HS/PH phải tồn tại đúng khi tiền được xác nhận; tuyệt đối **không student mồ côi**
tạo ngoài mạch tài chính.

## Decision (hành vi hiện hữu)

- Tại `finance.receiptApprove` (cổng tiền): trong mạch tiền → auto-advance opp **O5_ENROLLED** +
  `closedAt`; tạo **Student** (`createdByReceiptId` provenance) + **ParentAccount** (find-or-create theo
  `phone` 84xxx) + **Enrollment** (`reserved`→`active`) + **StudentAccount** LMS; email PH qua **outbox**.
- Không có UI tạo student thủ công (break-glass tách trang quản trị — quyết định 2026-07-05).
- Race `unique_violation` trên `parent_account.phone` (2 con SĐT-mới đồng thời) xử bằng
  **SAVEPOINT / `ON CONFLICT DO NOTHING` + refetch** để giữ transaction tiền sống.

## Decision (tinh chỉnh v2 — TL03 §A, ADR-B)

- Giữ **đăng tiền + O5 atomic**; **tách provisioning ra bước idempotent** (khoá theo `phone`) để lỗi
  provisioning **không rollback tiền**.
- `Enrollment` `reserved→active` **lái bởi Receipt** (`active ⇔ Receipt approved` — ADR-A/TL16).

## Consequences

Không student mồ côi; toàn vẹn tiền; provisioning idempotent chịu retry (khớp outbox).
Mang nguyên QĐ 0024 (cổng tiền/auto-O5), 0033 (định danh phone), 0037 (CRM↔finance lookup).

## Alternatives bỏ

Tạo student ở UI riêng ngoài mạch tiền — sinh student mồ côi, sai "won" metrics.

---

Nguồn đầy đủ: `docs/22-adr-rule-chi-code-0038-0041.md`. Liên kết: `docs/01`/`docs/17`.
