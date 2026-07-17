# 0040 — Nhóm ca theo vai trò + `selectionMode` (sale ≠ giáo viên)

Date: 2026-07-05

## Status

Accepted (formalize `resolveShiftGroup()` + `ShiftGroup`).

## Context

Sale và giáo viên có **hình thức công ca khác nhau**: khối kinh doanh làm giờ cố định;
giáo viên làm theo buổi, có thể nhiều ca.

## Decision

- **ShiftGroup** phân theo vai trò qua `resolveShiftGroup(position)`:
  - `KINH_DOANH` ← `sale`/`cskh`/`ctv_mkt`
  - `GIAO_VIEN` ← `giao_vien`
- Mỗi nhóm có **`selectionMode` = `SINGLE` | `MULTIPLE`**: một nhóm cho chọn **một** ca/ngày (khối văn
  phòng cố định), nhóm kia **nhiều** ca (giáo viên theo buổi). (Gán selectionMode cụ thể theo cấu hình.)
- `ShiftTemplate` (`CA_SANG/CA_CHIEU/CA_TOI`, start/end) thuộc nhóm. `ShiftEntryType` = `work` | `leave`.
- Vòng đời phiếu `draft→submitted→approved|cancelled`; **ticket-lock** 1 phiếu chờ; `fromDate` tương
  lai (ICT) — QĐ 0035.
- **Duyệt (fallback theo nhóm):** managerId trực tiếp; hết chuỗi → nhóm `GIAO_VIEN` → **GĐĐT**, nhóm
  `KINH_DOANH` → **GĐKD**. Chống tự-duyệt (QĐ 0027). Role `bgd` cũ đã bỏ.

## Consequences

Hai hình thức công ca cùng tồn tại, phân bằng dữ liệu (`ShiftGroup`), không hardcode
theo role rải rác. Đổi mapping role→group chỉ sửa `resolveShiftGroup`.

## Alternatives bỏ

Một mẫu ca chung cho mọi vai trò — không phản ánh thực tế sale vs giáo viên.

---

Nguồn đầy đủ: `docs/22-adr-rule-chi-code-0038-0041.md`. Liên kết: `docs/20` §2.
