---
phase: 3
title: "D2 an toàn + OTP banner"
status: completed
priority: P1
effort: "0.75d"
dependencies: [1]
---

# Phase 3: D2 an toàn + OTP banner

## Overview

Xoá định danh nội bộ khỏi **22 chuỗi** Phase 3 sở hữu (12 lint bắt + 9 lint mù +
1 chuyển từ Phase 4) — **không chuỗi nào bị test ràng buộc** (đã đo) — cộng sửa
chuỗi lộ hạ tầng OTP ở LMS.

## Requirements

**Functional**
- Không còn tên hàm API, tên component, tên thư viện, thuật ngữ kỹ thuật trong
  22 chuỗi thuộc phase (12 nhóm A + 9 nhóm B + 1 nhóm C).
- `lms/login.tsx:83` không còn lộ tên transport/nhà cung cấp.

**Non-functional**
- **Không đụng permission code** (non-goal — xem `plan.md`).
- Không đụng `apps/api`.
- Nếu chuỗi đến từ backend ⇒ dừng, ghi backlog.

## Architecture

| Nhóm | Cách thay |
|------|-----------|
| Tên hàm API (`finance.refundCreate`, `testAppointment.forOpportunity`) | mô tả hành động người dùng |
| Tên component/thư viện (`SettingsShell`, `FullCalendar`) | bỏ hẳn |
| Thuật ngữ kỹ thuật (`CRUD`, `Net`, `SoD`, `server-side`, `ai:recon`) | diễn đạt nghiệp vụ |
| Role code (`super_admin`) | tên vai trò tiếng Việt (`MASTER.md` có bảng map) |
| "API … chưa khả dụng" | "Chưa có dữ liệu" / "Tính năng đang phát triển" |
| `Entity` | "Liên kết không hợp lệ" |
| OTP infra (`ConsoleEmailTransport`, `Brevo/Graph`) | thông báo trung tính, hoặc gate `import.meta.env.DEV` |

## Related Code Files

### ⚠️ Nguồn authoritative là ARTIFACT do máy sinh, không phải bảng dưới

`plans/reports/from-red-team-r2-to-planner-260805-1153-d2-worklist-machine-generated.md`

Bảng viết tay đã sai ở **cả R1 lẫn R2** (bỏ sót `my-hr:284/294`,
`network-ip:353`; gắn nhãn `✅lint` sai cho 5 dòng). Khi bảng lệch artifact,
**artifact thắng**.

### A. Lint BẮT ĐƯỢC — Phase 3 sở hữu (12/16; 4 còn lại thuộc phase khác)

| File:line | Vấn đề |
|-----------|--------|
| `finance/refund.tsx:29` | `finance.refundCreate` |
| `finance/receipt-detail.tsx:230` | `super_admin` |
| `crm/opportunity-detail.tsx:500` | `testAppointment.forOpportunity` |
| `go-resolver.tsx:20` | `Entity` |
| `hr/my-hr.tsx:284` | `super_admin` ← **R2 phát hiện, bản trước bỏ sót** |
| `hr/my-hr.tsx:294` | `super_admin` ← **R2 phát hiện, bản trước bỏ sót** |
| `students/student-detail.tsx:182,195,208,221` | "API … chưa khả dụng" ×4 |
| `teaching/schedule.tsx:212` | `FullCalendar · ClassSession timed` |
| `lms/login.tsx:83` | OTP infra — xem mục riêng dưới |

4 vị trí lint bắt nhưng **phase khác sở hữu**: `shift-config.tsx:323` +
`schedule.tsx:298` (**Phase 2**), `reconciliation.tsx:254` + `users.tsx:346`
(**Phase 4**).

### B. Lint MÙ — checklist tay bắt buộc (9)

| File:line | Vấn đề | Dạng AST |
|-----------|--------|----------|
| `finance/receipt-detail.tsx:231` | `super_admin` | template literal |
| `finance/receipt-detail.tsx:310` | `SoD` | JSXText |
| `finance/revenue-report.tsx:215` | `server-side` | template literal |
| `finance/reconciliation.tsx:58` | `super_admin` | string trong mảng |
| `finance/reconciliation.tsx:259` | `ai:recon` | JSXText |
| `hr/my-hr.tsx:257` | `Net` | JSXText |
| `hr/payroll.tsx:386` | `Net` | JSXText |
| `hr/salary-tiers.tsx:410` | `CRUD` | object literal |
| `admin/network-ip.tsx:353` | `CRUD` | object literal ← **R2 phát hiện** |

Nhóm này **lint không bao giờ thấy** ⇒ nghiệm thu bằng grep tay, không bằng exit code.

### C. Chuyển từ Phase 4 sang (R2: không hề coupled)

| File:line | Chuỗi | Bằng chứng |
|-----------|-------|-----------|
| `crm/opportunity-detail.tsx:551` | `Tiến độ giai đoạn O1–O5.` | `grep -rn 'O1–O5\|Tiến độ giai đoạn'` → 3 hit, **0 test**. Enum ở `:555-559` tách rời chuỗi hiển thị ⇒ đổi nhãn an toàn |

