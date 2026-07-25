# Phase 7 (part 1) — Admin subset: ADM-02/03/04 + P3-10/11 no-ui-path

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-07-dot-hr-rewards-admin.md`
**Ngày:** 2026-07-25 · **Branch:** `acceptance-journey-38-lms`

Bắt đầu Phase 7 (đợt lớn nhất) bằng subset admin sạch nhất + 2 worker no-ui-path.
Sổ **16 → 19/38**.

## Đã giao

| Flow | Kết quả | Phủ |
|---|---|---|
| ADM-03 Cấu hình IP mạng | xanh 4× | **5/5** procedure |
| ADM-02 Quản trị nhân sự | xanh 4× | 3/4 (user.update không UI = drift) |
| ADM-04 Nhật ký hệ thống | xanh 4× | audit.list + chứng minh bộ lọc actor |
| P3-10 session-done worker | no-ui-path (V7) | — |
| P3-11 cancel-sweep worker | no-ui-path (V7) | — |

## Pattern admin nắm được (tái dùng cho phần còn lại)

- **Native `<dialog>`** (create/edit form): `page.locator('dialog').filter({ hasText })` — cả hai luôn mounted, disambiguate bằng title.
- **ConfirmDialog** (delete): `getByRole('alertdialog')` + nút "Xác nhận" (KHÔNG phải `<dialog>`).
- **MultiSelector** (roles): mở "Roles" → click option → Escape → nút "Lưu" của Dialog persist qua updateRoles. Badge hiện role VALUE (`giao_vien`), không phải label.
- **detectMyIp**: click → chờ CIDR field non-empty (settle) → mới overwrite (tránh late-response clobber). Trên localhost caller IP resolve nên detect fill được.
- **Discriminator**: CIDR unique per-run (octet từ runId hex), label unique, actor userId unique.

## ADM-04: sửa theo review — chứng minh BỘ LỌC in-band

Bản đầu chỉ assert "entry của tôi hiện" — nhưng entry mới nhất luôn nổi đầu
(audit.list sort desc, không scope facility), nên bộ lọc no-op vẫn pass. Review
bắt đúng: đó là chứng minh "audit hiện hành động thật", KHÔNG phải "bộ lọc cô lập
theo actor". **Sửa:** HAI actor mỗi người 1 hành động audit → lọc theo A → A
hiện, **B vắng**. B-vắng mới là bằng chứng bộ lọc thật sự loại trừ. Falsification:
lọc actor bịa → A cũng vắng → đỏ.

## Falsification (chạy thật, load-bearing)

| Flow | Phá gì | Kết quả |
|---|---|---|
| ADM-02 | bỏ "Lưu" roles | badge vắng → assert đỏ ✅ |
| ADM-03 | bỏ confirm xoá | row còn → toHaveCount(0) đỏ ✅ |
| ADM-04 | lọc actor bịa | A vắng → assert đỏ ✅ |

## Kiểm chứng

- 3 journey xanh 4× liên tiếp; full `ui-chromium` **27/27** (3.7′)
- Code review độc lập: DONE, 0 critical/high; 4 Low → **đã xử** (ADM-04 filter
  in-band; detect comment; option exact; CIDR-accumulation = non-issue vì
  facility ephemeral per-run, xác nhận global-setup tạo+teardown facility mỗi run)
- typecheck 27/27 · lint sạch · test 2100 · 0 file sản phẩm bị chạm
- Sổ: **19/38 luồng đã chứng minh chạy**

## Ghi chú kỹ thuật hữu ích cho phần còn lại

- **Facility ephemeral per-run** (global-setup `facility.create` + teardown
  `cleanupFacility`) → dữ liệu facility-scoped tự dọn; audit log global (không
  scope facility) tích luỹ, keyed theo actor duy nhất.
- **Dải IP INACTIVE vô hại** với punch: `checkin/router.ts` chỉ đọc range
  `isActive:true`. Range tắt không làm luồng khác offsite.

## Còn lại Phase 7 (bản đồ triage P3/P4/ADM §6)

**HR (nặng hơn — multi-role):**
- `shift-register-approve-reject` → P3-03/04/07 (ShiftGroup/Template setup; ticket-lock ép tuần tự; group.type theo position)
- `payroll-assemble-finalize` → P3-05 delta (cần SalaryRate.tierId qua /hr/salary-tiers)
- `kpi-refresh-my` → P3-09 (NV bấm "Tính lại", không guard ngày-3)
- `kpi-submit-confirm-bulk-approve` → P3-06/08 (**cần seed managerId** B1/V6; kỳ quá khứ)
- `shift-config-admin` → ADM-05 (super_admin tạo ShiftGroup/Template)

**Rewards-admin:**
- `post-sale-meeting-schedule` → P4-03
- `entrance-test-appointment` → P4-04
- `after-sale-case-lifecycle` → P4-05
- `facility-admin-crud` → ADM-01 (T3: cleanupFacility mở rộng — `facility.delete` không tồn tại)

Tái dùng sẵn: P3-01/02 (checkin), P3-05 (payroll-roster, phủ hẹp), P4-01/02.

## Finding sản phẩm tích luỹ (bàn giao plan sửa)
1. Học phí số tròn · 2. `Cmc2026@` lặp · 3. recon self_approved dead-path + mô tả
lệch · 4. mark-lost không refresh · 5. banner grading hardcode sao · 6. upload
blob rác · 7. **MỚI:** ADM-02 `user.update` (setter managerId) không có UI.

## Câu hỏi chưa giải quyết
- HR đợt cần nhiều setup (ShiftGroup/Template, SalaryRate tier, managerId seed) —
  nặng hơn admin; tiếp phiên sau theo bản đồ trên.
- ADM-01 (T3): `facility.delete` không tồn tại → journey tạo facility để lại rác;
  cần mở rộng cleanup theo tiền tố tên.
