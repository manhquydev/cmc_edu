# Brainstorm Report — Rà soát role thực tế, trạng thái build, hướng đi M0

**Date:** 2026-07-09 15:18 · **Mode:** review/assessment · **Participants:** PO (manhquy) + Claude
**Status:** Concluded — 2 quyết định chốt, không cần plan mới (plan `260707-2308` đã có sẵn Phase 2+4)

## 1. Vấn đề đặt ra

PO yêu cầu: (a) rà lại kế hoạch/quyết định gần đây về vai trò — đảm bảo bám thực tế vận hành,
không phình role kiểu sách giáo khoa; (b) xác nhận build đã đạt tới đâu; (c) chốt hướng triển khai tiếp.

## 2. Findings (verified trong repo)

### Role: KHÔNG lệch thực tế — vừa được siết về 5 role thật
- ADR-D + amendment 2026-07-08: 5 role active (`super_admin`, `giam_doc_kinh_doanh`,
  `giam_doc_dao_tao`, `sale`, `giao_vien`). LMS = PH + HS (không phải staff role).
- 4 role gác (`ke_toan`/`cskh`/`ctv_mkt`/`hr`): 0 quyền, không gán được. Enum DB giữ 9 giá trị trơ.
  Enforce: `ACTIVE_ROLES` + invariant test `PERMISSIONS ⊆ ACTIVE_ROLES` + zod reject `user.updateRoles`
  + UI dropdown lọc. Commit `57ee539`, 447 test auth khoá ma trận.
- "Quản lý" = thuộc tính `managerId`, không phải role (TL14 §2, ADR-D §4). Cổng tiền do GĐKD (SoD giữ).
- Đường bật lại role khi có người thật: thêm `ACTIVE_ROLES` + quyền + UI + ADR mới. Không bật trước.

### Build state (HEAD `57ee539`, working tree sạch)
- Gates: typecheck 26/26 · full suite 482/483 · build 14/14 · e2e 17/17.
- M0 (plan `260707-2308`): P1 SSO landed (PR #24) ✅ · P3 flow-audit ✅ (0 CRITICAL) ·
  P2 env-prod ⏳ · P4 UAT ⏳. Blocker của P4 (plan role-scope `260708-2240`) đã DONE → UAT mở khoá.
- Nợ nhỏ: TL17 stale theo TL14 · tách SessionRole/PermissionRole = YAGNI trước go-live ·
  xoá enum dormant = sau M1.

## 3. Phương án đã cân nhắc

| Phương án | Kết luận |
|---|---|
| A. Chạy tiếp M0 Phase 2 env-prod → Phase 4 UAT; rà quyền gộp vào kịch bản UAT | **CHỌN** — critical path duy nhất tới GO |
| B. Rà ma trận quyền với PO trước, rồi mới Phase 2 | Bỏ — GO lùi; UAT người thật vốn là nơi phát hiện lệch quyền |
| Mở rộng role | Không có trên bàn — trái ADR-D, không có người thật đảm nhiệm |

### Nhánh phát sinh: seed super_admin bằng mật khẩu?
PO đề xuất dùng tài khoản mật khẩu thay email Entra. **Verify code: sai giả định** — password login
chỉ tồn tại ở `apps/api/src/lms-auth/` (PH/HS); staff (`apps/api/src/auth/`) chỉ có SSO, dev-header
tắt ở prod. Dùng mật khẩu cho staff = xây luồng auth mới trước go-live (mặt phẳng tấn công mới, review lại).

| Phương án | Kết luận |
|---|---|
| A1. Giữ SSO — seed super_admin bằng 1 email có sẵn trong tenant Entra | **CHỌN** (PO chốt sau khi xem bằng chứng) |
| A2. Xây staff password login | Bỏ — scope mới, GO lùi, trái quyết định SSO đã land |

## 4. Quyết định chốt (2026-07-09)

1. **Hướng A**: thực thi M0 Phase 2 (env-prod `cmcv2-prod` local-sim) → Phase 4 (UAT go/no-go).
   Rà ma trận quyền 5 role gộp vào kịch bản UAT người thật — không mở project riêng.
2. **A1**: super_admin seed bằng email Entra có sẵn trong tenant CMC (email cụ thể PO cung cấp
   khi tới Phase 2 bước 8). KHÔNG xây staff password login.

## 5. Next steps

- Thực thi `plans/260707-2308-golive-sprint-land-sso-env-uat/phase-02-env-prod-cmcv2.md`
  (vd `/ck:cook @plan`). Tiền đề host: WSL2 sẵn sàng; R2 creds đã có; Azure redirect URI khớp local-sim.
- PO cung cấp email Entra cho seed super_admin khi Phase 2 chạy tới bước 8.
- Sau UAT: nếu phát hiện gate quyền sai với thực tế → sửa registry + TL14 cùng PR (quy tắc TL14 §7).
- Nợ docs (không chặn GO): cập nhật TL17 theo TL14.

## Unresolved questions
- Email Entra cụ thể cho super_admin (cần trước Phase 2 bước 8).