### 🔎 Ranh giới với non-goal permission code

Non-goal giữ **mã quyền ở màn 403** (`(shift.manage)`, `(class.create)`, …).
`super_admin` ở `receipt-detail.tsx:230/231`, `my-hr.tsx:284/294`,
`reconciliation.tsx:58` là **role code trong câu mô tả nghiệp vụ**, không phải mã
quyền ở màn 403 ⇒ **trong phạm vi sửa**. `MASTER.md` §Copy vốn đã cấm đúng dạng
này (`giao_vien` → "Giáo viên").

### 🔴 OTP banner — đưa vào phạm vi theo quyết định người dùng 2026-08-05

- Modify: `apps/lms/src/pages/login.tsx:82-83`

Chuỗi hiện tại lộ `ConsoleEmailTransport`, "console của server", `Brevo/Graph
credentials` cho **người chưa đăng nhập** trên trang public. Đã verify: **không**
bọc `import.meta.env.DEV` (khác với `DevHeaderWriter` ở `:326` — chỗ đó gated đúng).

Hai cách, chọn một khi thực thi:
1. Viết lại trung tính cho phụ huynh (không nêu transport/nhà cung cấp), giữ badge
   `[DEV ONLY]` nếu vẫn muốn báo trung thực rằng luồng chưa chạy thật.
2. Bọc cả banner trong `import.meta.env.DEV` — production không thấy gì.

**Không** sửa luồng OTP (vẫn là non-goal), chỉ sửa chuỗi.

## Implementation Steps

1. Lấy worklist lint (Phase 1) làm **đầu vào**, đối chiếu bảng trên. Worklist dài
   hơn bảng ⇒ **triage từng cái** (sửa / backlog / FP). **Không** thu hẹp regex
   cho khớp con số — đó là làm mù công cụ.
2. Với mỗi chuỗi: xác định **nguồn** trước — hardcode FE hay từ backend? Backend ⇒
   dừng, ghi backlog.
3. Sửa nhóm A (lint xác nhận được).
4. Sửa nhóm B + C — **grep -F từng chuỗi vào e2e + `*.test.tsx` trước khi đổi**.
5. Sửa OTP banner `lms/login.tsx:82-83`.
6. Kiểm LMS phần còn lại: chỗ đã gate `import.meta.env.DEV` ⇒ **bỏ qua, không phải lỗi**.
7. `pnpm test` + `pnpm typecheck` sau mỗi cụm domain.

## Tests / Validation

- `pnpm test` xanh (47 file test admin — required check).
- `pnpm typecheck` xanh.
- `pnpm lint` exit 0.
- **Checklist inventory theo chuỗi** cho nhóm B+C — lint không chứng minh được
  nhóm này, phải grep tay xác nhận.
- Đối chiếu ý nghĩa nghiệp vụ trước/sau từng chuỗi.

## Success Criteria

- [x] Nhóm A (12 vị trí Phase 3 sở hữu) đã sửa — xác nhận bằng chạy lại config audit (0 vi phạm)
- [x] Nhóm B (9 vị trí lint mù) đã sửa — xác nhận bằng **grep tay từng chuỗi**
- [x] Nhóm C (`opportunity-detail.tsx:551`) đã đổi nhãn, enum `:555-559` **không đổi**
- [x] `lms/login.tsx:82-83` không còn lộ transport/nhà cung cấp (gate `import.meta.env.DEV`)
- [x] Worklist dôi ra đã triage từng cái, **không** thu hẹp regex cho khớp số
- [x] Chuỗi nguồn backend ghi backlog (`plan.md` §Backlog #1/#1a), **không** sửa lén ở FE
- [x] Permission code **không bị đụng bởi Phase 3** — duy nhất diff trên
      `apps/admin/src/routes` là route `/design2` từ PR đã merge trước, không
      liên quan phase này (đối chiếu `git show --stat` từng commit Phase 3)
- [x] `pnpm test` (527/527) + `pnpm typecheck` xanh
- [x] `pnpm check:ui-frames && pnpm test:ui-frames` xanh
- [x] `pnpm lint` (config chính) exit 0 — rule mới **chưa** vào config này ở Phase 3

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Sửa chuỗi thực chất từ backend | Bước 2 xác định nguồn trước |
| Nhóm B+C bị bỏ sót vì lint không bắt | Checklist chuỗi riêng; success criteria tách 2 nhóm |
| Thu hẹp regex để khớp con số | Bước 1 cấm minh thị; triage thay vì tinh chỉnh |
| Vô tình đụng permission code (ngoài phạm vi) | Success criteria kiểm bằng `git diff` |
| Sửa nhầm chỗ đã gate DEV | Bước 6 kiểm gate trước |
| Trùng Phase 2 ở shift-config/schedule | Bảng ghi rõ "Phase 2 sở hữu" |
