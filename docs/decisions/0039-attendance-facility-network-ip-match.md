# 0039 — Chấm công qua khớp IP dải mạng cơ sở (không GPS)

Date: 2026-07-05

## Status

Accepted (formalize `routers/check-in-out.ts`).

## Context

Chấm công tại cơ sở; cần xác thực "đang ở công ty" mà không dùng GPS (riêng tư, thiếu
chính xác trong nhà).

## Decision

- `FacilityNetwork` khai báo các dải hợp lệ: `ipAddress` dạng **CIDR** (`192.168.1.0/24`) hoặc IP đơn,
  `label`, `isActive`.
- Khi chấm: lấy `ctx.ip` (IP client qua proxy header) → `ipMatchesCidr` so với các dải active của cơ sở.
  - Khớp → `method: 'ip'` (hợp lệ tự động).
  - Không khớp → `method: 'manual'` → bắt buộc **phiếu chấm công thủ công theo ngày** (QĐ 0034).
- **Cooldown** chống double-punch (lỗi `CONFLICT`). Bản ghi lưu `ipAddress` + `method` (audit).
- Duyệt phiếu thủ công: **không tự duyệt của mình**; **chỉ manager trực tiếp** (FORBIDDEN nếu khác).

> **Cập nhật 2026-07-13 (ADR 0043):** mô hình duyệt phiếu thủ công ở trên đã đổi từ "manager trực
> tiếp" sang gate theo ROLE khớp track chủ phiếu (sale→`giam_doc_kinh_doanh`, giao_vien→`giam_doc_dao_tao`,
> `super_admin` bypass cả hai) — xem `docs/decisions/0043-attendance-daily-inout-pairing.md`. Phần
> khớp-IP (`method: 'ip'` vs `'manual'`) ở ADR này vẫn đúng nguyên trạng.

## Consequences

Phụ thuộc **độ tin cậy của IP client** — hạ tầng phải cấu hình `x-forwarded-for`
đúng (chống giả IP). Cơ sở phải khai báo dải mạng. Không cần quyền định vị.

## Alternatives bỏ

GPS/geofence (riêng tư, kém chính xác trong nhà); QR tại chỗ (dễ chụp lại).

---

Nguồn đầy đủ: `docs/22-adr-rule-chi-code-0038-0041.md`. Liên kết: `docs/20` §1.
